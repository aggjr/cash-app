import { IncomeModal } from './IncomeModal.js';
import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const IncomeManager = (project) => {
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

    // Define Columns for SharedTable
    const columns = [
        { key: 'data_fato', label: 'Dt Fato', width: '70px', align: 'left', type: 'date' },
        {
            key: 'data_prevista_recebimento',
            label: 'Dt Prevista',
            width: '70px',
            align: 'left',
            type: 'date'
        },
        { key: 'data_atraso', label: 'Dt Atraso', width: '70px', align: 'left', type: 'date' },
        {
            key: 'data_real_recebimento',
            label: 'Dt Real',
            width: '70px',
            align: 'left',
            type: 'date'
        },
        { key: 'tipo_entrada_name', label: 'Tipo Entrada', width: '200px', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        { key: 'company_name', label: 'Empresa', width: '150px', align: 'left', type: 'text' },
        { key: 'account_name', label: 'Conta', width: '150px', align: 'center', type: 'text' },
        { key: 'valor', label: 'Valor', width: '120px', align: 'right', type: 'currency', colorLogic: 'inflow' },
        {
            key: 'link',
            label: 'Link',
            width: '60px',
            align: 'center',
            type: 'link', // Explicit type for filter logic
            render: (item) => {
                const btn = document.createElement('button');
                btn.innerHTML = '📎'; // Paperclip
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
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteIncome(item.id, item.descricao); };

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

    const renderPagination = () => {
        const pagContainer = container.querySelector('.pagination-controls');
        if (!pagContainer) return;

        pagContainer.innerHTML = '';

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
            const totalVal = incomes.reduce((sum, inc) => sum + parseFloat(inc.valor || 0), 0);
            totalContainer.innerHTML = `
                <span style="font-size: 1.1rem; margin-right: 0.5rem;">Total (Página):</span>
                <span style="font-weight: 700; font-size: 1.1rem; color: ${totalVal >= 0 ? '#10B981' : '#EF4444'};">
                    ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal)}
                </span>
            `;
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
        await IncomeModal.show({
            income: income,
            projectId: project.id,
            onSave: async (incomeData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/incomes/${income.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify(incomeData)
                    });

                    if (response.ok) {
                        showToast('Entrada atualizada com sucesso!', 'success');
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

    const deleteIncome = async (id, description) => {
        if (!confirm(`Tem certeza que deseja excluir "${description || 'item'}"?`)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/incomes/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Entrada excluída com sucesso!', 'success');
                loadIncomes();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir entrada', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    // Initial Render of Container Structure
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>💰 Entrada</h2>
            <div style="display: flex; gap: 0.5rem;">
                    <span style="font-size: 0.9rem; color: var(--color-primary);">Lar</span>
                    <span style="color: var(--color-text-muted);">/</span>
                    <span style="font-size: 0.9rem; color: var(--color-text-muted);">Entrada</span>
            </div>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new-income" class="btn-primary">+ Nova Entrada</button>
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
        }
    });

    const renderIncomes = () => {
        // Pass data to SharedTable
        sharedTable.render(incomes);
    };

    loadIncomes();

    return container;
};

