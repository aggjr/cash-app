import { SaidaModal } from './SaidaModal.js';
import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';

export const SaidaManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '1rem';
    container.style.margin = '0.5rem';
    container.style.height = 'calc(100vh - 60px)';
    container.style.width = 'calc(100% - 1rem)';
    container.style.maxWidth = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // State for filtering & pagination
    let saidas = [];
    let pagination = { page: 1, limit: 50, total: 0, pages: 1 };
    let activeFilters = {};
    let sortConfig = { key: 'data_fato', direction: 'desc' };

    // Define Columns for SharedTable
    const columns = [
        { key: 'data_fato', label: 'Dt Fato', width: 'var(--col-date)', align: 'left', type: 'date' },
        {
            key: 'data_prevista_pagamento',
            label: 'Dt Prevista',
            width: 'var(--col-date)',
            align: 'left',
            type: 'date'
        },
        { key: 'data_prevista_atraso', label: 'Dt Atraso', width: 'var(--col-date)', align: 'left', type: 'date' },
        {
            key: 'data_real_pagamento',
            label: 'Dt Real',
            width: 'var(--col-date)',
            align: 'left',
            type: 'date'
        },
        { key: 'tipo_saida_name', label: 'Tipo Saída', width: 'var(--col-medium)', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        { key: 'company_name', label: 'Empresa', width: 'var(--col-small)', align: 'left', type: 'text' },
        { key: 'account_name', label: 'Conta', width: 'var(--col-small)', align: 'center', type: 'text' },
        { key: 'valor', label: 'Valor', width: 'var(--col-value)', align: 'right', type: 'currency', colorLogic: 'outflow' },
        {
            key: 'link',
            label: 'Link',
            width: 'var(--col-link)',
            align: 'center',
            type: 'link',
            noTextSearch: true,
            render: (item) => {
                const btn = document.createElement('button');
                btn.innerHTML = '📎';
                btn.style.background = 'none';
                btn.style.border = 'none';
                btn.style.fontSize = '1.2rem';
                btn.style.padding = '0';
                if (item.comprovante_url) {
                    btn.style.cursor = 'pointer';
                    btn.title = 'Ver anexo';
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        window.open(`${API_BASE_URL}${item.comprovante_url}`, '_blank');
                    };
                } else {
                    btn.style.cursor = 'default';
                    btn.style.opacity = '0.3';
                    btn.title = 'Sem anexo';
                }
                return btn;
            }
        },
        {
            key: 'actions',
            label: 'Ações',
            width: 'var(--col-actions)',
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
                btnEdit.onclick = (e) => { e.stopPropagation(); updateSaida(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteSaida(item.id, item.descricao); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        {
            key: 'status',
            label: '',
            width: 'var(--col-date-short)',
            align: 'center',
            noFilter: true,
            render: (item) => {
                let statusColor = '#F59E0B'; // Pending
                let statusTitle = 'Aguardando Pagamento';

                if (item.data_real_pagamento) {
                    statusColor = '#10B981'; // Paid
                    statusTitle = 'Pago';
                } else {
                    const today = new Date().toISOString().split('T')[0];
                    const prev = item.data_prevista_pagamento ? item.data_prevista_pagamento.split('T')[0] : '';
                    if (prev && prev < today) {
                        statusColor = '#EF4444'; // Overdue
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

    const loadSaidas = async (page = 1) => {
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
                    if (key === 'tipo_saida_name' && filter.text) params.append('tipoSaida', filter.text);

                    // Fallback or "Contains" generic operator if matched
                    if (filter.val1 && filter.operator === 'contains') {
                        if (key === 'descricao') params.append('description', filter.val1);
                        else if (key === 'account_name') params.append('account', filter.val1);
                        else if (key === 'company_name') params.append('company', filter.val1);
                        else if (key === 'tipo_saida_name') params.append('tipoSaida', filter.val1);
                        else params.append('search', filter.val1);
                    } else if (filter.text && !['descricao', 'account_name', 'company_name', 'tipo_saida_name'].includes(key)) {
                        params.append('search', filter.text);
                    }
                }
            });

            const response = await fetch(`${API_BASE_URL}/saidas?${params}`, {
                headers: getHeaders()
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Falha ao carregar saídas');
            }

            const result = await response.json();

            if (result.meta) {
                saidas = result.data;
                pagination = result.meta;
            } else {
                saidas = Array.isArray(result) ? result : [];
                pagination = { page: 1, limit: saidas.length, total: saidas.length, pages: 1 };
            }

            renderSaidas();
            renderPagination();

        } catch (error) {
            console.error('Error loading saidas:', error);
            showToast(error.message, 'error');
        } finally {
            container.querySelector('#table-container')?.classList.remove('loading');
        }
    };

    const renderPagination = () => {
        const pagContainer = container.querySelector('.pagination-controls');
        if (!pagContainer) return;

        pagContainer.innerHTML = '';

        const btnPrev = document.createElement('button');
        btnPrev.className = 'btn-sm';
        btnPrev.textContent = '◀ Anterior';
        btnPrev.disabled = pagination.page <= 1;
        btnPrev.onclick = () => loadSaidas(pagination.page - 1);

        const label = document.createElement('span');
        label.textContent = `Página ${pagination.page} de ${pagination.pages}`;
        label.style.margin = '0 1rem';

        const btnNext = document.createElement('button');
        btnNext.className = 'btn-sm';
        btnNext.textContent = 'Próxima ▶';
        btnNext.disabled = pagination.page >= pagination.pages;
        btnNext.onclick = () => loadSaidas(pagination.page + 1);

        pagContainer.appendChild(btnPrev);
        pagContainer.appendChild(label);
        pagContainer.appendChild(btnNext);

        // Update Total
        const totalContainer = container.querySelector('#total-display');
        if (totalContainer) {
            const totalVal = saidas.reduce((sum, inc) => sum + parseFloat(inc.valor || 0), 0);
            totalContainer.innerHTML = `
                <span style="font-size: 1.1rem; margin-right: 0.5rem;">Total (Página):</span>
                <span style="font-weight: 700; font-size: 1.1rem; color: #EF4444;">
                    ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal)}
                </span>
            `;
        }
    };

    const createSaida = async () => {
        await SaidaModal.show({
            saida: null,
            projectId: project.id,
            onSave: async (saidaData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/saidas`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            ...saidaData,
                            projectId: project.id
                        })
                    });

                    if (response.ok) {
                        showToast('Saída criada com sucesso!', 'success');
                        loadSaidas();
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao criar saída', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const updateSaida = async (saida) => {
        await SaidaModal.show({
            saida: saida,
            projectId: project.id,
            onSave: async (saidaData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/saidas/${saida.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify(saidaData)
                    });

                    if (response.ok) {
                        showToast('Saída atualizada com sucesso!', 'success');
                        loadSaidas();
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao atualizar saída', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const deleteSaida = async (id, description) => {
        const confirmed = await showCustomConfirm(`Tem certeza que deseja excluir "${description || 'item'}"?`, 'Sim, Excluir');
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/saidas/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Saída excluída com sucesso!', 'success');
                loadSaidas();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir saída', 'error');
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

    // Initial Render of Container Structure
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>💸 Saída</h2>
            <div style="display: flex; gap: 0.5rem;">
                    <span style="font-size: 0.9rem; color: var(--color-primary);">Lar</span>
                    <span style="color: var(--color-text-muted);">/</span>
                    <span style="font-size: 0.9rem; color: var(--color-text-muted);">Saída</span>
            </div>
        </div>

        <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
            <button id="btn-new-saida" class="btn-primary">+ Nova Saída</button>
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

    container.querySelector('#btn-new-saida').addEventListener('click', createSaida);

    // Export Handlers
    container.querySelector('#btn-excel').onclick = () => {
        if (!saidas || saidas.length === 0) {
            showToast('Sem dados para exportar', 'warning');
            return;
        }

        // Prepare data
        const exportData = saidas.map(item => ({
            ...item
        }));

        ExcelExporter.exportTable(
            exportData,
            columns.filter(c => c.key !== 'actions' && c.key !== 'link').map(c => ({
                header: c.label,
                key: c.key,
                width: parseInt(c.width) / 7 || 15,
                type: c.type
            })),
            'Relatório de Saídas',
            'saidas'
        );
    };

    container.querySelector('#btn-pdf').onclick = () => window.print();

    // Initialize SharedTable
    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        projectId: project.id,
        endpointPrefix: null, // Client-side distinct values for now
        onFilterChange: (filters) => {
            activeFilters = filters;
            loadSaidas(1);
        },
        onSortChange: (sort) => {
            sortConfig = sort;
            loadSaidas(1);
        }
    });

    const renderSaidas = () => {
        // Pass data to SharedTable
        sharedTable.render(saidas);
    };

    loadSaidas();

    return container;
};
