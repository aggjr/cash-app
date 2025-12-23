import { getApiBaseUrl } from '../utils/apiConfig.js';

export class SharedTable {
    constructor({ container, columns, projectId, endpointPrefix, onFilterChange, onSortChange }) {
        this.container = container;
        this.columns = columns;
        this.projectId = projectId;
        this.endpointPrefix = endpointPrefix; // If null, assumes client-side distinct values from passed data
        this.onFilterChange = onFilterChange;
        this.onSortChange = onSortChange;
        this.API_BASE_URL = getApiBaseUrl();

        // State
        this.activeFilters = {};
        this.sortConfig = { key: null, direction: 'desc' };
        this.scrollState = { top: 0, left: 0 };
        this.currentData = []; // Store current data for local distinct calculation
    }

    getHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        // Handle ISO strings or YYYY-MM-DD strings manually to avoid Timezone shifts (e.g. UTC -> GMT-3)
        // This ensures what is seen is exactly what was stored YYYY-MM-DD
        if (typeof dateString === 'string' && dateString.length >= 10) {
            const datePart = dateString.substring(0, 10);
            const [year, month, day] = datePart.split('-');
            return `${day}/${month}/${year}`;
        }

        // Fallback for Date objects or other formats
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('pt-BR');
    }

    getValueForCol(item, key) {
        if (key.startsWith('data')) return this.formatDate(item[key]);
        if (key === 'valor') return this.formatCurrency(item[key]);
        // Handle nested properties (e.g. company_name)
        // If key is mapped in columns definition, maybe use that?
        // But here we rely on the item having flat props (like income object has 'company_name' from SQL)
        if (item[key] !== undefined) return item[key];
        return '';
    }

    saveScrollPosition() {
        const wrapper = this.container.querySelector('.table-wrapper');
        if (wrapper) {
            this.scrollState = {
                top: wrapper.scrollTop,
                left: wrapper.scrollLeft
            };
        }
    }

    restoreScrollPosition() {
        const wrapper = this.container.querySelector('.table-wrapper');
        if (wrapper) {
            wrapper.scrollTop = this.scrollState.top;
            wrapper.scrollLeft = this.scrollState.left;
        }
    }

    render(data) {
        this.currentData = data;

        // Client Side Sort Fallback (if no server sort handler provided)
        if (!this.onSortChange && this.sortConfig.key) {
            const key = this.sortConfig.key;
            const dir = this.sortConfig.direction === 'desc' ? -1 : 1;
            const colDef = this.columns.find(c => c.key === key);
            const type = colDef ? colDef.type : 'text';

            this.currentData.sort((a, b) => {
                let valA = a[key] || '';
                let valB = b[key] || '';

                if (type === 'date') {
                    // Handle ISO strings or YYYY-MM-DD
                    const dateA = new Date(valA).getTime() || 0;
                    const dateB = new Date(valB).getTime() || 0;
                    return (dateA - dateB) * dir;
                }
                if (type === 'currency' || type === 'number') {
                    return (Number(valA) - Number(valB)) * dir;
                }
                // String default
                return String(valA).localeCompare(String(valB)) * dir;
            });
        }

        this.saveScrollPosition();

        this.container.innerHTML = ''; // Clear

        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';
        wrapper.style.overflow = 'auto';
        wrapper.style.flex = '1';
        wrapper.style.border = '1px solid var(--color-border-light)';
        wrapper.style.borderRadius = '8px';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '0.9rem';

        // Header
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        trHead.style.backgroundColor = 'var(--color-primary)';
        trHead.style.color = 'white';
        trHead.style.position = 'sticky';
        trHead.style.top = '0';
        trHead.style.zIndex = '10';
        trHead.innerHTML = this.renderHeaderContent();
        thead.appendChild(trHead);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        if (data.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="${this.columns.length}" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">Nenhum registro encontrado.</td>`;
            tbody.appendChild(tr);
        } else {
            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = 'hoverable-row';
                tr.style.borderBottom = '1px solid var(--color-background)';

                this.columns.forEach(col => {
                    const td = document.createElement('td');
                    td.style.padding = '0.75rem 0.5rem';
                    td.style.textAlign = col.align || 'left';
                    td.style.whiteSpace = 'nowrap';
                    if (col.width) td.style.width = col.width;

                    if (col.render) {
                        const content = col.render(item);
                        if (content instanceof Node) td.appendChild(content);
                        else td.innerHTML = content;
                    } else if (col.type === 'currency') {
                        const val = item[col.key];
                        td.textContent = this.formatCurrency(val);
                        if (col.colorLogic) {
                            const num = parseFloat(val || 0);
                            let color = '';
                            if (col.colorLogic === 'blue') {
                                color = '#3B82F6'; // Blue
                            } else {
                                let isPositiveColor = false;
                                if (col.colorLogic === 'inflow') isPositiveColor = num >= 0;
                                else if (col.colorLogic === 'outflow') isPositiveColor = num < 0;
                                color = isPositiveColor ? '#10B981' : '#EF4444';
                            }

                            td.style.color = color;
                            td.style.fontWeight = '600';
                        }
                    } else {
                        td.textContent = this.getValueForCol(item, col.key);
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }
        table.appendChild(tbody);
        wrapper.appendChild(table);
        this.container.appendChild(wrapper);

        this.attachHeaderEvents(trHead);
        this.restoreScrollPosition();
    }

    renderHeaderContent() {
        const FILTER_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" class="filter-icon" width="14" height="14"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>`;

        return this.columns.map(col => {
            const isActive = this.activeFilters[col.key];
            const color = isActive ? 'white' : 'rgba(255, 255, 255, 0.6)';

            // Sort State
            const isSortKey = this.sortConfig.key === col.key;
            const isAsc = isSortKey && this.sortConfig.direction === 'asc';
            const isDesc = isSortKey && this.sortConfig.direction === 'desc';

            const ascOpacity = isAsc ? '1' : '0.3';
            const descOpacity = isDesc ? '1' : '0.3';

            // Flex Alignment Logic - Always Center Headers
            const justify = 'center';
            const labelColor = isActive ? 'var(--color-gold)' : 'white';
            const spanStyle = `text-align: center; white-space: nowrap; font-weight: 600; color: ${labelColor};`;
            const containerStyle = `display: flex; align-items: center; justify-content: ${justify}; width: 100%; gap: 6px;`;

            // Spacer for center alignment balance
            const spacer = (col.align === 'center') ? '<div style="width: 14px; flex-shrink: 0;"></div>' : '';

            const content = col.noFilter
                ? col.label
                : `<div class="header-sort-trigger" data-key="${col.key}" style="${containerStyle} cursor: pointer;" title="Clique para ordenar">
                     ${spacer}
                     <span style="${spanStyle}">${col.label}</span>
                     <div style="display: flex; flex-direction: column; align-items: center; margin-left: 0; width: 14px; flex-shrink: 0;">
                         <div class="filter-trigger" data-key="${col.key}" style="cursor: pointer; line-height: 0; margin-bottom: 2px;" title="Filtrar">
                             <span style="color: ${color}">${FILTER_ICON}</span>
                         </div>
                         <div class="sort-controls" style="display: flex; gap: 4px; line-height: 1; font-size: 0.6rem;">
                             <span class="sort-btn" data-key="${col.key}" data-dir="asc" title="Ordenar Crescente" 
                                   style="cursor: pointer; opacity: ${ascOpacity}; color: white; user-select: none;">▲</span>
                             <span class="sort-btn" data-key="${col.key}" data-dir="desc" title="Ordenar Decrescente"
                                   style="cursor: pointer; opacity: ${descOpacity}; color: white; user-select: none;">▼</span>
                         </div>
                     </div>
                   </div>`;

            return `<th style="text-align: ${col.align || 'left'}; padding: 0.75rem 0.5rem; font-size: 0.9rem; width: ${col.width || 'auto'}; vertical-align: middle; color: white;">${content}</th>`;
        }).join('');
    }

    attachHeaderEvents(headerRow) {
        headerRow.querySelectorAll('.header-sort-trigger').forEach(trigger => {
            trigger.onclick = (e) => {
                // Ignore if clicked on filter trigger or specific sort btn (handled separately)
                // Actually sort-btns are inside, so event bubbling hits this. 
                // We must ensure we don't double-trigger if sort-btn is clicked.
                // But sort-btn stops propagation? Yes. Line 244.
                // Filter stops propagation? Yes. Line 237.
                // So this only fires for Label/Background.

                const key = trigger.dataset.key;
                const col = this.columns.find(c => c.key === key);
                if (!col) return;

                let dir = 'asc';
                if (this.sortConfig.key === key) {
                    // Toggle
                    dir = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    // Default for new column - Smart Defaults
                    if (col.type === 'date' || col.type === 'datetime') dir = 'desc';
                }

                this.sortConfig = { key, direction: dir };
                if (this.onSortChange) this.onSortChange(this.sortConfig);
            };
        });

        headerRow.querySelectorAll('.filter-trigger').forEach(trigger => {
            trigger.onclick = (e) => {
                e.stopPropagation();
                this.showAdvancedMenu(trigger.dataset.key, trigger);
            };
        });

        headerRow.querySelectorAll('.sort-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation(); // Prevents triggering header-sort-trigger
                const key = btn.dataset.key;
                const dir = btn.dataset.dir;
                this.sortConfig = { key, direction: dir };
                if (this.onSortChange) this.onSortChange(this.sortConfig);
            };
        });
    }

    showAdvancedMenu(colKey, target) {
        const existing = document.querySelector('.filter-dropdown');
        if (existing) existing.remove();

        const colDef = this.columns.find(c => c.key === colKey);
        const colType = colDef ? colDef.type : 'text';

        // Filter out columns explicitly marked as noFilter (but if we are here, trigger was clicked, so maybe allow specific overrides?)
        // The Link column was strictly marked noFilter previously. We need to remove that in IncomeManager.
        // But assuming we enabled it, let's handle 'link' type.

        let extraDraft = { ...this.activeFilters[colKey] } || {};

        // Helper: Execute Filter
        const executeFilter = () => {
            // Check Empty - Updated to handle operator-based filters
            const isEmpty = !extraDraft.text && !extraDraft.min && !extraDraft.max && !extraDraft.start && !extraDraft.end
                && (!extraDraft.value || extraDraft.value === 'all')
                && !extraDraft.operator
                && !extraDraft.val1 && !extraDraft.val2
                && (!extraDraft.numIn || extraDraft.numIn.length === 0 || extraDraft.numIn.includes(-999999))
                && (!extraDraft.textIn || extraDraft.textIn.length === 0)
                && (!extraDraft.dateIn || extraDraft.dateIn.length === 0);

            // Reset all active filters (Single Filter Mode)
            this.activeFilters = {};

            if (!isEmpty) {
                this.activeFilters[colKey] = extraDraft;
            }

            console.group('🔍 SharedTable Filter Debug');
            console.log('Column:', colKey);
            console.log('Draft State:', JSON.stringify(extraDraft, null, 2));
            console.log('Is Empty:', isEmpty);
            console.log('Active Filters (Final):', JSON.stringify(this.activeFilters, null, 2));
            console.groupEnd();

            if (this.onFilterChange) this.onFilterChange(this.activeFilters);
            menu.remove();
        };

        // Helper: Handle Keydown (Enter/Esc)
        const handleKeydown = (e, opView, lstView) => {
            if (e.key === 'Enter') {
                e.preventDefault(); e.stopPropagation(); executeFilter();
            } else if (e.key === 'Escape') {
                e.preventDefault(); e.stopPropagation();
                if (opView && opView.style.display !== 'none') {
                    opView.style.display = 'none';
                    if (lstView) lstView.style.display = 'flex';
                } else {
                    menu.remove();
                }
            }
        };

        const menu = document.createElement('div');
        menu.className = 'filter-dropdown animate-float-in';
        menu.style.position = 'absolute';
        menu.style.zIndex = '1000';
        menu.style.backgroundColor = 'white';
        menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        menu.style.borderRadius = '8px';
        menu.style.border = '1px solid var(--color-border-light)';
        menu.style.minWidth = '220px';
        menu.style.padding = '0.5rem';

        menu.onclick = (e) => e.stopPropagation();

        // --- Standard Text Filter ---
        // REMOVED as per user request (redundant with list search)
        // If we need a simple text filter fallback for non-text/non-special columns, we can keep it,
        // but 'text' type now has the list view with search.
        // Checking types that do NOT have advanced filters:
        // boolean, date, currency, number, link, text (advanced).
        // So practically everything is covered.


        // --- Boolean Filter ---
        if (colType === 'boolean' || colType === 'link') {
            const boolDiv = document.createElement('div');
            boolDiv.style.display = 'flex';
            boolDiv.style.flexDirection = 'column';
            ['all', 'true', 'false'].forEach(val => {
                const lbl = val === 'all' ? 'Todos' : (val === 'true' ? 'Com Arquivo' : 'Sem Arquivo');
                const label = document.createElement('label');
                label.style.display = 'flex'; label.style.gap = '0.5rem'; label.style.cursor = 'pointer';
                const radio = document.createElement('input');
                radio.type = 'radio'; radio.name = 'bool-filter'; radio.value = val;
                radio.checked = (extraDraft.value || 'all') === val;
                radio.onclick = (e) => { e.stopPropagation(); extraDraft.value = val; };
                label.appendChild(radio); label.appendChild(document.createTextNode(lbl));
                boolDiv.appendChild(label);
            });
            menu.appendChild(boolDiv);
        }

        // --- Advanced Number/Currency Filter ---
        const advancedDiv = document.createElement('div');
        advancedDiv.className = 'filter-advanced';
        advancedDiv.style.marginTop = '0.5rem';
        advancedDiv.style.borderTop = '1px solid var(--color-border-light)';
        advancedDiv.style.paddingTop = '0.5rem';

        if (colType === 'currency' || colType === 'number') {
            const wrapper = document.createElement('div');

            // View 1: List View
            const listView = document.createElement('div');
            listView.style.display = 'flex';
            listView.style.flexDirection = 'column';
            listView.style.gap = '0.5rem';

            const btnAdv = document.createElement('div');
            btnAdv.innerHTML = '<span>Filtros de Número</span> <span>&gt;</span>';
            btnAdv.style.padding = '0.5rem';
            btnAdv.style.cursor = 'pointer';
            btnAdv.style.display = 'flex';
            btnAdv.style.justifyContent = 'space-between';
            btnAdv.style.backgroundColor = '#f9f9f9';
            btnAdv.style.borderRadius = '4px';
            btnAdv.onclick = (e) => {
                e.stopPropagation();
                listView.style.display = 'none';
                operatorView.style.display = 'flex';
            };
            listView.appendChild(btnAdv);

            // Search Box for List
            const listSearch = document.createElement('input');
            listSearch.className = 'form-input';
            listSearch.placeholder = 'Pesquisar...';

            // Initialize with current filter value if exists (and is exact match)
            if (extraDraft.operator === 'eq' && extraDraft.val1 !== undefined && extraDraft.val1 !== null) {
                listSearch.value = parseFloat(extraDraft.val1).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            }

            listSearch.style.width = '100%';
            listSearch.onclick = e => e.stopPropagation();
            listSearch.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); e.stopPropagation();
                    // Smart Behavior: Treat as Equals filter if numeric
                    const val = parseFloat(listSearch.value.replace(',', '.'));
                    if (!isNaN(val)) {
                        console.log('Smart Filter (Enter): EQ', val);
                        extraDraft.operator = 'eq';
                        extraDraft.val1 = val;
                        delete extraDraft.numIn; // Priority to explicit value
                        executeFilter();
                    }
                }
            };
            listSearch.oninput = (e) => {
                const term = e.target.value.toLowerCase();

                // Smart Behavior: Update draft state if it looks like a number
                const val = parseFloat(term.replace(',', '.'));
                if (!isNaN(val) && term.trim() !== '') {
                    extraDraft.operator = 'eq';
                    extraDraft.val1 = val;
                    // We don't delete numIn here yet, to allow checkbox interactions still
                } else {
                    // If cleared, remove operator if it was 'eq'
                    if (extraDraft.operator === 'eq') {
                        delete extraDraft.operator;
                        delete extraDraft.val1;
                    }
                }

                listContainer.querySelectorAll('.val-row').forEach(row => {
                    const txt = row.textContent.toLowerCase();
                    row.style.display = txt.includes(term) ? 'flex' : 'none';
                });
            };
            listView.appendChild(listSearch);

            // List Filter
            const listContainer = document.createElement('div');
            listContainer.style.maxHeight = '200px';
            listContainer.style.overflowY = 'auto';
            listContainer.style.border = '1px solid #eee';
            listContainer.style.borderRadius = '4px';
            listContainer.style.padding = '4px';
            listContainer.innerHTML = '<div>Carregando...</div>';
            listView.appendChild(listContainer);

            // Fetch Distinct Logic
            const loadValues = async () => {
                let values = [];
                if (this.endpointPrefix) {
                    const r = await fetch(`${this.API_BASE_URL}${this.endpointPrefix}/distinct-values?projectId=${this.projectId}&field=${colKey}`, { headers: this.getHeaders() });
                    values = await r.json();
                } else {
                    // Client Side Distinct
                    values = [...new Set(this.currentData.map(item => item[colKey]))].sort((a, b) => a - b);
                }

                listContainer.innerHTML = '';
                // "Select All" Logic
                const allCb = document.createElement('input'); allCb.type = 'checkbox';
                const isFiltered = this.activeFilters[colKey]?.numIn?.length > 0 && !this.activeFilters[colKey].numIn.includes(-999999);
                allCb.checked = !isFiltered;

                const updateAll = (chk) => {
                    listContainer.querySelectorAll('.val-cb').forEach(c => c.checked = chk);
                    if (chk) {
                        extraDraft.numIn = [];
                        // Clear Operator
                        delete extraDraft.operator; delete extraDraft.val1; delete extraDraft.val2;
                    }
                    else extraDraft.numIn = [-999999];
                };
                allCb.onclick = (e) => { e.stopPropagation(); updateAll(e.target.checked); };

                const allRow = document.createElement('div');
                allRow.style.display = 'flex'; allRow.style.gap = '0.5rem'; allRow.style.padding = '4px'; allRow.style.borderBottom = '1px solid #eee';
                allRow.appendChild(allCb); allRow.appendChild(document.createTextNode('(Selecionar Tudo)'));
                listContainer.appendChild(allRow);

                // Values
                values.forEach(v => {
                    const row = document.createElement('div');
                    row.className = 'val-row';
                    row.style.display = 'flex'; row.style.gap = '0.5rem'; row.style.padding = '2px';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox'; cb.className = 'val-cb'; cb.value = v;
                    cb.checked = isFiltered ? this.activeFilters[colKey]?.numIn?.includes(v) : true;

                    cb.onclick = (e) => {
                        e.stopPropagation();
                        if (allCb.checked && !e.target.checked) {
                            extraDraft.numIn = values.filter(x => x !== v);
                            allCb.checked = false;
                        } else if (extraDraft.numIn?.includes(-999999) && e.target.checked) {
                            extraDraft.numIn = [v];
                        } else {
                            if (!extraDraft.numIn) extraDraft.numIn = [];
                            if (e.target.checked) {
                                if (extraDraft.numIn.length > 0 && !extraDraft.numIn.includes(v)) extraDraft.numIn.push(v);
                            } else {
                                extraDraft.numIn = extraDraft.numIn.filter(x => x !== v);
                            }
                        }

                        const allChecked = Array.from(listContainer.querySelectorAll('.val-cb')).every(c => c.checked);
                        allCb.checked = allChecked;
                        if (allChecked) extraDraft.numIn = [];

                        // Clear Operator
                        delete extraDraft.operator; delete extraDraft.val1; delete extraDraft.val2;
                    };
                    row.appendChild(cb);
                    row.appendChild(document.createTextNode(colType === 'currency' ? this.formatCurrency(v) : v));
                    listContainer.appendChild(row);
                });
            };

            loadValues().catch(err => { console.error(err); listContainer.textContent = 'Erro ao carregar'; });

            wrapper.appendChild(listView);

            // View 2: Operator
            const operatorView = document.createElement('div');
            operatorView.style.display = 'none';
            operatorView.style.flexDirection = 'column';
            operatorView.style.gap = '0.5rem';

            const backBtn = document.createElement('div');
            backBtn.innerHTML = '<b>&lt; Voltar</b>';
            backBtn.style.cursor = 'pointer';
            backBtn.style.marginBottom = '0.5rem';
            backBtn.onclick = (e) => { e.stopPropagation(); operatorView.style.display = 'none'; listView.style.display = 'flex'; };
            operatorView.appendChild(backBtn);

            const opSelect = document.createElement('select');
            opSelect.className = 'form-input';
            opSelect.style.width = '100%';
            opSelect.onclick = (e) => e.stopPropagation();
            opSelect.onkeydown = (e) => handleKeydown(e);

            const ops = [
                { val: 'eq', label: 'É Igual a...' }, { val: 'neq', label: 'É Diferente de...' },
                { val: 'gt', label: 'É Maior do que...' }, { val: 'gte', label: 'É Maior ou Igual a...' },
                { val: 'lt', label: 'É Menor do que...' }, { val: 'lte', label: 'É Menor ou Igual a...' },
                { val: 'between', label: 'Está Entre...' }
            ];
            ops.forEach(o => {
                const opt = document.createElement('option'); opt.value = o.val; opt.text = o.label;
                if (extraDraft.operator === o.val) opt.selected = true;
                opSelect.appendChild(opt);
            });
            opSelect.onchange = (e) => {
                console.log('🔄 Operator Changed:', e.target.value);
                extraDraft.operator = e.target.value;
                // Clear List
                delete extraDraft.numIn;
                console.log('Current Draft:', JSON.stringify(extraDraft));
            };

            if (!extraDraft.operator) {
                console.log('⚠️ No operator found, defaulting to EQ');
                extraDraft.operator = 'eq';
            }

            // Helper to format currency input on blur
            const formatInputCurrency = (input) => {
                const val = parseFloat(input.value.replace(/\D/g, '')) / 100;
                if (isNaN(val)) return;
                input.value = val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return val; // return raw number for storage
            };

            // Input 1
            const input1 = document.createElement('input');
            input1.type = 'text'; input1.placeholder = '0,00';
            input1.className = 'form-input'; input1.style.width = '100%';

            // Init value logic
            if (extraDraft.val1) {
                input1.value = parseFloat(extraDraft.val1).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            }

            input1.onclick = (e) => e.stopPropagation();
            input1.onkeydown = (e) => handleKeydown(e);
            input1.onfocus = (e) => {
                // Unmask on focus? Or just behave like simple text?
                // Simple approach: user types raw number or simplified string. 
                // Let's rely on standard text input that parses nicely.
            };

            // On change, try to parse robustly
            const updateVal1 = () => {
                let raw = input1.value;
                if (!raw) { extraDraft.val1 = ''; return; }
                // Remove R$, spaces. Replace comma with dot if it looks like pt-BR.
                if (raw.includes(',') && !raw.includes('.')) raw = raw.replace(',', '.');
                else if (raw.includes('.') && raw.includes(',')) raw = raw.replace('.', '').replace(',', '.');

                const v = parseFloat(raw);
                if (!isNaN(v)) {
                    extraDraft.val1 = v;
                    // Optional: reformat input to verify
                    // input1.value = v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                } else {
                    extraDraft.val1 = raw;
                }
                // Clear List
                delete extraDraft.numIn;
            };
            input1.oninput = updateVal1;
            input1.onblur = () => {
                if (extraDraft.val1 && !isNaN(extraDraft.val1)) {
                    input1.value = parseFloat(extraDraft.val1).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                }
            };

            // Input 2
            const input2 = document.createElement('input');
            input2.type = 'text'; input2.placeholder = '0,00';
            input2.className = 'form-input'; input2.style.width = '100%';

            if (extraDraft.val2) {
                input2.value = parseFloat(extraDraft.val2).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            }

            input2.style.display = (extraDraft.operator === 'between') ? 'block' : 'none';
            input2.style.display = (extraDraft.operator === 'between') ? 'block' : 'none';
            input2.onclick = (e) => e.stopPropagation();
            input2.onkeydown = (e) => handleKeydown(e, operatorView, listView);
            input2.onkeydown = (e) => handleKeydown(e);

            const updateVal2 = () => {
                let raw = input2.value;
                if (!raw) { extraDraft.val2 = ''; return; }
                if (raw.includes(',') && !raw.includes('.')) raw = raw.replace(',', '.');
                else if (raw.includes('.') && raw.includes(',')) raw = raw.replace('.', '').replace(',', '.');

                const v = parseFloat(raw);
                if (!isNaN(v)) { extraDraft.val2 = v; }
                else { extraDraft.val2 = raw; }
                // Clear List
                delete extraDraft.numIn;
            };
            input2.oninput = updateVal2;
            input2.onblur = () => {
                if (extraDraft.val2 && !isNaN(extraDraft.val2)) {
                    input2.value = parseFloat(extraDraft.val2).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                }
            };

            opSelect.addEventListener('change', (e) => {
                input2.style.display = (e.target.value === 'between') ? 'block' : 'none';
            });

            operatorView.appendChild(opSelect); operatorView.appendChild(input1); operatorView.appendChild(input2);

            wrapper.appendChild(operatorView);
            advancedDiv.appendChild(wrapper);
        }

        // --- Text Filter ---
        if (colType === 'text') {
            const wrapper = document.createElement('div');

            // View 1: List View
            const listView = document.createElement('div');
            listView.style.display = 'flex'; listView.style.flexDirection = 'column'; listView.style.gap = '0.5rem';

            const btnAdv = document.createElement('div');
            btnAdv.innerHTML = '<span>Filtros de Texto</span> <span>&gt;</span>';
            btnAdv.style.padding = '0.5rem'; btnAdv.style.cursor = 'pointer'; btnAdv.style.display = 'flex';
            btnAdv.style.justifyContent = 'space-between'; btnAdv.style.backgroundColor = '#f9f9f9'; btnAdv.style.borderRadius = '4px';
            btnAdv.onclick = (e) => { e.stopPropagation(); listView.style.display = 'none'; operatorView.style.display = 'flex'; };
            listView.appendChild(btnAdv);

            const listSearch = document.createElement('input');
            listSearch.className = 'form-input'; listSearch.placeholder = 'Pesquisar...'; listSearch.style.width = '100%';
            listSearch.value = extraDraft.text || extraDraft.val1 || ''; // Initialize with current filter value
            listSearch.onclick = e => e.stopPropagation();
            listSearch.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); e.stopPropagation();
                    // Smart Behavior: If user hits Enter in search box, treat as "Contains" filter
                    // but ONLY if they haven't manually selected specific checkboxes (textIn).
                    // Actually, if they typed here, they likely want to filter by this text.
                    if (listSearch.value.trim() !== '') {
                        extraDraft.operator = 'contains';
                        extraDraft.val1 = listSearch.value;
                        delete extraDraft.textIn; // Priority to operator
                    }
                    executeFilter();
                }
            };
            listSearch.oninput = (e) => {
                const term = e.target.value;
                // Update State (Smart 'Contains')
                if (term.trim() !== '') {
                    extraDraft.operator = 'contains';
                    extraDraft.val1 = term;
                } else {
                    if (extraDraft.operator === 'contains') {
                        delete extraDraft.operator;
                        delete extraDraft.val1;
                    }
                }

                // Filter Visible List
                const lowerTerm = term.toLowerCase();
                listContainer.querySelectorAll('.val-row').forEach(row => {
                    const txt = row.textContent.toLowerCase();
                    row.style.display = txt.includes(lowerTerm) ? 'flex' : 'none';
                });
            };
            listView.appendChild(listSearch);

            const listContainer = document.createElement('div');
            listContainer.style.maxHeight = '200px'; listContainer.style.overflowY = 'auto';
            listContainer.style.border = '1px solid #eee'; listContainer.style.borderRadius = '4px'; listContainer.style.padding = '4px';
            listContainer.innerHTML = '<div>Carregando...</div>';
            listView.appendChild(listContainer);

            const loadValues = async () => {
                let values = [];
                if (this.endpointPrefix) {
                    const r = await fetch(`${this.API_BASE_URL}${this.endpointPrefix}/distinct-values?projectId=${this.projectId}&field=${colKey}`, { headers: this.getHeaders() });
                    values = await r.json();
                } else {
                    values = [...new Set(this.currentData.map(item => item[colKey]))].sort();
                }

                listContainer.innerHTML = '';
                const allCb = document.createElement('input'); allCb.type = 'checkbox';
                const isFiltered = this.activeFilters[colKey]?.textIn?.length > 0;
                allCb.checked = !isFiltered;

                const updateAll = (chk) => {
                    listContainer.querySelectorAll('.val-cb').forEach(c => c.checked = chk);
                    if (chk) {
                        extraDraft.textIn = [];
                        // Clear Operator
                        delete extraDraft.operator; delete extraDraft.val1;
                    }
                    else extraDraft.textIn = ['__NONE__'];
                };
                allCb.onclick = (e) => { e.stopPropagation(); updateAll(e.target.checked); };

                const allRow = document.createElement('div');
                allRow.style.display = 'flex'; allRow.style.gap = '0.5rem'; allRow.style.padding = '4px'; allRow.style.borderBottom = '1px solid #eee';
                allRow.appendChild(allCb); allRow.appendChild(document.createTextNode('(Selecionar Tudo)'));
                listContainer.appendChild(allRow);

                values.forEach(v => {
                    const row = document.createElement('div'); row.className = 'val-row';
                    row.style.display = 'flex'; row.style.gap = '0.5rem'; row.style.padding = '2px';
                    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'val-cb'; cb.value = v;
                    cb.checked = isFiltered ? this.activeFilters[colKey]?.textIn?.includes(v) : true;

                    cb.onclick = (e) => {
                        e.stopPropagation();
                        if (allCb.checked && !e.target.checked) {
                            extraDraft.textIn = values.filter(x => x !== v);
                            allCb.checked = false;
                        } else if (extraDraft.textIn?.includes('__NONE__') && e.target.checked) {
                            extraDraft.textIn = [v];
                        } else {
                            if (!extraDraft.textIn) extraDraft.textIn = [];
                            if (e.target.checked) {
                                if (!extraDraft.textIn.includes(v)) extraDraft.textIn.push(v);
                            } else {
                                extraDraft.textIn = extraDraft.textIn.filter(x => x !== v);
                            }
                        }
                        const allChecked = Array.from(listContainer.querySelectorAll('.val-cb')).every(c => c.checked);
                        allCb.checked = allChecked;
                        if (allChecked) extraDraft.textIn = [];

                        // Clear Operator
                        delete extraDraft.operator; delete extraDraft.val1;
                    };
                    row.appendChild(cb); row.appendChild(document.createTextNode(v));
                    listContainer.appendChild(row);
                });
            };
            loadValues().catch(err => { console.error(err); listContainer.textContent = 'Erro'; });
            wrapper.appendChild(listView);

            // View 2: Operator
            const operatorView = document.createElement('div');
            operatorView.style.display = 'none'; operatorView.style.flexDirection = 'column'; operatorView.style.gap = '0.5rem';

            const backBtn = document.createElement('div'); backBtn.innerHTML = '<b>&lt; Voltar</b>';
            backBtn.style.cursor = 'pointer'; backBtn.style.marginBottom = '0.5rem';
            backBtn.onclick = (e) => { e.stopPropagation(); operatorView.style.display = 'none'; listView.style.display = 'flex'; };
            operatorView.appendChild(backBtn);

            const opSelect = document.createElement('select'); opSelect.className = 'form-input'; opSelect.style.width = '100%';
            opSelect.onclick = (e) => e.stopPropagation();
            opSelect.onkeydown = (e) => handleKeydown(e, operatorView, listView);
            const ops = [
                { val: 'contains', label: 'Contém...' }, { val: 'not_contains', label: 'Não Contém...' },
                { val: 'starts_with', label: 'Começa com...' }, { val: 'ends_with', label: 'Termina com...' },
                { val: 'eq', label: 'É Igual a...' }, { val: 'neq', label: 'É Diferente de...' }
            ];
            ops.forEach(o => {
                const opt = document.createElement('option'); opt.value = o.val; opt.text = o.label;
                if (extraDraft.operator === o.val) opt.selected = true;
                opSelect.appendChild(opt);
            });
            opSelect.onchange = (e) => {
                extraDraft.operator = e.target.value;
                delete extraDraft.textIn;
            };
            if (!extraDraft.operator) extraDraft.operator = 'contains';

            const input1 = document.createElement('input'); input1.type = 'text'; input1.placeholder = 'Texto';
            input1.className = 'form-input'; input1.style.width = '100%'; input1.value = extraDraft.val1 || '';
            input1.onclick = (e) => e.stopPropagation();
            input1.onkeydown = (e) => handleKeydown(e, operatorView, listView);
            input1.oninput = e => {
                extraDraft.val1 = e.target.value;
                delete extraDraft.textIn;
            };

            operatorView.appendChild(opSelect); operatorView.appendChild(input1);
            wrapper.appendChild(operatorView);
            advancedDiv.appendChild(wrapper);
        }

        // --- Date Filter (Excel-like) ---
        if (colType === 'date') {
            const wrapper = document.createElement('div');

            // State for View Switching
            const listView = document.createElement('div');
            listView.style.display = 'flex'; listView.style.flexDirection = 'column'; listView.style.gap = '0.5rem';

            const operatorView = document.createElement('div');
            operatorView.style.display = 'none'; operatorView.style.flexDirection = 'column'; operatorView.style.gap = '0.5rem';

            // --- Advanced Operators Button ---
            const btnAdv = document.createElement('div');
            btnAdv.innerHTML = '<span>Filtros de Data</span> <span>&gt;</span>';
            btnAdv.style.padding = '0.5rem'; btnAdv.style.cursor = 'pointer'; btnAdv.style.display = 'flex';
            btnAdv.style.justifyContent = 'space-between'; btnAdv.style.backgroundColor = '#f9f9f9'; btnAdv.style.borderRadius = '4px';
            btnAdv.onclick = (e) => { e.stopPropagation(); listView.style.display = 'none'; operatorView.style.display = 'flex'; };
            listView.appendChild(btnAdv);

            const listContainer = document.createElement('div');
            listContainer.style.maxHeight = '250px'; listContainer.style.overflowY = 'auto';
            listContainer.style.border = '1px solid #eee'; listContainer.style.borderRadius = '4px'; listContainer.style.padding = '4px';
            listContainer.innerHTML = '<div>Carregando...</div>';
            listView.appendChild(listContainer);

            // Fetch Distinct Dates
            const loadDates = async () => {
                let values = [];
                try {
                    if (this.endpointPrefix) {
                        const r = await fetch(`${this.API_BASE_URL}${this.endpointPrefix}/distinct-values?projectId=${this.projectId}&field=${colKey}`, { headers: this.getHeaders() });
                        values = await r.json();
                    } else {
                        values = [...new Set(this.currentData.map(item => item[colKey]))].filter(d => d).sort();
                    }

                    // Normalize all values to YYYY-MM-DD immediately
                    values = values.map(v => {
                        if (typeof v === 'string' && v.includes('T')) return v.split('T')[0];
                        return v;
                    });
                    // Remove duplicates after normalization
                    values = [...new Set(values)];
                } catch (e) {
                    console.error(e);
                    listContainer.textContent = 'Erro ao carregar datas';
                    return;
                }

                // Parse Dates into Tree: Year -> Month -> Day
                const tree = {};
                values.forEach(dateStr => {
                    if (!dateStr) return;

                    let d;
                    // Check for DD/MM/YYYY format explicitly
                    let fullDate;
                    if (typeof dateStr === 'string' && dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                        const [day, month, year] = dateStr.split('/');
                        d = new Date(`${year}-${month}-${day}T00:00:00`);
                        // Use YYYY-MM-DD for filter value
                        fullDate = `${year}-${month}-${day}`;
                    } else {
                        d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
                        // Normalize to YYYY-MM-DD if ISO string
                        if (typeof dateStr === 'string' && dateStr.includes('T')) {
                            fullDate = dateStr.split('T')[0];
                        } else {
                            // Fallback attempts
                            try {
                                fullDate = d.toISOString().split('T')[0];
                            } catch (err) { fullDate = dateStr; }
                        }
                    }

                    if (isNaN(d.getTime())) return;

                    const year = d.getFullYear();
                    const month = d.toLocaleString('pt-BR', { month: 'long' }); // Janeiro...
                    const monthIdx = d.getMonth(); // 0-11 for sorting
                    const day = d.getDate();
                    // const fullDate = dateStr; // Removed shadowing

                    if (!tree[year]) tree[year] = { _count: 0, months: {} };
                    if (!tree[year].months[monthIdx]) tree[year].months[monthIdx] = { name: month, days: [] };

                    if (!tree[year].months[monthIdx].days.some(x => x.val === fullDate)) {
                        tree[year].months[monthIdx].days.push({ day, val: fullDate });
                    }
                    tree[year]._count++;
                });

                listContainer.innerHTML = '';

                // Root "Select All"
                const allCb = document.createElement('input'); allCb.type = 'checkbox';
                const isFiltered = (extraDraft.dateIn && extraDraft.dateIn.length > 0) || (extraDraft.start || extraDraft.end);
                allCb.checked = !isFiltered;

                const updateAll = (chk) => {
                    listContainer.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = chk);
                    if (chk) {
                        delete extraDraft.dateIn;
                        delete extraDraft.start; delete extraDraft.end; delete extraDraft.operator; delete extraDraft.val1; delete extraDraft.val2;
                    } else {
                        extraDraft.dateIn = ['__NONE__'];
                        delete extraDraft.start; delete extraDraft.end; delete extraDraft.operator; delete extraDraft.val1; delete extraDraft.val2;
                    }
                };
                allCb.onclick = (e) => { e.stopPropagation(); updateAll(e.target.checked); };

                const allRow = document.createElement('div');
                allRow.style.fontWeight = 'bold'; allRow.style.padding = '4px'; allRow.style.cursor = 'pointer';
                allRow.appendChild(allCb); allRow.appendChild(document.createTextNode(' (Selecionar Tudo)'));
                listContainer.appendChild(allRow);

                // Render Tree
                Object.keys(tree).sort().reverse().forEach(year => { // Newest years first
                    const yObj = tree[year];
                    const yDiv = document.createElement('div');
                    yDiv.style.marginLeft = '0.5rem';

                    // Year Row
                    const yRow = document.createElement('div');
                    yRow.style.display = 'flex'; yRow.style.alignItems = 'center'; yRow.style.gap = '0.4rem';

                    const yCb = document.createElement('input'); yCb.type = 'checkbox';
                    const toggle = document.createElement('span'); toggle.textContent = '+'; toggle.style.cursor = 'pointer'; toggle.style.width = '12px';
                    toggle.onclick = (e) => {
                        e.stopPropagation();
                        const kids = yDiv.querySelector('.year-children');
                        const isHidden = kids.style.display === 'none';
                        kids.style.display = isHidden ? 'block' : 'none';
                        toggle.textContent = isHidden ? '-' : '+';
                    };

                    yRow.appendChild(toggle); yRow.appendChild(yCb); yRow.appendChild(document.createTextNode(` ${year}`));
                    yDiv.appendChild(yRow);

                    // Months Container
                    const mContainer = document.createElement('div');
                    mContainer.className = 'year-children';
                    mContainer.style.display = 'none'; mContainer.style.marginLeft = '1.2rem';

                    // Helpers for checking state
                    const yearDates = [];
                    Object.values(yObj.months).forEach(m => m.days.forEach(d => yearDates.push(d.val)));

                    const checkYearState = () => {
                        if (extraDraft.dateIn && extraDraft.dateIn.includes('__NONE__')) return false;
                        if (!extraDraft.dateIn || extraDraft.dateIn.length === 0) return true;
                        return yearDates.every(d => extraDraft.dateIn.includes(d));
                    };
                    yCb.checked = checkYearState();

                    yCb.onclick = (e) => {
                        e.stopPropagation();
                        const chk = e.target.checked;
                        mContainer.querySelectorAll('input').forEach(i => i.checked = chk);

                        if (!extraDraft.dateIn) extraDraft.dateIn = [];
                        if (extraDraft.dateIn.includes('__NONE__')) extraDraft.dateIn = [];

                        yearDates.forEach(d => {
                            if (chk) {
                                if (!extraDraft.dateIn.includes(d)) extraDraft.dateIn.push(d);
                            } else {
                                extraDraft.dateIn = extraDraft.dateIn.filter(x => x !== d);
                            }
                        });

                        // Clear Operators
                        delete extraDraft.start; delete extraDraft.end; delete extraDraft.operator; delete extraDraft.val1; delete extraDraft.val2;

                        if (allDatesSelected()) delete extraDraft.dateIn;
                        else if (extraDraft.dateIn.length === 0) extraDraft.dateIn = ['__NONE__'];
                    };

                    // Render Months
                    Object.keys(yObj.months).sort((a, b) => parseInt(a) - parseInt(b)).forEach(mIdx => {
                        const mObj = yObj.months[mIdx];
                        const mDiv = document.createElement('div');
                        const mRow = document.createElement('div');
                        mRow.style.display = 'flex'; mRow.style.alignItems = 'center'; mRow.style.gap = '0.4rem';

                        const mCb = document.createElement('input'); mCb.type = 'checkbox';
                        const mToggle = document.createElement('span'); mToggle.textContent = '+'; mToggle.style.cursor = 'pointer'; mToggle.style.width = '10px';

                        const dContainer = document.createElement('div');
                        dContainer.className = 'month-children';
                        dContainer.style.display = 'none'; dContainer.style.marginLeft = '1rem';

                        mToggle.onclick = (e) => {
                            e.stopPropagation();
                            const isHidden = dContainer.style.display === 'none';
                            dContainer.style.display = isHidden ? 'block' : 'none';
                            mToggle.textContent = isHidden ? '-' : '+';
                        };

                        mRow.appendChild(mToggle); mRow.appendChild(mCb); mRow.appendChild(document.createTextNode(mObj.name));
                        mDiv.appendChild(mRow);

                        const monthDates = mObj.days.map(d => d.val);
                        const checkMonthState = () => {
                            if (extraDraft.dateIn && extraDraft.dateIn.includes('__NONE__')) return false;
                            if (!extraDraft.dateIn || extraDraft.dateIn.length === 0) return true;
                            return monthDates.every(d => extraDraft.dateIn.includes(d));
                        };
                        mCb.checked = checkMonthState();

                        mCb.onclick = (e) => {
                            e.stopPropagation();
                            const chk = e.target.checked;
                            dContainer.querySelectorAll('input').forEach(i => i.checked = chk);

                            if (!extraDraft.dateIn) extraDraft.dateIn = [];
                            if (extraDraft.dateIn.includes('__NONE__')) extraDraft.dateIn = [];

                            monthDates.forEach(d => {
                                if (chk) { if (!extraDraft.dateIn.includes(d)) extraDraft.dateIn.push(d); }
                                else { extraDraft.dateIn = extraDraft.dateIn.filter(x => x !== d); }
                            });

                            // Clear Operators
                            delete extraDraft.start; delete extraDraft.end; delete extraDraft.operator; delete extraDraft.val1; delete extraDraft.val2;

                            if (allDatesSelected()) delete extraDraft.dateIn;
                            else if (extraDraft.dateIn.length === 0) extraDraft.dateIn = ['__NONE__'];

                            yCb.checked = checkYearState();
                        };

                        // Days
                        mObj.days.sort((a, b) => parseInt(a.day) - parseInt(b.day)).forEach(dayObj => {
                            const dRow = document.createElement('div');
                            dRow.style.marginLeft = '1.2rem';
                            const dCb = document.createElement('input'); dCb.type = 'checkbox';
                            dCb.value = dayObj.val; // Original date string

                            const isChecked = (!extraDraft.dateIn || extraDraft.dateIn.length === 0) ? true : extraDraft.dateIn.includes(dayObj.val);
                            dCb.checked = isChecked;

                            dCb.onclick = (e) => {
                                e.stopPropagation();
                                const chk = e.target.checked;
                                if (!extraDraft.dateIn) extraDraft.dateIn = [];

                                // If undefined/empty implied all, populate first so we can remove one
                                if (extraDraft.dateIn.length === 0 && !extraDraft.dateIn.includes('__NONE__')) {
                                    // Populate with ALL except this one (expensive but necessary)
                                    // Actually we can just start empty and say:
                                    // If we are unchecking from ALL, we need all values to remove one.
                                    // But 'values' is available here.
                                    extraDraft.dateIn = values.slice();
                                }

                                if (extraDraft.dateIn.includes('__NONE__')) extraDraft.dateIn = [];

                                if (chk) {
                                    if (!extraDraft.dateIn.includes(dayObj.val)) extraDraft.dateIn.push(dayObj.val);
                                } else {
                                    extraDraft.dateIn = extraDraft.dateIn.filter(x => x !== dayObj.val);
                                }

                                // Clear Operators
                                delete extraDraft.start; delete extraDraft.end; delete extraDraft.operator; delete extraDraft.val1; delete extraDraft.val2;

                                if (allDatesSelected()) delete extraDraft.dateIn;
                                else if (extraDraft.dateIn.length === 0) extraDraft.dateIn = ['__NONE__'];

                                mCb.checked = checkMonthState();
                                yCb.checked = checkYearState();
                            };

                            dRow.appendChild(dCb); dRow.appendChild(document.createTextNode(` ${dayObj.day}`));
                            dContainer.appendChild(dRow);
                        });

                        mDiv.appendChild(dContainer);
                        mContainer.appendChild(mDiv);
                    });

                    yDiv.appendChild(mContainer);
                    listContainer.appendChild(yDiv);
                });

                const allDatesSelected = () => {
                    if (extraDraft.dateIn && extraDraft.dateIn.length === values.length) return true;
                    return false;
                };
            };
            loadDates();

            wrapper.appendChild(listView);

            // --- Operator View ---
            const backBtn = document.createElement('div');
            backBtn.innerHTML = '<b>&lt; Voltar</b>';
            backBtn.style.cursor = 'pointer'; backBtn.style.marginBottom = '0.5rem';
            backBtn.onclick = (e) => { e.stopPropagation(); operatorView.style.display = 'none'; listView.style.display = 'flex'; };
            operatorView.appendChild(backBtn);

            const opSelect = document.createElement('select'); opSelect.className = 'form-input'; opSelect.style.width = '100%';
            opSelect.onclick = (e) => e.stopPropagation();
            opSelect.onkeydown = (e) => handleKeydown(e, operatorView, listView);
            // Operators: Equals, Before, After, Between
            const ops = [
                { val: 'eq', label: 'É Igual a...' },
                { val: 'before', label: 'Antes de...' },
                { val: 'after', label: 'Depois de...' },
                { val: 'between', label: 'Entre...' }
            ];
            ops.forEach(o => {
                const opt = document.createElement('option'); opt.value = o.val; opt.text = o.label;
                if (extraDraft.operator === o.val) opt.selected = true;
                opSelect.appendChild(opt);
            });
            opSelect.onchange = (e) => {
                extraDraft.operator = e.target.value;
                dateInput2.style.display = (extraDraft.operator === 'between') ? 'block' : 'none';
                delete extraDraft.dateIn;
            };

            if (!extraDraft.operator) extraDraft.operator = 'eq';

            const dateInput1 = document.createElement('input'); dateInput1.type = 'date'; dateInput1.className = 'form-input';
            dateInput1.style.width = '100%'; dateInput1.value = extraDraft.val1 || extraDraft.start || '';
            dateInput1.onclick = e => e.stopPropagation();
            dateInput1.onkeydown = e => handleKeydown(e, operatorView, listView);
            dateInput1.oninput = e => {
                extraDraft.val1 = e.target.value;
                delete extraDraft.dateIn;
            };

            const dateInput2 = document.createElement('input'); dateInput2.type = 'date'; dateInput2.className = 'form-input';
            dateInput2.style.width = '100%'; dateInput2.value = extraDraft.val2 || extraDraft.end || '';
            dateInput2.style.display = (extraDraft.operator === 'between') ? 'block' : 'none';
            dateInput2.onclick = e => e.stopPropagation();
            dateInput2.onkeydown = e => handleKeydown(e, operatorView, listView);
            dateInput2.oninput = e => {
                extraDraft.val2 = e.target.value;
                delete extraDraft.dateIn;
            };

            operatorView.appendChild(opSelect); operatorView.appendChild(dateInput1); operatorView.appendChild(dateInput2);
            wrapper.appendChild(operatorView);

            advancedDiv.appendChild(wrapper);
        }

        menu.appendChild(advancedDiv);

        // Buttons
        const btns = document.createElement('div');
        btns.style.marginTop = '0.5rem';
        btns.style.display = 'flex'; btns.style.justifyContent = 'flex-end'; btns.style.gap = '0.5rem';

        const btnClear = document.createElement('button'); btnClear.textContent = 'Limpar';
        btnClear.className = 'filter-btn secondary';
        btnClear.onclick = (e) => {
            e.stopPropagation();
            delete this.activeFilters[colKey];
            if (this.onFilterChange) this.onFilterChange(this.activeFilters);
            menu.classList.remove('animate-float-in');
            menu.style.opacity = '0';
            setTimeout(() => menu.remove(), 200);
        };

        const btnFilter = document.createElement('button'); btnFilter.textContent = 'Filtrar';
        btnFilter.className = 'filter-btn primary';
        btnFilter.onclick = (e) => {
            e.stopPropagation();
            executeFilter();
        };

        btns.appendChild(btnClear); btns.appendChild(btnFilter);
        menu.appendChild(btns);

        // Position
        document.body.appendChild(menu);

        const rect = target.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();

        let top = rect.bottom + window.scrollY;
        let left = rect.left + window.scrollX - (menuRect.width / 2) + (rect.width / 2); // Center horizontally

        // Prevent overflow right
        if (left + menuRect.width > window.innerWidth - 20) {
            left = window.innerWidth - menuRect.width - 20;
        }
        // Prevent overflow left
        if (left < 20) {
            left = 20;
        }

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;

        const close = () => { menu.remove(); document.removeEventListener('click', close); };
        setTimeout(() => document.addEventListener('click', close), 0);
    }
}
