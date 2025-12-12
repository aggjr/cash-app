import { IncomeModal } from './IncomeModal.js';
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

    const columns = [
        { key: 'data_fato', label: 'Data Fato', width: '90px', align: 'center', type: 'date' },
        { key: 'data_prevista_recebimento', label: 'Data Prevista', width: '90px', align: 'center', type: 'date' },
        { key: 'data_real_recebimento', label: 'Data Real', width: '90px', align: 'center', type: 'date' },
        { key: 'tipo_entrada_name', label: 'Tipo Entrada', width: '250px', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        { key: 'company_name', label: 'Empresa', width: '150px', align: 'left', type: 'text' },
        { key: 'account_name', label: 'Conta', width: '150px', align: 'left', type: 'text' },
        { key: 'valor', label: 'Valor', width: '100px', align: 'right', type: 'currency' },
        { key: 'actions', label: 'Ações', width: '80px', align: 'center', noFilter: true },
        { key: 'status', label: '', width: '40px', align: 'center', noFilter: true }
    ];

    const FILTER_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" class="filter-icon"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>`;

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Currency formatter
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    // Date formatter
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = dateString.includes('T')
            ? new Date(dateString)
            : new Date(dateString + 'T00:00:00');
        if (isNaN(date.getTime())) return 'Data Inválida';
        return date.toLocaleDateString('pt-BR');
    };

    // Helper to get formatted value for filtering
    const getValueForCol = (item, key) => {
        if (key.startsWith('data')) return formatDate(item[key]);
        if (key === 'valor') return formatCurrency(item[key]);
        if (key === 'descricao') return item.descricao || '-';
        return item[key] ? String(item[key]) : '';
    };

    const loadIncomes = async (page = 1) => {
        try {
            container.querySelector('.incomes-table-wrapper')?.classList.add('loading');

            const params = new URLSearchParams({
                projectId: project.id,
                page: page,
                limit: pagination.limit
            });

            // Map Filters to Query Params
            Object.keys(activeFilters).forEach(key => {
                const filter = activeFilters[key];
                if (!filter) return;

                if (key === 'valor') {
                    if (filter.min) params.append('minValue', filter.min);
                    if (filter.max) params.append('maxValue', filter.max);
                } else if (key.startsWith('data')) {
                    if (filter.start) params.append('startDate', filter.start);
                    if (filter.end) params.append('endDate', filter.end);
                } else {
                    // Text Search (Generic)
                    if (filter.text) params.append('search', filter.text);
                    // Handle Set/List values? 
                    // Backend refactor only supports generic search for now, 
                    // so we ignore specific value lists to avoid 400 errors or confusing behavior
                    // until backend supports column-specific filtering.
                }
            });

            const response = await fetch(`${API_BASE_URL}/incomes?${params.toString()}`, {
                headers: getHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Build detailed error message
                let errorMsg = errorData.error?.message || 'Erro desconhecido';
                if (errorData.error?.sqlError) {
                    const sql = errorData.error.sqlError;
                    errorMsg += ` [SQL: ${sql.sqlCode || 'N/A'} - ${sql.sqlMessage || ''}]`;
                    console.error('SQL Error Details:', sql);
                }
                if (errorData.error?.code) {
                    errorMsg = `[${errorData.error.code}] ${errorMsg}`;
                }
                throw new Error(errorMsg);
            }

            const result = await response.json();

            if (result.meta) {
                incomes = result.data;
                pagination = result.meta;
            } else {
                // Fallback for old API if something goes wrong
                incomes = Array.isArray(result) ? result : [];
                pagination = { page: 1, limit: incomes.length, total: incomes.length, pages: 1 };
            }

            renderIncomes(incomes);
        } catch (error) {
            console.error('Error loading incomes:', error);
            showToast(error.message || 'Erro ao carregar entradas', 'error');
        } finally {
            container.querySelector('.incomes-table-wrapper')?.classList.remove('loading');
        }
    };

    // Replaces applyFilters - now just triggers reload
    const applyFilters = () => {
        loadIncomes(1); // Reset to page 1 on filter change
    };

    // Replaces applySort - now just triggers reload (if we supported server sort)
    // For now, we keep local variables but server ignores them (fixed sort)
    const applySort = (items) => {
        // No-op for server side currently
        return items;
    };

    // Local definition removed. Imported from utils.


    const createIncome = async () => {
        const data = await IncomeModal.show({
            income: null,
            projectId: project.id,
            onSave: async (incomeData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/incomes`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            dataFato: incomeData.dataFato,
                            dataPrevistaRecebimento: incomeData.dataPrevistaRecebimento,
                            dataRealRecebimento: incomeData.dataRealRecebimento,
                            valor: incomeData.valor,
                            descricao: incomeData.descricao,
                            tipoEntradaId: incomeData.tipoEntradaId,
                            companyId: incomeData.companyId,
                            accountId: incomeData.accountId,
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
        const data = await IncomeModal.show({
            income: income,
            projectId: project.id,
            onSave: async (incomeData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/incomes/${income.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            dataFato: incomeData.dataFato,
                            dataPrevistaRecebimento: incomeData.dataPrevistaRecebimento,
                            dataRealRecebimento: incomeData.dataRealRecebimento,
                            valor: incomeData.valor,
                            descricao: incomeData.descricao,
                            tipoEntradaId: incomeData.tipoEntradaId,
                            companyId: incomeData.companyId,
                            accountId: incomeData.accountId,
                            active: incomeData.active
                        })
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
        const displayText = description || 'esta entrada';
        if (!confirm(`Tem certeza que deseja excluir "${displayText}"?`)) return;

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

    const getStatusBadge = (income) => {
        if (income.data_real_recebimento) {
            return '<span class="badge-active">✓ Recebido</span>';
        } else {
            return '<span class="badge-inactive">⏳ Pendente</span>';
        }
    };



    const showAdvancedMenu = (colKey, target) => {
        const existing = document.querySelector('.filter-dropdown');
        if (existing) existing.remove();

        const colDef = columns.find(c => c.key === colKey);
        const colType = colDef ? colDef.type : 'text';

        // Current state
        let extraDraft = {};
        if (activeFilters[colKey]) {
            // In new logic, activeFilters[key] is an object { min, max, start, end, text }
            extraDraft = { ...activeFilters[colKey] };
        }

        const menu = document.createElement('div');
        menu.className = 'filter-dropdown animate-float-in';
        menu.onclick = (e) => e.stopPropagation();

        // --- Text Search ---
        const searchDiv = document.createElement('div');
        searchDiv.className = 'filter-search';
        const searchInput = document.createElement('input');
        searchInput.placeholder = 'Pesquisar...';
        searchInput.value = extraDraft.text || '';
        searchInput.onclick = (e) => e.stopPropagation();
        searchInput.onchange = (e) => extraDraft.text = e.target.value;
        searchDiv.appendChild(searchInput);
        menu.appendChild(searchDiv);

        // --- Advanced Filters (Min/Max/Dates) ---
        const advancedDiv = document.createElement('div');
        advancedDiv.className = 'filter-advanced';
        advancedDiv.style.padding = '0.5rem';
        advancedDiv.style.borderTop = '1px solid var(--color-border-light)';

        if (colType === 'currency' || colType === 'number') {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '0.5rem';
            row.style.marginBottom = '0.5rem';

            const minInput = document.createElement('input');
            minInput.type = 'number';
            minInput.placeholder = 'Mín';
            minInput.style.width = '100%';
            minInput.value = extraDraft.min || '';
            minInput.onclick = (e) => e.stopPropagation();
            minInput.onchange = (e) => extraDraft.min = e.target.value;

            const maxInput = document.createElement('input');
            maxInput.type = 'number';
            maxInput.placeholder = 'Máx';
            maxInput.style.width = '100%';
            maxInput.value = extraDraft.max || '';
            maxInput.onclick = (e) => e.stopPropagation();
            maxInput.onchange = (e) => extraDraft.max = e.target.value;

            row.appendChild(minInput);
            row.appendChild(maxInput);
            advancedDiv.appendChild(row);
        } else if (colType === 'date') {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.gap = '0.5rem';

            const startInput = document.createElement('input');
            startInput.type = 'date';
            startInput.value = extraDraft.start || '';
            startInput.onclick = (e) => e.stopPropagation();
            startInput.onchange = (e) => extraDraft.start = e.target.value;

            const endInput = document.createElement('input');
            endInput.type = 'date';
            endInput.value = extraDraft.end || '';
            endInput.onclick = (e) => e.stopPropagation();
            endInput.onchange = (e) => extraDraft.end = e.target.value;

            row.appendChild(startInput);
            row.appendChild(endInput);
            advancedDiv.appendChild(row);
        }
        menu.appendChild(advancedDiv);

        // --- Actions ---
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'filter-actions';

        const btnCancel = document.createElement('button');
        btnCancel.className = 'filter-btn';
        btnCancel.textContent = 'Limpar';
        btnCancel.onclick = (e) => {
            e.stopPropagation();
            delete activeFilters[colKey];
            applyFilters();
            menu.remove();
        };

        const btnOk = document.createElement('button');
        btnOk.className = 'filter-btn primary';
        btnOk.textContent = 'Filtrar';
        btnOk.onclick = (e) => {
            e.stopPropagation();
            // Check if empty
            const isEmpty = !extraDraft.text && !extraDraft.min && !extraDraft.max && !extraDraft.start && !extraDraft.end;
            if (isEmpty) {
                delete activeFilters[colKey];
            } else {
                activeFilters[colKey] = extraDraft;
            }
            applyFilters();
            menu.remove();
        };

        actionsDiv.appendChild(btnCancel);
        actionsDiv.appendChild(btnOk);
        menu.appendChild(actionsDiv);

        // Positioning Logic (Fixed to Body)
        document.body.appendChild(menu);

        const rect = target.getBoundingClientRect();

        let top = rect.bottom + window.scrollY;
        let left = rect.left + window.scrollX;
        const menuWidth = 280;

        if (left + menuWidth > window.innerWidth) {
            left = (rect.right + window.scrollX) - menuWidth;
        }

        menu.style.position = 'absolute';
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.zIndex = '10000000';

        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target) && !target.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    };



    const renderIncomes = (incomes) => {

        const renderHeaders = () => {
            return columns.map(col => {
                const isActive = activeFilters[col.key];
                const iconClass = isActive ? 'filter-icon active' : 'filter-icon';

                // Sort State
                const isSortKey = sortConfig.key === col.key;
                const isAsc = isSortKey && sortConfig.direction === 'asc';
                const isDesc = isSortKey && sortConfig.direction === 'desc';

                // Opacity: Active = 1, Inactive = 0.3
                const ascOpacity = isAsc ? '1' : '0.3';
                const descOpacity = isDesc ? '1' : '0.3';
                const ascColor = isAsc ? 'var(--color-primary)' : 'inherit';
                const descColor = isDesc ? 'var(--color-primary)' : 'inherit';

                const content = col.noFilter
                    ? col.label
                    : `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                         <span style="flex: 1; text-align: ${col.align}; white-space: nowrap;">${col.label}</span>
                         <div style="display: flex; flex-direction: column; align-items: center; margin-left: 4px;">
                             <div class="filter-trigger" data-key="${col.key}" style="cursor: pointer; line-height: 0; margin-bottom: 2px;" title="Filtrar">
                                 ${FILTER_ICON.replace('filter-icon', iconClass)}
                             </div>
                             <div class="sort-controls" style="display: flex; gap: 4px; line-height: 1; font-size: 0.6rem;">
                                 <span class="sort-btn" data-key="${col.key}" data-dir="asc" title="Ordenar Crescente" 
                                       style="cursor: pointer; opacity: ${ascOpacity}; color: ${ascColor}; user-select: none;">▲</span>
                                 <span class="sort-btn" data-key="${col.key}" data-dir="desc" title="Ordenar Decrescente"
                                       style="cursor: pointer; opacity: ${descOpacity}; color: ${descColor}; user-select: none;">▼</span>
                             </div>
                         </div>
                       </div>`;

                return `<th style="text-align: ${col.align}; padding: 0.5rem; font-size: 0.85rem; width: ${col.width}; vertical-align: middle;">${content}</th>`;
            }).join('');
        };

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>💰 Entrada</h2>
                <div style="display: flex; gap: 0.5rem;">
                     <a href="#" style="font-size: 0.9rem; color: var(--color-primary);">Lar</a>
                     <span style="color: var(--color-text-muted);">/</span>
                     <span style="font-size: 0.9rem; color: var(--color-text-muted);">Entrada</span>
                </div>
            </div>

            <div style="margin-bottom: 1rem;">
                <button id="btn-new-income" class="btn-primary">+ Nova Entrada</button>
            </div>

            <div class="incomes-table-wrapper" style="flex: 1; overflow: auto; border: 1px solid var(--color-border-light); border-radius: 8px; box-shadow: var(--shadow-sm);">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead class="sticky-header">
                        <tr>${renderHeaders()}</tr>
                    </thead>
                    <tbody>
                        ${incomes.map((income, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
            let statusColor = '#F59E0B';
            let statusTitle = 'Aguardando Pagamento';
            if (income.data_real_recebimento) {
                statusColor = '#10B981';
                statusTitle = 'Recebido';
            } else {
                const today = new Date().toISOString().split('T')[0];
                const prev = income.data_prevista_recebimento ? income.data_prevista_recebimento.split('T')[0] : '';
                if (prev && prev < today) {
                    statusColor = '#EF4444';
                    statusTitle = 'Atrasado';
                }
            }

            return `
                                <tr style="border-bottom: 1px solid var(--color-border-light); background-color: ${bgColor}; transition: background 0.2s;" 
                                    onmouseover="this.style.background='rgba(218, 177, 119, 0.5)'" 
                                    onmouseout="this.style.background='${bgColor}'">
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; text-align: center;">${formatDate(income.data_fato)}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; text-align: center;">${formatDate(income.data_prevista_recebimento)}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; text-align: center;">${formatDate(income.data_real_recebimento)}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;" title="${income.tipo_entrada_name}">${income.tipo_entrada_name}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; color: #374151;">${income.descricao || '-'}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${income.company_name}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${income.account_name}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; text-align: right; font-weight: 600; color: ${parseFloat(income.valor) < 0 ? '#EF4444' : '#10B981'};">${formatCurrency(income.valor)}</td>
                                    <td style="padding: 0.25rem 0.5rem; text-align: center;">
                                        <button class="btn-edit" data-id="${income.id}" style="color: #10B981; margin-right: 0.25rem; font-size: 1rem; background: none; border: none; cursor: pointer;">✏️</button>
                                        <button class="btn-delete" data-id="${income.id}" style="color: #EF4444; font-size: 1rem; background: none; border: none; cursor: pointer;">🗑️</button>
                                    </td>
                                    <td style="padding: 0.25rem 0.5rem; text-align: center;">
                                        <div title="${statusTitle}" style="width: 12px; height: 12px; background-color: ${statusColor}; border-radius: 50%; margin: 0 auto; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"></div>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                        ${incomes.length === 0 ? `
                            <tr>
                                <td colspan="10" style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                                    <div style="font-size: 1.1rem;">Nenhuma entrada cadastrada</div>
                                    <div style="font-size: 0.9rem; margin-top: 0.5rem;">Clique em "Nova Entrada" para começar</div>
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--color-text-muted);">
                <div>
                     Total: ${pagination.total} registros
                     ${activeFilters && Object.keys(activeFilters).length > 0 ? '(Filtrado)' : ''}
                </div>
                
                <div class="pagination-controls" style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn-page-prev btn-sm" ${pagination.page <= 1 ? 'disabled' : ''} style="cursor: pointer; padding: 0.25rem 0.5rem;">◀ Anterior</button>
                    <span>Página ${pagination.page} de ${pagination.pages}</span>
                    <button class="btn-page-next btn-sm" ${pagination.page >= pagination.pages ? 'disabled' : ''} style="cursor: pointer; padding: 0.25rem 0.5rem;">Próxima ▶</button>
                </div>

                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 1.2rem;">Total (Página):</span>
                    <span style="font-weight: 700; font-size: 1.2rem; color: ${incomes.reduce((sum, inc) => sum + parseFloat(inc.valor || 0), 0) >= 0 ? '#10B981' : '#EF4444'};">
                        ${formatCurrency(incomes.reduce((sum, inc) => sum + parseFloat(inc.valor || 0), 0))}
                    </span>
                </div>
            </div>
        `;

        // Pagination Listeners
        const btnPrev = container.querySelector('.btn-page-prev');
        const btnNext = container.querySelector('.btn-page-next');
        if (btnPrev && !btnPrev.disabled) {
            btnPrev.addEventListener('click', () => loadIncomes(pagination.page - 1));
        }
        if (btnNext && !btnNext.disabled) {
            btnNext.addEventListener('click', () => loadIncomes(pagination.page + 1));
        }

        container.querySelectorAll('.filter-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                showAdvancedMenu(trigger.dataset.key, trigger);
            });
        });

        // Sort Listeners
        container.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = btn.dataset.key;
                const dir = btn.dataset.dir;
                sortConfig = { key, direction: dir };
                applyFilters(); // Re-applies filters AND sorts
            });
        });

        container.querySelector('#btn-new-income').addEventListener('click', createIncome);

        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const income = incomes.find(i => i.id == btn.dataset.id);
                updateIncome(income);
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const income = incomes.find(i => i.id == btn.dataset.id);
                deleteIncome(income.id, income.descricao);
            });
        });
    };

    loadIncomes();

    return container;
};

