import { IncomeModal } from './IncomeModal.js';
import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { IvaKnowledge } from '../iva/IvaKnowledge.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { BatchOperationDialog } from './BatchOperationDialog.js';
import { PrintHelper } from '../utils/printHelper.js';


export const IncomeManager = (project) => {
    // --- EVA Knowledge Registration ---
    IvaKnowledge.registerScreen('entrada', {
        description: 'Tela para gerenciar entradas de receita.',
        actions: [
            { id: 'save', description: 'Salvar o registro atual', selector: '#btn-save' },
            { id: 'new', description: 'Limpar formulário para novo registro', selector: '#btn-new' }
        ],
        fields: [
            { id: 'income-valor', description: 'Valor bruto da entrada', type: 'currency' },
            { id: 'income-data-fato', description: 'Data do fato', type: 'date' },
            { id: 'income-descricao', description: 'Descrição detalhada', type: 'text' },
            { id: 'income-company', description: 'Empresa vinculada', type: 'select' }
        ]
    });

    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '1rem';
    container.style.margin = '0.5rem'; // Reduced margin
    container.style.height = 'calc(100vh - 60px)'; // Maximize height
    container.style.width = 'calc(100% - 1rem)'; // Maximize width
    container.style.maxWidth = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // State for filtering & pagination
    let incomes = [];
    let pagination = { page: 1, limit: 50, total: 0, pages: 1 };
    let activeFilters = {};

    let sortConfig = { key: 'data_fato', direction: 'desc' }; // Default server sort
    let selectedItems = new Set(); // Store IDs
    let selectedItemsData = []; // Store Objects for Sum

    // Define Columns for SharedTable
    const columns = [
        { key: 'data_fato', label: 'Dt Fato', width: 'var(--col-date)', align: 'left', type: 'date' },
        {
            key: 'data_prevista_recebimento',
            label: 'Dt Prevista',
            width: 'var(--col-date)',
            align: 'left',
            type: 'date'
        },
        { key: 'data_atraso', label: 'Dt Atraso', width: 'var(--col-date)', align: 'left', type: 'date' },
        {
            key: 'data_real_recebimento',
            label: 'Dt Real',
            width: 'var(--col-date)',
            align: 'left',
            type: 'date'
        },
        { key: 'tipo_entrada_name', label: 'Tipo Entrada', width: 'var(--col-medium)', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        {
            key: 'installment_info',
            label: '📋',
            width: 'var(--col-icon)',
            align: 'center',
            noFilter: true,
            render: (item) => {
                if (!item.installment_group_id || !item.installment_number) {
                    return document.createTextNode('');
                }
                const span = document.createElement('span');
                span.textContent = `${item.installment_number}/${item.installment_total}`;
                span.style.fontSize = '0.8rem';
                span.style.color = 'var(--color-text-muted, #6B7280)';
                span.style.fontWeight = '600';
                span.title = `Parcela ${item.installment_number} de ${item.installment_total}`;
                return span;
            }
        },
        { key: 'company_name', label: 'Empresa', width: 'var(--col-small)', align: 'left', type: 'text' },
        { key: 'account_name', label: 'Conta', width: 'var(--col-small)', align: 'center', type: 'text' },
        { key: 'valor', label: 'Valor', width: 'var(--col-value)', align: 'right', type: 'currency', colorLogic: 'inflow' },
        {
            key: 'boleto',
            label: 'Boleto/<br/>Nota',
            width: 'var(--col-link)',
            align: 'center',
            type: 'link',
            render: (item) => {
                const btn = document.createElement('button');
                btn.innerHTML = '📄';
                btn.style.background = 'none';
                btn.style.border = 'none';
                btn.style.fontSize = '1.2rem';
                btn.style.padding = '0';
                if (item.boleto_url) {
                    btn.style.cursor = 'pointer';
                    btn.title = 'Ver boleto/nota';
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        window.open(`${API_BASE_URL}${item.boleto_url}`, '_blank');
                    };
                } else {
                    btn.style.cursor = 'default';
                    btn.style.opacity = '0.6';
                    btn.title = 'Sem boleto/nota';
                }
                return btn;
            }
        },
        {
            key: 'comprovante',
            label: 'Compr.',
            width: 'var(--col-link)',
            align: 'center',
            type: 'link',
            render: (item) => {
                const btn = document.createElement('button');
                btn.innerHTML = '📎';
                btn.style.background = 'none';
                btn.style.border = 'none';
                btn.style.fontSize = '1.2rem';
                btn.style.padding = '0';
                if (item.comprovante_url) {
                    btn.style.cursor = 'pointer';
                    btn.title = 'Ver comprovante';
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        window.open(`${API_BASE_URL}${item.comprovante_url}`, '_blank');
                    };
                } else {
                    btn.style.cursor = 'default';
                    btn.style.opacity = '0.3';
                    btn.title = 'Sem comprovante';
                }
                return btn;
            }
        },


        {
            key: 'actions',
            label: 'Ações',
            width: '80px',
            align: 'center',
            noFilter: true,
            render: (item) => {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.gap = '0.5rem';
                div.style.justifyContent = 'center';

                const btnEdit = document.createElement('button');
                btnEdit.innerHTML = '✏️';
                btnEdit.title = 'Editar';
                btnEdit.style.background = 'none';
                btnEdit.style.border = 'none';
                btnEdit.style.cursor = 'pointer';
                btnEdit.style.fontSize = '1.1rem';
                btnEdit.onclick = (e) => { e.stopPropagation(); updateIncome(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteIncome(item.id, item.descricao, item); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        {
            key: 'status',
            label: '',
            width: '60px',
            align: 'center',
            noFilter: true,
            render: (item) => {
                let statusColor = '#F59E0B'; // Pending (Yellow)
                let statusTitle = 'Aguardando Pagamento';

                if (item.data_real_recebimento) {
                    statusColor = '#10B981'; // Received (Green)
                    statusTitle = 'Recebido';
                } else {
                    const today = new Date().toISOString().split('T')[0];
                    const prev = item.data_prevista_recebimento ? item.data_prevista_recebimento.split('T')[0] : '';
                    if (prev && prev < today) {
                        statusColor = '#EF4444'; // Overdue (Red)
                        statusTitle = 'Atrasado';
                    }
                }

                const dot = document.createElement('div');
                dot.style.backgroundColor = statusColor;
                dot.style.width = '12px';
                dot.style.height = '12px';
                dot.style.borderRadius = '50%';
                dot.style.margin = '0 auto';
                dot.style.cursor = 'help';
                dot.title = statusTitle;
                return dot;
            }
        }
    ];

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // SharedTable Instance
    let sharedTable = null;

    const loadIncomes = async (page = 1) => {
        try {
            container.querySelector('#table-container')?.classList.add('loading');

            const params = new URLSearchParams({
                projectId: project.id,
                page: page,
                limit: pagination.limit
            });

            // Handle Filters
            if (sortConfig.key) {
                params.append('sortBy', sortConfig.key);
                params.append('order', sortConfig.direction);
            }

            Object.keys(activeFilters).forEach(key => {
                const filter = activeFilters[key];
                if (!filter) return;

                if (key === 'valor') {
                    // Operator-based format (advanced filter)
                    if (filter.operator && filter.val1) {
                        if (filter.operator === 'eq') {
                            // Exact match - using min/max range for equality
                            params.append('minValue', filter.val1);
                            params.append('maxValue', filter.val1);
                        } else if (filter.operator === 'gt' || filter.operator === 'gte') {
                            params.append('minValue', filter.val1);
                        } else if (filter.operator === 'lt' || filter.operator === 'lte') {
                            params.append('maxValue', filter.val1);
                        } else if (filter.operator === 'between' && filter.val2) {
                            params.append('minValue', filter.val1);
                            params.append('maxValue', filter.val2);
                        }
                    }
                    // Numeric IN list (quick filter - exact match)
                    else if (filter.numIn && filter.numIn.length > 0) {
                        if (filter.numIn.length === 1) {
                            // Single value - exact match using min/max
                            params.append('minValue', filter.numIn[0]);
                            params.append('maxValue', filter.numIn[0]);
                        } else {
                            // Multiple values - use range (min to max)
                            const values = filter.numIn.map(v => parseFloat(v));
                            params.append('minValue', Math.min(...values));
                            params.append('maxValue', Math.max(...values));
                        }
                    }
                    // Legacy min/max format
                    else if (filter.min || filter.max) {
                        if (filter.min) params.append('minValue', filter.min);
                        if (filter.max) params.append('maxValue', filter.max);
                    }
                } else if (key.startsWith('data')) {
                    // Date Filters with Mutual Exclusion
                    let useAdvanced = false;

                    // Check for operator-based advanced filters
                    if (filter.operator) {
                        useAdvanced = true;
                        if (filter.operator === 'eq' && filter.val1) {
                            params.append(`${key}Start`, filter.val1);
                            params.append(`${key}End`, filter.val1);
                        } else if (filter.operator === 'before' && filter.val1) {
                            params.append(`${key}End`, filter.val1);
                        } else if (filter.operator === 'after' && filter.val1) {
                            params.append(`${key}Start`, filter.val1);
                        } else if (filter.operator === 'between' && filter.val1 && filter.val2) {
                            params.append(`${key}Start`, filter.val1);
                            params.append(`${key}End`, filter.val2);
                        }
                    } else if (filter.start || filter.end) {
                        useAdvanced = true;
                        if (filter.start) params.append(`${key}Start`, filter.start);
                        if (filter.end) params.append(`${key}End`, filter.end);
                    }

                    // Only use checkbox list if no advanced filter
                    if (!useAdvanced && filter.dateIn && filter.dateIn.length > 0 && !filter.dateIn.includes('__NONE__')) {
                        filter.dateIn.forEach(d => params.append(`${key}List`, d));
                    }
                } else if (key === 'link') {
                    // Link filter (boolean)
                    if (filter.value === 'true' || filter.value === 'with_link') params.append('hasAttachment', '1');
                    else if (filter.value === 'false' || filter.value === 'without_link') params.append('hasAttachment', '0');
                } else {
                    // Specific Text Filters
                    if (key === 'descricao' && filter.text) params.append('description', filter.text);
                    if (key === 'account_name' && filter.text) params.append('account', filter.text);
                    if (key === 'company_name' && filter.text) params.append('company', filter.text);
                    if (key === 'tipo_entrada_name' && filter.text) params.append('tipoEntrada', filter.text);

                    // Handle List Filters (Exact Match)
                    if (filter.textIn && filter.textIn.length > 0 && !filter.textIn.includes('__NONE__')) {
                        if (key === 'descricao') filter.textIn.forEach(v => params.append('descriptionList', v));
                        if (key === 'account_name') filter.textIn.forEach(v => params.append('accountList', v));
                        if (key === 'company_name') filter.textIn.forEach(v => params.append('companyList', v));
                        if (key === 'tipo_entrada_name') filter.textIn.forEach(v => params.append('tipoEntradaList', v));
                    }

                    // Fallback or "Contains" generic operator if matched
                    if (filter.val1 && filter.operator === 'contains') {
                        if (key === 'descricao') params.append('description', filter.val1);
                        else if (key === 'account_name') params.append('account', filter.val1);
                        else if (key === 'company_name') params.append('company', filter.val1);
                        else if (key === 'tipo_entrada_name') params.append('tipoEntrada', filter.val1);
                        else params.append('search', filter.val1); // Genuine fallback
                    } else if (filter.text && !['descricao', 'account_name', 'company_name', 'tipo_entrada_name'].includes(key)) {
                        params.append('search', filter.text);
                    }
                }
            });

            const response = await fetch(`${API_BASE_URL}/incomes?${params.toString()}`, {
                headers: getHeaders()
            });

            if (!response.ok) throw new Error('Falha ao carregar entradas');

            const result = await response.json();

            if (result.meta) {
                incomes = result.data;
                pagination = result.meta;
            } else {
                incomes = Array.isArray(result) ? result : [];
                pagination = { page: 1, limit: incomes.length, total: incomes.length, pages: 1 };
            }

            renderIncomes(); // Now calls SharedTable render
            renderPagination();

        } catch (error) {
            console.error('Error loading incomes:', error);
            showToast(error.message, 'error');
        } finally {
            container.querySelector('#table-container')?.classList.remove('loading');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedItems.size === 0) return;

        const confirm = await showDangerConfirm(
            `⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!`,
            `Você está prestes a excluir permanentemente ${selectedItems.size} ${selectedItems.size === 1 ? 'item' : 'itens'}. Todos os dados serão perdidos.`,
            'Sim, Excluir Permanentemente'
        );

        if (confirm) {
            try {
                const response = await fetch(`${API_BASE_URL}/incomes/bulk-delete`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ ids: Array.from(selectedItems) })
                });

                const result = await response.json();
                if (response.ok) {
                    showToast(result.message, 'success');
                    selectedItems.clear();
                    selectedItemsData = [];
                    sharedTable.clearSelection();
                    loadIncomes();
                } else {
                    showToast(result.error || 'Erro ao excluir itens', 'error');
                }
            } catch (error) {
                console.error(error);
                showToast('Erro de conexão', 'error');
            }
        }
    };

    const renderPagination = () => {
        const pagContainer = container.querySelector('.pagination-controls');
        if (!pagContainer) return;

        pagContainer.innerHTML = '';

        // If selection active, show Bulk Actions instead of just Pagination?
        // Or show both? User wants "calculation" and "delete in batch".
        // Better to show Total Selected in the Total Bar, and Batch Action near it.

        const btnPrev = document.createElement('button');
        btnPrev.className = 'btn-sm';
        btnPrev.textContent = '◀ Anterior';
        btnPrev.disabled = pagination.page <= 1;
        btnPrev.onclick = () => loadIncomes(pagination.page - 1);

        const label = document.createElement('span');
        label.textContent = `Página ${pagination.page} de ${pagination.pages}`;
        label.style.margin = '0 1rem';

        const btnNext = document.createElement('button');
        btnNext.className = 'btn-sm';
        btnNext.textContent = 'Próxima ▶';
        btnNext.disabled = pagination.page >= pagination.pages;
        btnNext.onclick = () => loadIncomes(pagination.page + 1);

        pagContainer.appendChild(btnPrev);
        pagContainer.appendChild(label);
        pagContainer.appendChild(btnNext);

        // Update Total
        const totalContainer = container.querySelector('#total-display');
        if (totalContainer) {
            const pageTotal = incomes.reduce((sum, inc) => sum + parseFloat(inc.valor || 0), 0);
            const selectionTotal = selectedItemsData.reduce((sum, inc) => sum + parseFloat(inc.valor || 0), 0);

            const hasSelection = selectedItems.size > 0;

            totalContainer.innerHTML = `
                <div style="display: flex; gap: 2rem; align-items: center;">
                    <div>
                        <span style="font-size: 1.1rem; margin-right: 0.5rem;">Total (Página):</span>
                        <span style="font-weight: 700; font-size: 1.1rem; color: ${pageTotal >= 0 ? '#10B981' : '#EF4444'};">
                            ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pageTotal)}
                        </span>
                    </div>
                    ${hasSelection ? `
                    <div class="animate-fade-in" style="display: flex; align-items: center; gap: 1rem; background: #eef2ff; padding: 4px 12px; border-radius: 6px; border: 1px solid #c7d2fe;">
                        <span style="font-size: 1.1rem; margin-right: 0.5rem; color: #4338ca;">Total Selecionados (${selectedItems.size}):</span>
                        <span style="font-weight: 700; font-size: 1.1rem; color: #4338ca;">
                            ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectionTotal)}
                        </span>
                        <button id="btn-bulk-delete" style="
                            background: #EF4444; color: white; border: none; padding: 4px 8px; 
                            border-radius: 4px; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 4px;">
                            🗑️ Excluir
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;

            if (hasSelection) {
                const btnBulk = totalContainer.querySelector('#btn-bulk-delete');
                if (btnBulk) btnBulk.onclick = handleBulkDelete;
            }
        }
    };

    const createIncome = async () => {
        await IncomeModal.show({
            income: null,
            projectId: project.id,
            onSave: async (incomeData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/incomes`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            ...incomeData,
                            projectId: project.id
                        })
                    });

                    if (response.ok) {
                        showToast('Entrada criada com sucesso!', 'success');
                        loadIncomes();
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao criar entrada', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const updateIncome = async (income) => {
        // Check if this is part of an installment group
        let scope = 'single';
        if (income.installment_group_id && income.installment_number && income.installment_total) {
            scope = await BatchOperationDialog.show({
                operation: 'edit',
                currentNumber: income.installment_number,
                totalCount: income.installment_total,
                description: income.descricao
            });

            if (!scope) return; // User cancelled
        }

        await IncomeModal.show({
            income: income,
            projectId: project.id,
            onSave: async (incomeData) => {
                try {
                    // Use batch endpoint if scope is not 'single'
                    const url = scope === 'single'
                        ? `${API_BASE_URL}/incomes/${income.id}`
                        : `${API_BASE_URL}/incomes/${income.id}/batch`;

                    const body = scope === 'single'
                        ? incomeData
                        : { ...incomeData, scope };

                    const response = await fetch(url, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify(body)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        const message = result.message || 'Entrada atualizada com sucesso!';
                        showToast(message, 'success');

                        // Show warning if some were skipped
                        if (result.skipped && result.skipped > 0) {
                            setTimeout(() => {
                                showToast(`⚠️ ${result.skipped} parcela(s) não puderam ser atualizadas (restrição de data)`, 'warning');
                            }, 2000);
                        }

                        loadIncomes();
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao atualizar entrada', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const deleteIncome = async (id, description, item = null) => {
        // Check if this is part of an installment group
        let scope = 'single';
        if (item && item.installment_group_id && item.installment_number && item.installment_total) {
            scope = await BatchOperationDialog.show({
                operation: 'delete',
                currentNumber: item.installment_number,
                totalCount: item.installment_total,
                description: description
            });

            if (!scope) return; // User cancelled
        }

        // Show confirmation dialog
        const confirmMessage = scope === 'single'
            ? `Tem certeza que deseja excluir "${description}"?`
            : scope === 'all'
                ? `Tem certeza que deseja excluir TODAS as ${item?.installment_total || 'X'} parcelas?`
                : `Tem certeza que deseja excluir esta e as próximas parcelas?`;

        const confirmed = await showCustomConfirm(confirmMessage, 'Sim, Excluir');
        if (!confirmed) return;

        try {
            const url = scope === 'single'
                ? `${API_BASE_URL}/incomes/${id}`
                : `${API_BASE_URL}/incomes/${id}/batch`;

            const options = {
                method: 'DELETE',
                headers: getHeaders()
            };

            if (scope !== 'single') {
                options.body = JSON.stringify({ scope });
            }

            const response = await fetch(url, options);

            if (response.ok) {
                const result = await response.json();
                const message = result.message || 'Entrada excluída com sucesso!';
                showToast(message, 'success');

                // Show info if some were skipped
                if (result.skipped && result.skipped > 0) {
                    setTimeout(() => {
                        showToast(`ℹ️ ${result.skipped} parcela(s) não puderam ser excluídas`, 'info');
                    }, 2000);
                }

                loadIncomes();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir entrada', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    // Custom confirmation dialog (matches system standard)
    const showCustomConfirm = (message, confirmText = 'Sim') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '100000';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.4)';

            const box = document.createElement('div');
            box.style.background = 'white';
            box.style.padding = '24px';
            box.style.borderRadius = '12px';
            box.style.maxWidth = '400px';
            box.style.width = '90%';
            box.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
            box.style.textAlign = 'center';

            box.innerHTML = `
                <h3 style="margin: 0 0 16px 0; color: var(--color-primary); font-size: 1.25rem;">Confirmação</h3>
                <p style="margin: 0 0 24px 0; color: #555; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="confirm-no" style="
                        background: transparent; border: 1px solid #ccc; padding: 8px 16px; 
                        border-radius: 6px; cursor: pointer; color: #555; font-weight: 500;">
                        Não
                    </button>
                    <button id="confirm-yes" style="
                        background: var(--color-primary); border: none; padding: 8px 16px; 
                        border-radius: 6px; cursor: pointer; color: white; font-weight: 500;">
                        ${confirmText}
                    </button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const closeConfirm = (val) => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
                resolve(val);
            };

            box.querySelector('#confirm-no').onclick = () => closeConfirm(false);
            box.querySelector('#confirm-yes').onclick = () => closeConfirm(true);
        });
    };

    // Danger confirmation dialog for destructive actions
    const showDangerConfirm = (title, message, confirmText = 'Confirmar') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '100000';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';

            const box = document.createElement('div');
            box.style.background = 'white';
            box.style.padding = '24px';
            box.style.borderRadius = '12px';
            box.style.maxWidth = '450px';
            box.style.width = '90%';
            box.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
            box.style.textAlign = 'center';
            box.style.border = '3px solid #DC2626';

            box.innerHTML = `
                <div style="background: #FEE2E2; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <h3 style="margin: 0; color: #DC2626; font-size: 1.3rem; font-weight: 700;">${title}</h3>
                </div>
                <p style="margin: 0 0 24px 0; color: #374151; line-height: 1.6; font-size: 1rem;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="confirm-no" style="
                        background: #F3F4F6; border: 1px solid #D1D5DB; padding: 10px 20px; 
                        border-radius: 6px; cursor: pointer; color: #374151; font-weight: 600; font-size: 1rem;">
                        Cancelar
                    </button>
                    <button id="confirm-yes" style="
                        background: #DC2626; border: none; padding: 10px 20px; 
                        border-radius: 6px; cursor: pointer; color: white; font-weight: 700; font-size: 1rem;
                        box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">
                        ${confirmText}
                    </button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const closeConfirm = (val) => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
                resolve(val);
            };

            box.querySelector('#confirm-no').onclick = () => closeConfirm(false);
            box.querySelector('#confirm-yes').onclick = () => closeConfirm(true);

            // Add hover effect to danger button
            const yesBtn = box.querySelector('#confirm-yes');
            yesBtn.onmouseenter = () => yesBtn.style.background = '#B91C1C';
            yesBtn.onmouseleave = () => yesBtn.style.background = '#DC2626';
        });
    };

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>💰 Entrada</h2>
            <div style="display: flex; gap: 0.5rem;">
                    <span style="font-size: 0.9rem; color: var(--color-primary);">Lar</span>
                    <span style="color: var(--color-text-muted);">/</span>
                    <span style="font-size: 0.9rem; color: var(--color-text-muted);">Entrada</span>
            </div>
        </div>

        <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
            <button id="btn-new-income" class="btn-primary">+ Nova Entrada</button>
            <div style="flex: 1;"></div>
            <button id="btn-excel" class="btn-outline">📊 Excel</button>
            <button id="btn-pdf" class="btn-outline">🖨️ PDF</button>
        </div>

        <div id="table-container" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
            <!-- SharedTable will render here -->
        </div>
        
        <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-top: 1px solid var(--color-border-light);">
            <div id="total-display"></div>
            <div class="pagination-controls" style="display: flex; gap: 0.5rem; align-items: center;"></div>
        </div>
    `;

    container.querySelector('#btn-new-income').addEventListener('click', createIncome);

    // Export Handlers
    container.querySelector('#btn-excel').onclick = () => {
        if (!incomes || incomes.length === 0) {
            showToast('Sem dados para exportar', 'warning');
            return;
        }

        // Prepare data for export
        const exportData = incomes.map(item => ({
            ...item,
            active: item.active ? 'Ativo' : 'Inativo'
        }));

        ExcelExporter.exportTable(
            exportData,
            columns.filter(c => c.key !== 'actions' && c.key !== 'link').map(c => ({
                header: c.label,
                key: c.key,
                width: parseInt(c.width) / 7 || 15, // Approx px to char width
                type: c.type
            })),
            'Relatório de Entradas',
            'entradas'
        );
    };

    container.querySelector('#btn-pdf').onclick = () => {
        PrintHelper.autoConfigureOrientation('#table-container table');
        window.print();
    };

    // Initialize SharedTable
    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        projectId: project.id,
        endpointPrefix: null, // Client-side distinct values for now
        onFilterChange: (filters) => {
            activeFilters = filters;
            loadIncomes(1);
        },
        onSortChange: (sort) => {
            sortConfig = sort;
            loadIncomes(1);
        },
        enableSelection: true,
        onSelectionChange: (items, ids) => {
            selectedItems = ids;
            selectedItemsData = items;
            renderPagination();
        }
    });

    const renderIncomes = () => {
        // Pass data to SharedTable
        sharedTable.render(incomes);
    };

    loadIncomes();

    return container;
};

