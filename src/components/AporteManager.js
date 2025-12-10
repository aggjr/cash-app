import { AporteModal } from './AporteModal.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const AporteManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.height = 'calc(100vh - 150px)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // State for filtering & pagination
    let aportes = [];
    let pagination = { page: 1, limit: 50, total: 0, pages: 1 };
    let activeFilters = {};
    let sortConfig = { key: 'data_fato', direction: 'desc' };

    const columns = [
        { key: 'data_fato', label: 'Data Fato', width: '100px', align: 'center', type: 'date' },
        { key: 'data_real', label: 'Data Real', width: '100px', align: 'center', type: 'date' },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        { key: 'company_name', label: 'Empresa', width: '200px', align: 'left', type: 'text' },
        { key: 'account_name', label: 'Conta', width: '200px', align: 'left', type: 'text' },
        { key: 'valor', label: 'Valor', width: '120px', align: 'right', type: 'currency' },
        { key: 'actions', label: 'Ações', width: '100px', align: 'center', noFilter: true },
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

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('pt-BR');
    };

    const loadAportes = async (page = 1) => {
        try {
            container.querySelector('.aportes-table-wrapper')?.classList.add('loading');

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
                    if (filter.text) params.append('search', filter.text);
                }
            });

            const response = await fetch(`${API_BASE_URL}/aportes?${params.toString()}`, {
                headers: getHeaders()
            });
            const result = await response.json();

            if (result.meta) {
                aportes = result.data;
                pagination = result.meta;
            } else {
                aportes = Array.isArray(result) ? result : [];
                pagination = { page: 1, limit: aportes.length, total: aportes.length, pages: 1 };
            }

            renderAportes(aportes);
        } catch (error) {
            console.error('Error loading aportes:', error);
            showToast('Erro ao carregar aportes', 'error');
        } finally {
            container.querySelector('.aportes-table-wrapper')?.classList.remove('loading');
        }
    };

    const applyFilters = () => {
        loadAportes(1);
    };

    const createAporte = async () => {
        const data = await AporteModal.show({
            aporte: null,
            projectId: project.id,
            onSave: async (aporteData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/aportes`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            dataFato: aporteData.dataFato,
                            dataReal: aporteData.dataReal,
                            valor: aporteData.valor,
                            descricao: aporteData.descricao,
                            companyId: aporteData.companyId,
                            accountId: aporteData.accountId,
                            projectId: project.id
                        })
                    });

                    if (response.ok) {
                        showToast('Aporte criado com sucesso!', 'success');
                        loadAportes();
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao criar aporte', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const updateAporte = async (aporte) => {
        const data = await AporteModal.show({
            aporte: aporte,
            projectId: project.id,
            onSave: async (aporteData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/aportes/${aporte.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            dataFato: aporteData.dataFato,
                            dataReal: aporteData.dataReal,
                            valor: aporteData.valor,
                            descricao: aporteData.descricao,
                            companyId: aporteData.companyId,
                            accountId: aporteData.accountId,
                            active: aporteData.active
                        })
                    });

                    if (response.ok) {
                        showToast('Aporte atualizado com sucesso!', 'success');
                        loadAportes();
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao atualizar aporte', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const deleteAporte = async (id, description) => {
        const displayText = description || 'este aporte';
        if (!confirm(`Tem certeza que deseja excluir "${displayText}"?`)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/aportes/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Aporte excluído com sucesso!', 'success');
                loadAportes();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir aporte', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const showAdvancedMenu = (colKey, target) => {
        const existing = document.querySelector('.filter-dropdown');
        if (existing) existing.remove();

        const colDef = columns.find(c => c.key === colKey);
        const colType = colDef ? colDef.type : 'text';

        let extraDraft = {};
        if (activeFilters[colKey]) {
            extraDraft = { ...activeFilters[colKey] };
        }

        const menu = document.createElement('div');
        menu.className = 'filter-dropdown animate-float-in';
        menu.onclick = (e) => e.stopPropagation();

        // Search Input
        const searchDiv = document.createElement('div');
        searchDiv.className = 'filter-search';
        const searchInput = document.createElement('input');
        searchInput.placeholder = 'Pesquisar...';
        searchInput.value = extraDraft.text || '';
        searchInput.onclick = (e) => e.stopPropagation();
        searchInput.onchange = (e) => extraDraft.text = e.target.value;
        searchDiv.appendChild(searchInput);
        menu.appendChild(searchDiv);

        // Advanced Inputs Logic ... (Same as IncomeManager but streamlined)
        // ... (Omitting full copy for brevity, assuming standard filter logic)
        // Re-implementing simplified logic for robustness:

        const advancedDiv = document.createElement('div');
        advancedDiv.className = 'filter-advanced';
        advancedDiv.style.padding = '0.5rem';
        advancedDiv.style.borderTop = '1px solid var(--color-border-light)';

        if (colType === 'currency' || colType === 'number') {
            const row = document.createElement('div');
            row.style.display = 'flex'; row.style.gap = '0.5rem';
            const minInput = document.createElement('input'); minInput.type = 'number'; minInput.placeholder = 'Mín'; minInput.value = extraDraft.min || '';
            minInput.onchange = (e) => extraDraft.min = e.target.value;
            const maxInput = document.createElement('input'); maxInput.type = 'number'; maxInput.placeholder = 'Máx'; maxInput.value = extraDraft.max || '';
            maxInput.onchange = (e) => extraDraft.max = e.target.value;
            row.append(minInput, maxInput); advancedDiv.append(row);
        } else if (colType === 'date') {
            const row = document.createElement('div'); row.style.display = 'flex'; row.style.flexDirection = 'column'; row.style.gap = '0.5rem';
            const sInput = document.createElement('input'); sInput.type = 'date'; sInput.value = extraDraft.start || '';
            sInput.onchange = (e) => extraDraft.start = e.target.value;
            const eInput = document.createElement('input'); eInput.type = 'date'; eInput.value = extraDraft.end || '';
            eInput.onchange = (e) => extraDraft.end = e.target.value;
            row.append(sInput, eInput); advancedDiv.append(row);
        }
        menu.appendChild(advancedDiv);

        // Actions
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'filter-actions';
        const btnOnlyClear = document.createElement('button'); btnOnlyClear.className = 'filter-btn'; btnOnlyClear.textContent = 'Limpar';
        btnOnlyClear.onclick = () => { delete activeFilters[colKey]; applyFilters(); menu.remove(); };
        const btnApply = document.createElement('button'); btnApply.className = 'filter-btn primary'; btnApply.textContent = 'Filtrar';
        btnApply.onclick = () => {
            const isEmpty = !extraDraft.text && !extraDraft.min && !extraDraft.max && !extraDraft.start && !extraDraft.end;
            if (isEmpty) delete activeFilters[colKey]; else activeFilters[colKey] = extraDraft;
            applyFilters(); menu.remove();
        };
        actionsDiv.append(btnOnlyClear, btnApply);
        menu.appendChild(actionsDiv);

        document.body.appendChild(menu);

        // Positioning
        const rect = target.getBoundingClientRect();
        let top = rect.bottom + window.scrollY;
        let left = rect.left + window.scrollX;
        if (left + 280 > window.innerWidth) left = (rect.right + window.scrollX) - 280;
        menu.style.position = 'absolute'; menu.style.top = top + 'px'; menu.style.left = left + 'px'; menu.style.zIndex = '10000';

        setTimeout(() => {
            const close = (e) => { if (!menu.contains(e.target) && !target.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
            document.addEventListener('click', close);
        }, 100);
    };

    const renderAportes = (items) => {
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>➕ Aportes</h2>
                 <div style="display: flex; gap: 0.5rem;">
                     <a href="#" style="font-size: 0.9rem; color: var(--color-primary);">Movimentações</a>
                     <span style="color: var(--color-text-muted);">/</span>
                     <span style="font-size: 0.9rem; color: var(--color-text-muted);">Aportes</span>
                </div>
            </div>

            <div style="margin-bottom: 1rem;">
                <button id="btn-new-aporte" class="btn-primary">+ Novo Aporte</button>
            </div>

            <div class="aportes-table-wrapper" style="flex: 1; overflow: auto; border: 1px solid var(--color-border-light); border-radius: 8px; box-shadow: var(--shadow-sm);">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead class="sticky-header">
                        <tr>
                            ${columns.map(col => {
            const isActive = !!activeFilters[col.key];
            const iconClass = isActive ? 'filter-icon active' : 'filter-icon';
            const content = col.noFilter ? col.label : `
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span>${col.label}</span>
                                        <div class="filter-trigger" data-key="${col.key}" style="cursor:pointer;">${FILTER_ICON.replace('filter-icon', iconClass)}</div>
                                    </div>
                                `;
            return `<th style="padding:0.75rem; text-align:${col.align}; border-bottom:2px solid #0c4a6e; background:#0c4a6e; color:white; font-weight:600;">${content}</th>`;
        }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#FFFFFF' : '#F9FAFB';
            return `
                                <tr style="background-color:${bgColor}; border-bottom:1px solid #eee;">
                                    <td style="padding:0.75rem; text-align:center;">${formatDate(item.data_fato)}</td>
                                    <td style="padding:0.75rem; text-align:center;">${formatDate(item.data_real)}</td>
                                    <td style="padding:0.75rem;">${item.descricao || '-'}</td>
                                    <td style="padding:0.75rem;">${item.company_name}</td>
                                    <td style="padding:0.75rem;">${item.account_name}</td>
                                    <td style="padding:0.75rem; text-align:right; font-weight:600; color:${parseFloat(item.valor) < 0 ? '#EF4444' : '#10B981'};">${formatCurrency(item.valor)}</td>
                                    <td style="padding:0.75rem; text-align:center;">
                                         <button class="btn-edit" data-id="${item.id}" style="color: #10B981; margin-right: 0.5rem; background:none; border:none; cursor:pointer;">✏️</button>
                                         <button class="btn-delete" data-id="${item.id}" style="color: #EF4444; background:none; border:none; cursor:pointer;">🗑️</button>
                                    </td>
                                    <td style="padding:0.75rem; text-align:center;">
                                        <div style="width:10px; height:10px; border-radius:50%; background-color:${item.data_real ? '#10B981' : '#F59E0B'};" title="${item.data_real ? 'Recebido' : 'Pendente'}"></div>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1rem; text-align: right; color: var(--color-text-muted); font-size: 0.9rem;">
                 <b>Total:</b> ${pagination.total} registros | 
                 <b style="color: ${items.reduce((acc, i) => acc + parseFloat(i.valor), 0) < 0 ? '#EF4444' : '#10B981'}; font-size: 1.1rem;">${formatCurrency(items.reduce((acc, i) => acc + parseFloat(i.valor), 0))}</b>
            </div>
        `;

        container.querySelector('#btn-new-aporte').onclick = createAporte;
        container.querySelectorAll('.filter-trigger').forEach(el => el.onclick = (e) => { e.stopPropagation(); showAdvancedMenu(el.dataset.key, el); });
        container.querySelectorAll('.btn-edit').forEach(el => el.onclick = () => updateAporte(items.find(i => i.id == el.dataset.id)));
        container.querySelectorAll('.btn-delete').forEach(el => el.onclick = () => deleteAporte(el.dataset.id, items.find(i => i.id == el.dataset.id).descricao));
    };

    loadAportes();
    return container;
};
