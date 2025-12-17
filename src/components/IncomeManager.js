import { IncomeModal } from './IncomeModal.js';
import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const IncomeManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.height = 'calc(100vh - 150px)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // State for filtering & pagination
    let incomes = [];
    let pagination = { page: 1, limit: 50, total: 0, pages: 1 };
    let activeFilters = {};
    let sortConfig = { key: 'data_fato', direction: 'desc' }; // Default server sort

    // Define Columns for SharedTable
    const columns = [
        { key: 'data_fato', label: 'Data Fato', width: '100px', align: 'center', type: 'date' },
        {
            key: 'data_prevista_recebimento',
            label: 'Data Prevista',
            width: '100px',
            align: 'center',
            type: 'date'
        },
        {
            key: 'data_real_recebimento',
            label: 'Data Real',
            width: '100px',
            align: 'center',
            type: 'date'
        },
        { key: 'tipo_entrada_name', label: 'Tipo Entrada', width: '200px', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        { key: 'company_name', label: 'Empresa', width: '150px', align: 'left', type: 'text' },
        { key: 'account_name', label: 'Conta', width: '150px', align: 'left', type: 'text' },
        { key: 'valor', label: 'Valor', width: '120px', align: 'right', type: 'currency', colorLogic: 'inflow' },
        {
            key: 'status',
            label: 'Status',
            width: '100px',
            align: 'center',
            noFilter: true,
            render: (item) => {
                let statusColor = '#F59E0B'; // Pending (Yellow)
                let statusTitle = 'Aguardando Pagamento';
                let statusText = 'Pendente';

                if (item.data_real_recebimento) {
                    statusColor = '#10B981'; // Received (Green)
                    statusTitle = 'Recebido';
                    statusText = 'Recebido';
                } else {
                    const today = new Date().toISOString().split('T')[0];
                    const prev = item.data_prevista_recebimento ? item.data_prevista_recebimento.split('T')[0] : '';
                    if (prev && prev < today) {
                        statusColor = '#EF4444'; // Overdue (Red)
                        statusTitle = 'Atrasado';
                        statusText = 'Atrasado';
                    }
                }

                const badge = document.createElement('div');
                badge.style.backgroundColor = statusColor;
                badge.style.color = 'white';
                badge.style.padding = '4px 8px';
                badge.style.borderRadius = '12px';
                badge.style.fontSize = '0.75rem';
                badge.style.fontWeight = '600';
                badge.style.display = 'inline-block';
                badge.textContent = statusText;
                badge.title = statusTitle;
                return badge;
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
            Object.keys(activeFilters).forEach(key => {
                const filter = activeFilters[key];
                if (!filter) return;

                if (key === 'valor') {
                    if (filter.min) params.append('minValue', filter.min);
                    if (filter.max) params.append('maxValue', filter.max);
                    // Handle advanced numeric filters if supported by backend, or map them
                    if (filter.operator) {
                        // Backend might not support operators yet, keeping basic min/max for now as per previous logic
                        // If SharedTable passes operator, we might need to adapt.
                        // For now, let's stick to min/max/text which are sure to work.
                    }
                } else if (key.startsWith('data')) {
                    if (filter.start) params.append('startDate', filter.start);
                    if (filter.end) params.append('endDate', filter.end);
                    // If filter.dateIn (list of dates) exists, we should handle it if backend supported it.
                } else {
                    if (filter.text) params.append('search', filter.text);
                    if (filter.val1 && filter.operator === 'contains') params.append('search', filter.val1);
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
            // Sorting is mostly client-side visual in SharedTable headers currently unless we pass sort params to backend
            // For now, loadIncomes ignores sortConfig params, but we can add them:
            // params.append('sortBy', sort.key); params.append('order', sort.direction);
            // Re-load to apply if supported.
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

