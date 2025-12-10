import { ProducaoRevendaModal } from './ProducaoRevendaModal.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const ProducaoRevendaManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.height = 'calc(100vh - 150px)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // State for filtering
    let allitems = [];
    let activeFilters = {}; // { key: Set }
    let sortConfig = { key: null, direction: 'asc' };

    console.log('ProducaoRevendaManager initialized with project:', project);

    if (!project || !project.id) {
        console.error('CRITICAL: Initialized without valid project ID!', project);
        showToast('Erro interno: ID do projeto não encontrado.', 'error');
        return container; // Stop execution
    }

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

    const applySort = (items) => {
        if (!sortConfig.key) return items;

        return [...items].sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            // Special handling
            if (sortConfig.key === 'valor') {
                valA = parseFloat(valA || 0);
                valB = parseFloat(valB || 0);
            } else if (sortConfig.key.startsWith('data')) {
                valA = new Date(valA || 0).getTime();
                valB = new Date(valB || 0).getTime();
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const applyFilters = () => {
        let filtered = [...allitems];
        const keys = Object.keys(activeFilters);

        if (keys.length > 0) {
            filtered = filtered.filter(item => {
                return keys.every(key => {
                    const filterState = activeFilters[key];
                    if (!filterState) return true;

                    // Support Legacy Set or New Object
                    let valuesSet, min, max, start, end, text;
                    if (filterState instanceof Set) {
                        valuesSet = filterState;
                    } else if (filterState && typeof filterState === 'object') {
                        valuesSet = filterState.values;
                        min = filterState.min;
                        max = filterState.max;
                        start = filterState.start;
                        end = filterState.end;
                        text = filterState.text;
                    } else {
                        return true;
                    }

                    // 1. Check Values List (if defined)
                    const val = getValueForCol(item, key);
                    if (valuesSet && !valuesSet.has(val)) return false;

                    // 2. Check Min/Max (Number/Currency)
                    if ((min !== undefined && min !== '') || (max !== undefined && max !== '')) {
                        const numVal = parseFloat(item[key] || 0);
                        if (min !== undefined && min !== '' && numVal < parseFloat(min)) return false;
                        if (max !== undefined && max !== '' && numVal > parseFloat(max)) return false;
                    }

                    // 3. Check Date Range
                    if (start || end) {
                        const itemDate = new Date(item[key]);
                        if (!isNaN(itemDate.getTime())) {
                            if (start) {
                                const startDate = new Date(start);
                                if (itemDate < startDate) return false;
                            }
                            if (end) {
                                const endDate = new Date(end);
                                if (itemDate > endDate) return false;
                            }
                        }
                    }

                    // 4. Check Text Contains
                    if (text) {
                        const searchStr = text.toLowerCase();
                        const rawMatch = String(item[key] || '').toLowerCase().includes(searchStr);
                        const fmtMatch = val.toLowerCase().includes(searchStr);
                        if (!rawMatch && !fmtMatch) return false;
                    }

                    return true;
                });
            });
        }

        filtered = applySort(filtered);
        renderTable(filtered);
    };

    const loadItems = async () => {
        try {
            container.querySelector('.items-table-wrapper')?.classList.add('loading');
            const response = await fetch(`${API_BASE_URL}/producao-revenda?projectId=${project.id}`, {
                headers: getHeaders()
            });

            if (!response.ok) {
                const error = await response.json();
                const msg = error.error?.message || error.error || 'Falha ao carregar itens';
                throw new Error(msg);
            }

            const items = await response.json();
            allitems = items;

            applyFilters();
        } catch (error) {
            console.error('Error loading items:', error);
            showToast(error.message || 'Erro ao carregar itens', 'error');
        }
    };

    const createItem = async () => {
        const data = await ProducaoRevendaModal.show({
            item: null,
            projectId: project.id,
            onSave: async (formData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/producao-revenda`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            ...formData,
                            projectId: project.id
                        })
                    });

                    if (response.ok) {
                        showToast('Item criado com sucesso!', 'success');
                        loadItems();
                    } else {
                        const error = await response.json();
                        const msg = error.error?.message || error.error || 'Erro ao criar item';
                        showToast(msg, 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const updateItem = async (item) => {
        const data = await ProducaoRevendaModal.show({
            item: item,
            projectId: project.id,
            onSave: async (formData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/producao-revenda/${item.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify(formData)
                    });

                    if (response.ok) {
                        showToast('Item atualizado com sucesso!', 'success');
                        loadItems();
                    } else {
                        const error = await response.json();
                        const msg = error.error?.message || error.error || 'Erro ao atualizar item';
                        showToast(msg, 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const deleteItem = async (id, description) => {
        const displayText = description || 'este item';
        if (!confirm(`Tem certeza que deseja excluir "${displayText}"?`)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/producao-revenda/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Item excluído com sucesso!', 'success');
                loadItems();
            } else {
                const error = await response.json();
                const msg = error.error?.message || error.error || 'Erro ao excluir item';
                showToast(msg, 'error');
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

        const uniqueValues = new Set();
        allitems.forEach(item => {
            uniqueValues.add(getValueForCol(item, colKey));
        });
        const sortedValues = Array.from(uniqueValues).sort();

        let currentState = activeFilters[colKey];
        let selectedDraft;
        let extraDraft = {};

        if (currentState instanceof Set) {
            selectedDraft = new Set(currentState);
        } else if (currentState && typeof currentState === 'object') {
            selectedDraft = new Set(currentState.values || uniqueValues);
            extraDraft = { ...currentState };
            delete extraDraft.values;
        } else {
            selectedDraft = new Set(uniqueValues);
        }

        const menu = document.createElement('div');
        menu.className = 'filter-dropdown animate-float-in';
        menu.onclick = (e) => e.stopPropagation();

        const advancedDiv = document.createElement('div');
        advancedDiv.style.padding = '8px';
        advancedDiv.style.borderBottom = '1px solid #E5E7EB';
        advancedDiv.style.display = 'flex';
        advancedDiv.style.flexDirection = 'column';
        advancedDiv.style.gap = '6px';

        if (colType === 'currency') {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '4px';
            const minInput = document.createElement('input');
            minInput.type = 'number';
            minInput.placeholder = 'Min';
            minInput.className = 'filter-input';
            minInput.value = extraDraft.min || '';
            minInput.onchange = (e) => extraDraft.min = e.target.value;

            const maxInput = document.createElement('input');
            maxInput.type = 'number';
            maxInput.placeholder = 'Max';
            maxInput.className = 'filter-input';
            maxInput.value = extraDraft.max || '';
            maxInput.onchange = (e) => extraDraft.max = e.target.value;

            row.appendChild(minInput);
            row.appendChild(maxInput);
            advancedDiv.appendChild(row);
        } else if (colType === 'date') {
            const startInput = document.createElement('input');
            startInput.type = 'date';
            startInput.className = 'filter-input';
            startInput.title = 'A partir de';
            startInput.value = extraDraft.start || '';
            startInput.onchange = (e) => extraDraft.start = e.target.value;

            const endInput = document.createElement('input');
            endInput.type = 'date';
            endInput.className = 'filter-input';
            endInput.title = 'Até';
            endInput.value = extraDraft.end || '';
            endInput.onchange = (e) => extraDraft.end = e.target.value;

            advancedDiv.appendChild(startInput);
            advancedDiv.appendChild(endInput);
        } else {
            const txtInput = document.createElement('input');
            txtInput.placeholder = 'Contém texto...';
            txtInput.className = 'filter-input';
            txtInput.value = extraDraft.text || '';
            txtInput.onchange = (e) => extraDraft.text = e.target.value;
            advancedDiv.appendChild(txtInput);
        }
        menu.appendChild(advancedDiv);

        const searchDiv = document.createElement('div');
        searchDiv.className = 'filter-search';
        const searchInput = document.createElement('input');
        searchInput.placeholder = 'Pesquisar na lista...';
        searchInput.onclick = (e) => e.stopPropagation();
        searchDiv.appendChild(searchInput);
        menu.appendChild(searchDiv);

        const listDiv = document.createElement('div');
        listDiv.className = 'filter-list';

        const createItem = (val, label, checked) => {
            const row = document.createElement('label');
            row.className = 'filter-item';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = checked;
            cb.value = val;

            cb.onchange = (e) => {
                if (val === '__ALL__') {
                    const allCbs = listDiv.querySelectorAll('input[type="checkbox"]:not([value="__ALL__"])');
                    allCbs.forEach(c => {
                        c.checked = e.target.checked;
                        if (e.target.checked) selectedDraft.add(c.value);
                        else selectedDraft.delete(c.value);
                    });
                } else {
                    if (e.target.checked) selectedDraft.add(val);
                    else selectedDraft.delete(val);

                    const allCb = listDiv.querySelector('input[value="__ALL__"]');
                    if (allCb) {
                        allCb.checked = selectedDraft.size === uniqueValues.size;
                    }
                }
            };
            const span = document.createElement('span');
            span.textContent = label;
            row.appendChild(cb);
            row.appendChild(span);
            return row;
        };

        const renderItems = (filterText = '') => {
            listDiv.innerHTML = '';
            const isAllSelected = selectedDraft.size === uniqueValues.size;
            listDiv.appendChild(createItem('__ALL__', '(Selecionar Tudo)', isAllSelected));

            sortedValues.forEach(val => {
                if (filterText && !String(val).toLowerCase().includes(filterText.toLowerCase())) return;
                const isChecked = selectedDraft.has(val);
                listDiv.appendChild(createItem(val, val === '' ? '(Vazio)' : val, isChecked));
            });
        };
        renderItems();
        searchInput.addEventListener('input', (e) => renderItems(e.target.value));
        menu.appendChild(listDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'filter-actions';

        const btnCancel = document.createElement('button');
        btnCancel.className = 'filter-btn';
        btnCancel.textContent = 'Cancelar';
        btnCancel.onclick = (e) => { e.stopPropagation(); menu.remove(); };

        const btnOk = document.createElement('button');
        btnOk.className = 'filter-btn primary';
        btnOk.textContent = 'OK';
        btnOk.onclick = (e) => {
            e.stopPropagation();
            const isAllValues = selectedDraft.size === uniqueValues.size;
            const hasExtra = Object.values(extraDraft).some(v => v);

            if (isAllValues && !hasExtra) {
                delete activeFilters[colKey];
            } else {
                activeFilters[colKey] = {
                    values: selectedDraft,
                    ...extraDraft
                };
            }
            applyFilters();
            menu.remove();
        };

        actionsDiv.appendChild(btnCancel);
        actionsDiv.appendChild(btnOk);
        menu.appendChild(actionsDiv);

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

    const columns = [
        { key: 'data_fato', label: 'Data Fato', width: '90px', align: 'center', type: 'date' },
        { key: 'data_prevista_pagamento', label: 'Data Prevista', width: '90px', align: 'center', type: 'date' },
        { key: 'data_real_pagamento', label: 'Data Real', width: '90px', align: 'center', type: 'date' },
        { key: 'tipo_name', label: 'Tipo', width: '250px', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        { key: 'company_name', label: 'Empresa', width: '150px', align: 'left', type: 'text' },
        { key: 'account_name', label: 'Conta', width: '150px', align: 'left', type: 'text' },
        { key: 'valor', label: 'Valor', width: '100px', align: 'right', type: 'currency' },
        { key: 'actions', label: 'Ações', width: '80px', align: 'center', noFilter: true },
        { key: 'status', label: '', width: '40px', align: 'center', noFilter: true }
    ];

    const renderTable = (items) => {
        const renderHeaders = () => {
            return columns.map(col => {
                const isActive = activeFilters[col.key];
                const iconClass = isActive ? 'filter-icon active' : 'filter-icon';
                const isSortKey = sortConfig.key === col.key;
                const isAsc = isSortKey && sortConfig.direction === 'asc';
                const isDesc = isSortKey && sortConfig.direction === 'desc';
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
                <h2>🏭 Produção / Revenda</h2>
                <div style="display: flex; gap: 0.5rem;">
                     <a href="#" style="font-size: 0.9rem; color: var(--color-primary);">Lar</a>
                     <span style="color: var(--color-text-muted);">/</span>
                     <span style="font-size: 0.9rem; color: var(--color-text-muted);">produção revenda</span>
                </div>
            </div>

            <div style="margin-bottom: 1rem;">
                <button id="btn-new" class="btn-primary">+ Novo Item</button>
            </div>

            <div class="items-table-wrapper" style="flex: 1; overflow: auto; border: 1px solid var(--color-border-light); border-radius: 8px; box-shadow: var(--shadow-sm);">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead class="sticky-header">
                        <tr>${renderHeaders()}</tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
            let statusColor = '#F59E0B';
            let statusTitle = 'Aguardando Pagamento';
            if (item.data_real_pagamento) {
                statusColor = '#10B981';
                statusTitle = 'Recebido';
            } else {
                const today = new Date().toISOString().split('T')[0];
                const prev = item.data_prevista_pagamento ? item.data_prevista_pagamento.split('T')[0] : '';
                if (prev && prev < today) {
                    statusColor = '#EF4444';
                    statusTitle = 'Atrasado';
                }
            }

            return `
                                <tr style="border-bottom: 1px solid var(--color-border-light); background-color: ${bgColor}; transition: background 0.2s;" 
                                    onmouseover="this.style.background='rgba(218, 177, 119, 0.5)'" 
                                    onmouseout="this.style.background='${bgColor}'">
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; text-align: center;">${formatDate(item.data_fato)}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; text-align: center;">${formatDate(item.data_prevista_pagamento)}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; text-align: center;">${formatDate(item.data_real_pagamento)}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;" title="${item.tipo_name}">${item.tipo_name}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; color: #374151;">${item.descricao || '-'}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${item.company_name}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${item.account_name}</td>
                                    <td style="padding: 0.25rem 0.5rem; font-size: 0.8rem; text-align: right; font-weight: 600; color: ${parseFloat(item.valor) > 0 ? '#EF4444' : '#10B981'};">${formatCurrency(item.valor)}</td>
                                    <td style="padding: 0.25rem 0.5rem; text-align: center;">
                                        <button class="btn-edit" data-id="${item.id}" style="color: #10B981; margin-right: 0.25rem; font-size: 1rem; background: none; border: none; cursor: pointer;">✏️</button>
                                        <button class="btn-delete" data-id="${item.id}" style="color: #EF4444; font-size: 1rem; background: none; border: none; cursor: pointer;">🗑️</button>
                                    </td>
                                    <td style="padding: 0.25rem 0.5rem; text-align: center;">
                                        <div title="${statusTitle}" style="width: 12px; height: 12px; background-color: ${statusColor}; border-radius: 50%; margin: 0 auto; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"></div>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                        ${items.length === 0 ? `
                            <tr>
                                <td colspan="10" style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                                    <div style="font-size: 1.1rem;">Nenhum item cadastrado</div>
                                    <div style="font-size: 0.9rem; margin-top: 0.5rem;">Clique em "+ Novo Item" para começar</div>
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--color-text-muted);">
                <div>Total: ${activeFilters && Object.keys(activeFilters).length > 0 ? `Exibindo ${items.length} de ${allitems.length}` : `${items.length} item(ns)`}</div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span>Valor Total:</span>
                    <span style="font-weight: 700; font-size: 1.4rem; color: ${items.reduce((sum, inc) => sum + parseFloat(inc.valor || 0), 0) > 0 ? '#EF4444' : '#10B981'};">
                        ${formatCurrency(items.reduce((sum, inc) => sum + parseFloat(inc.valor || 0), 0))}
                    </span>
                </div>
            </div>
        `;

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

                if (sortConfig.key === key && sortConfig.direction === dir) {
                    sortConfig = { key: null, direction: 'asc' }; // Toggle off
                } else {
                    sortConfig = { key, direction: dir };
                }
                applySort(allitems);
                // Re-apply filters which calls render
                applyFilters();
            });
        });

        container.querySelector('#btn-new').addEventListener('click', createItem);

        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = items.find(d => d.id == btn.dataset.id);
                updateItem(item);
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = items.find(d => d.id == btn.dataset.id);
                deleteItem(item.id, item.descricao);
            });
        });
    };

    loadItems();

    return container;
};
