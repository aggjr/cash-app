import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { MonthPicker } from './MonthPicker.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { HierarchicalFilter } from './HierarchicalFilter.js';
import { PrintHelper } from '../utils/printHelper.js';

export const FechamentoContasManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.height = 'calc(100vh - 150px)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // State
    const today = new Date();
    const storageKeyStart = `cash_fechamento_start_${project.id}`;
    const storageKeyEnd = `cash_fechamento_end_${project.id}`;
    const storageKeyMode = `cash_fechamento_mode_${project.id}`; // New

    // Helper to parse saved date or default
    const parseSavedDate = (saved, defaultDate) => {
        if (!saved) return defaultDate;
        const d = new Date(saved);
        return isNaN(d.getTime()) ? defaultDate : d;
    };

    let startMonth = parseSavedDate(localStorage.getItem(storageKeyStart), new Date(today.getFullYear(), 0, 1));
    let endMonth = parseSavedDate(localStorage.getItem(storageKeyEnd), new Date(today.getFullYear(), 11, 1));
    let viewMode = localStorage.getItem(storageKeyMode) || 'monthly'; // 'monthly' | 'daily'

    // Data
    let accounts = [];
    let companies = [];
    let initialBalances = {};
    let movementsData = {};
    let selectedAccountIds = [];
    let hierarchicalFilter = null;

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Helper to generate array of columns (Months or Days)
    const getColumnList = () => {
        const list = [];
        const current = new Date(startMonth);
        const end = new Date(endMonth);

        // Normalize time
        current.setHours(12, 0, 0, 0);
        end.setHours(12, 0, 0, 0);

        if (viewMode === 'monthly') {
            // Normalize to first day
            current.setDate(1);
            end.setDate(1);

            while (current <= end) {
                list.push(new Date(current));
                current.setMonth(current.getMonth() + 1);
            }
        } else {
            // Daily View
            while (current <= end) {
                list.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
        }
        return list;
    };

    const formatDateHeader = (date) => {
        if (viewMode === 'monthly') {
            const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${monthStr}/${date.getFullYear()}`;
        } else {
            // Daily: DD/MM
            const dayStr = date.getDate().toString().padStart(2, '0');
            const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dayStr}/${monthStr}`;
        }
    };

    // --- Render Functions ---

    const renderControls = () => {
        const containerDiv = document.createElement('div');
        containerDiv.className = 'fechamento-controls';

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '2rem';
        controls.style.marginBottom = '1rem';
        controls.style.alignItems = 'flex-end';
        controls.className = 'animate-float-in';

        // View Mode Toggle
        const modeDiv = document.createElement('div');
        const modeLabel = document.createElement('label');
        modeLabel.textContent = 'Visão';
        modeLabel.style.display = 'block';
        modeLabel.style.marginBottom = '0.25rem';
        modeLabel.style.fontWeight = '500';
        modeLabel.style.fontSize = '0.9rem';
        modeLabel.style.color = '#374151';

        const toggleContainer = document.createElement('div');
        toggleContainer.style.display = 'flex';
        toggleContainer.style.backgroundColor = '#e5e7eb';
        toggleContainer.style.borderRadius = '6px';
        toggleContainer.style.padding = '2px';

        const btnMonthly = document.createElement('button');
        btnMonthly.textContent = 'Mensal';
        btnMonthly.style.padding = '4px 12px';
        btnMonthly.style.border = 'none';
        btnMonthly.style.borderRadius = '4px';
        btnMonthly.style.cursor = 'pointer';
        btnMonthly.style.flex = '1';
        btnMonthly.style.fontSize = '0.85rem';

        const btnDaily = document.createElement('button');
        btnDaily.textContent = 'Diária';
        btnDaily.style.padding = '4px 12px';
        btnDaily.style.border = 'none';
        btnDaily.style.borderRadius = '4px';
        btnDaily.style.cursor = 'pointer';
        btnDaily.style.flex = '1';
        btnDaily.style.fontSize = '0.85rem';

        const updateToggle = () => {
            if (viewMode === 'monthly') {
                btnMonthly.style.backgroundColor = 'white';
                btnMonthly.style.color = '#00425F';
                btnMonthly.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                btnDaily.style.backgroundColor = 'transparent';
                btnDaily.style.color = '#6b7280';
                btnDaily.style.boxShadow = 'none';
            } else {
                btnDaily.style.backgroundColor = 'white';
                btnDaily.style.color = '#00425F';
                btnDaily.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                btnMonthly.style.backgroundColor = 'transparent';
                btnMonthly.style.color = '#6b7280';
                btnMonthly.style.boxShadow = 'none';
            }
        };
        updateToggle();

        btnMonthly.onclick = () => {
            if (viewMode !== 'monthly') {
                viewMode = 'monthly';
                localStorage.setItem(storageKeyMode, 'monthly');
                updateToggle();
                // Reset dates to reasonable monthly defaults if needed, or keep current
                // Reload controls to switch pickers
                container.innerHTML = '';
                // Re-render
                renderHeader();
                container.appendChild(renderControls());
                loadData();
            }
        };

        btnDaily.onclick = () => {
            if (viewMode !== 'daily') {
                viewMode = 'daily';
                localStorage.setItem(storageKeyMode, 'daily');
                updateToggle();
                // Reload controls
                container.innerHTML = '';
                renderHeader();
                container.appendChild(renderControls());
                loadData();
            }
        };

        toggleContainer.appendChild(btnMonthly);
        toggleContainer.appendChild(btnDaily);

        modeDiv.appendChild(modeLabel);
        modeDiv.appendChild(toggleContainer);
        controls.appendChild(modeDiv);

        // Start Date Input (Dynamic)
        const startDiv = document.createElement('div');
        const startLabel = document.createElement('label');
        startLabel.textContent = viewMode === 'monthly' ? 'Mês Inicial' : 'Dia Inicial';
        startLabel.style.display = 'block';
        startLabel.style.marginBottom = '0.25rem';
        startLabel.style.fontWeight = '500';
        startLabel.style.fontSize = '0.9rem';
        startLabel.style.color = '#374151';

        let startInput;
        if (viewMode === 'monthly') {
            // Month Picker Logic
            const startStr = `${startMonth.getFullYear()}-${(startMonth.getMonth() + 1).toString().padStart(2, '0')}`;
            startInput = MonthPicker(startStr, (val) => {
                if (val) {
                    const parts = val.split('-');
                    if (parts.length === 2) {
                        startMonth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1, 12);
                        localStorage.setItem(storageKeyStart, startMonth.toISOString());
                        loadData();
                    }
                }
            });
        } else {
            // Date Picker Logic
            startInput = document.createElement('input');
            startInput.type = 'date';
            startInput.className = 'form-input';
            // date value YYYY-MM-DD
            startInput.value = startMonth.toISOString().split('T')[0];
            startInput.onchange = (e) => {
                const parts = e.target.value.split('-');
                if (parts.length === 3) {
                    startMonth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12);
                    localStorage.setItem(storageKeyStart, startMonth.toISOString());
                    loadData();
                }
            };
        }

        startDiv.appendChild(startLabel);
        startDiv.appendChild(startInput);

        // End Date Input (Dynamic)
        const endDiv = document.createElement('div');
        const endLabel = document.createElement('label');
        endLabel.textContent = viewMode === 'monthly' ? 'Mês Final' : 'Dia Final';
        endLabel.style.display = 'block';
        endLabel.style.marginBottom = '0.25rem';
        endLabel.style.fontWeight = '500';
        endLabel.style.fontSize = '0.9rem';
        endLabel.style.color = '#374151';

        let endInput;
        if (viewMode === 'monthly') {
            const endStr = `${endMonth.getFullYear()}-${(endMonth.getMonth() + 1).toString().padStart(2, '0')}`;
            endInput = MonthPicker(endStr, (val) => {
                if (val) {
                    const parts = val.split('-');
                    if (parts.length === 2) {
                        endMonth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1, 12);
                        localStorage.setItem(storageKeyEnd, endMonth.toISOString());
                        loadData();
                    }
                }
            });
        } else {
            endInput = document.createElement('input');
            endInput.type = 'date';
            endInput.className = 'form-input';
            endInput.value = endMonth.toISOString().split('T')[0];
            endInput.onchange = (e) => {
                const parts = e.target.value.split('-');
                if (parts.length === 3) {
                    endMonth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12);
                    localStorage.setItem(storageKeyEnd, endMonth.toISOString());
                    loadData();
                }
            };
        }

        endDiv.appendChild(endLabel);
        endDiv.appendChild(endInput);

        controls.appendChild(startDiv);
        controls.appendChild(endDiv);

        // Company/Account Filter
        const filterDiv = document.createElement('div');
        filterDiv.style.minWidth = '250px';
        const filterLabel = document.createElement('label');
        filterLabel.textContent = 'Filtrar Empresas/Contas';
        filterLabel.style.display = 'block';
        filterLabel.style.marginBottom = '0.25rem';
        filterLabel.style.fontWeight = '500';
        filterLabel.style.fontSize = '0.9rem';
        filterLabel.style.color = '#374151';

        const filterContainer = document.createElement('div');
        filterContainer.id = 'hierarchical-filter-container';

        filterDiv.appendChild(filterLabel);
        filterDiv.appendChild(filterContainer);
        controls.appendChild(filterDiv);

        // Export Buttons
        const exportDiv = document.createElement('div');
        exportDiv.style.display = 'flex';
        exportDiv.style.gap = '0.5rem';
        exportDiv.style.marginLeft = 'auto';

        const btnExcel = document.createElement('button');
        btnExcel.id = 'btn-excel-fech';
        btnExcel.className = 'btn-outline';
        btnExcel.textContent = '📊 Excel';
        exportDiv.appendChild(btnExcel);

        const btnPdf = document.createElement('button');
        btnPdf.id = 'btn-pdf-fech';
        btnPdf.className = 'btn-outline';
        btnPdf.textContent = '🖨️ PDF';
        exportDiv.appendChild(btnPdf);

        controls.appendChild(exportDiv);

        containerDiv.appendChild(controls);
        return containerDiv;
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const renderTable = () => {
        const existingTable = container.querySelector('.fechamento-table-wrapper');
        if (existingTable) existingTable.remove();

        const wrapper = document.createElement('div');
        wrapper.className = 'fechamento-table-wrapper';
        wrapper.style.flex = '1';
        wrapper.style.overflow = 'auto'; // Enable scroll
        wrapper.style.position = 'relative'; // Anchor
        wrapper.style.border = '1px solid var(--color-border-light)';
        wrapper.style.borderRadius = '8px';
        wrapper.style.boxShadow = 'var(--shadow-sm)';
        wrapper.style.backgroundColor = 'white';

        const table = document.createElement('table');
        table.style.borderCollapse = 'separate'; // Important for sticky
        table.style.borderSpacing = '0';
        table.style.width = 'max-content'; // Fit content, allowing it to be smaller than screen
        table.style.fontSize = '0.85rem'; // Global smaller font for table

        const columns = getColumnList();

        // --- THEAD ---
        const thead = document.createElement('thead');

        const headerRow = document.createElement('tr');
        headerRow.style.backgroundColor = '#00425F'; // Header color
        headerRow.style.color = 'white';
        headerRow.style.position = 'sticky';
        headerRow.style.top = '0';
        headerRow.style.zIndex = '100'; // Highest priority vertical

        // Fixed Company Column Header
        const thCompany = document.createElement('th');
        thCompany.textContent = 'Empresa';
        thCompany.style.position = 'sticky';
        thCompany.style.left = '0';
        thCompany.style.zIndex = '101';
        thCompany.style.backgroundColor = '#00425F';
        thCompany.style.color = 'white';
        thCompany.style.padding = 'var(--header-padding)';
        thCompany.style.textAlign = 'left';
        thCompany.style.width = '140px';
        thCompany.style.minWidth = '140px';
        thCompany.style.maxWidth = '140px';
        thCompany.style.whiteSpace = 'nowrap';
        thCompany.style.borderBottom = '2px solid white';
        thCompany.style.borderRight = '2px solid white';
        headerRow.appendChild(thCompany);

        // Fixed Account Column Header
        const thFixed = document.createElement('th');
        thFixed.textContent = 'Conta Bancária';
        thFixed.style.position = 'sticky';
        thFixed.style.left = '140px'; // Offset by Empresa column width
        thFixed.style.zIndex = '101';
        thFixed.style.backgroundColor = '#00425F';
        thFixed.style.color = 'white';
        thFixed.style.padding = 'var(--header-padding)';
        thFixed.style.textAlign = 'left';
        thFixed.style.width = '1%';
        thFixed.style.whiteSpace = 'nowrap';
        thFixed.style.borderBottom = '2px solid white';
        thFixed.style.borderRight = '2px solid #00425F';
        headerRow.appendChild(thFixed);

        // Month Columns Headers
        columns.forEach((d, index) => {
            const th = document.createElement('th');
            th.textContent = formatDateHeader(d); // Dynamic Header
            th.style.padding = 'var(--row-padding)';
            th.style.textAlign = 'right';
            th.style.minWidth = '120px';
            th.style.width = '120px';
            th.style.borderBottom = '1px solid #1e3a8a';
            th.style.whiteSpace = 'nowrap';

            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // --- TBODY ---
        const tbody = document.createElement('tbody');

        // Totals array (one per month)
        const monthTotals = new Array(months.length).fill(0);

        // Group accounts by company for rowspan calculation
        const companyGroups = {};
        accounts.forEach(acc => {
            if (!companyGroups[acc.company_id]) {
                companyGroups[acc.company_id] = {
                    company_name: acc.company_name,
                    accounts: []
                };
            }
            companyGroups[acc.company_id].accounts.push(acc);
        });

        let globalIndex = 0;
        Object.values(companyGroups).forEach(group => {
            const rowspan = group.accounts.length;

            group.accounts.forEach((acc, localIndex) => {
                const isEven = globalIndex % 2 === 0;
                const bgColor = isEven ? '#FFFFFF' : '#F8FAFC';

                const tr = document.createElement('tr');

                // Company Cell (only on first row of group)
                if (localIndex === 0) {
                    const tdCompany = document.createElement('td');
                    tdCompany.textContent = group.company_name;
                    tdCompany.rowSpan = rowspan;
                    tdCompany.style.position = 'sticky';
                    tdCompany.style.left = '0';
                    tdCompany.style.backgroundColor = '#00425F';
                    tdCompany.style.color = 'white';
                    tdCompany.style.fontWeight = '600';
                    tdCompany.style.zIndex = '10';
                    tdCompany.style.padding = 'var(--header-padding)';
                    tdCompany.style.textAlign = 'left';
                    tdCompany.style.borderBottom = '2px solid white';
                    tdCompany.style.borderRight = '2px solid white';
                    tdCompany.style.whiteSpace = 'nowrap';
                    tdCompany.style.verticalAlign = 'middle';
                    tr.appendChild(tdCompany);
                }

                // Account Name Cell
                const tdFixed = document.createElement('td');
                tdFixed.textContent = acc.name;
                tdFixed.style.position = 'sticky';
                tdFixed.style.left = '140px'; // Offset by company column width
                tdFixed.style.backgroundColor = '#00425F';
                tdFixed.style.color = 'white';
                tdFixed.style.fontWeight = '500';
                tdFixed.style.zIndex = '10';
                tdFixed.style.padding = 'var(--header-padding)';
                tdFixed.style.textAlign = 'left';
                tdFixed.style.borderBottom = '2px solid white';
                tdFixed.style.borderRight = '2px solid #00425F';
                tdFixed.style.whiteSpace = 'nowrap';
                tr.appendChild(tdFixed);

                // Calculation Logic
                let currentBalance = initialBalances[acc.id] || 0;

                // Data Cells
                columns.forEach((colDate, colIndex) => {
                    let key = '';
                    if (viewMode === 'monthly') {
                        key = `${colDate.getFullYear()}-${(colDate.getMonth() + 1).toString().padStart(2, '0')}`;
                    } else {
                        const d = colDate.getDate().toString().padStart(2, '0');
                        const m = (colDate.getMonth() + 1).toString().padStart(2, '0');
                        key = `${colDate.getFullYear()}-${m}-${d}`;
                    }

                    const delta = (movementsData[acc.id] && movementsData[acc.id][key])
                        ? movementsData[acc.id][key]
                        : 0;

                    currentBalance += delta;

                    // Ensure monthTotals has space if columns length changed
                    if (monthTotals[colIndex] === undefined) monthTotals[colIndex] = 0;
                    monthTotals[colIndex] += currentBalance;

                    const td = document.createElement('td');
                    const val = currentBalance;

                    td.textContent = formatCurrency(val);
                    td.style.backgroundColor = bgColor;
                    td.style.padding = 'var(--row-padding)';
                    td.style.textAlign = 'right';
                    td.style.borderBottom = '1px solid #e2e8f0';
                    td.style.whiteSpace = 'nowrap';

                    if (val > 0) td.style.color = '#10B981';
                    else if (val < 0) td.style.color = '#EF4444';
                    else td.style.color = '#9ca3af';

                    td.addEventListener('mouseenter', () => td.style.backgroundColor = 'rgba(218, 177, 119, 0.5)');
                    td.addEventListener('mouseleave', () => td.style.backgroundColor = bgColor);

                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
                globalIndex++;
            });
        });

        // --- TOTAL ROW ---
        const trTotal = document.createElement('tr');
        trTotal.style.fontWeight = '700';
        trTotal.style.backgroundColor = '#f0f9ff'; // Light highlight

        // Hidden Empresa Cell for TOTAL row (maintains column structure)
        const tdTotalEmpresa = document.createElement('td');
        tdTotalEmpresa.style.position = 'sticky';
        tdTotalEmpresa.style.left = '0';
        tdTotalEmpresa.style.zIndex = '10';
        tdTotalEmpresa.style.backgroundColor = '#00425F';
        tdTotalEmpresa.style.borderTop = '2px solid #00425F';
        trTotal.appendChild(tdTotalEmpresa);

        // Visible Account Cell for TOTAL row
        const tdTotalLabel = document.createElement('td');
        tdTotalLabel.textContent = 'TOTAL';
        tdTotalLabel.style.position = 'sticky';
        tdTotalLabel.style.left = '140px';
        tdTotalLabel.style.backgroundColor = '#00425F';
        tdTotalLabel.style.color = 'white';
        tdTotalLabel.style.zIndex = '11';
        tdTotalLabel.style.padding = 'var(--header-padding)';
        tdTotalLabel.style.textAlign = 'left';
        tdTotalLabel.style.borderTop = '2px solid #00425F';
        tdTotalLabel.style.borderRight = '2px solid #00425F';
        tdTotalLabel.style.whiteSpace = 'nowrap';
        trTotal.appendChild(tdTotalLabel);

        // Month Totals
        // Ensure we only loop the same number of columns
        columns.forEach((_, index) => {
            const val = monthTotals[index] || 0;
            const td = document.createElement('td');
            td.textContent = formatCurrency(val);
            td.style.padding = 'var(--row-padding)';
            td.style.textAlign = 'right';
            td.style.borderTop = '2px solid #cbd5e1';
            td.style.backgroundColor = '#e2e8f0'; // Slightly darker
            td.style.whiteSpace = 'nowrap';

            // Color Logic
            if (val > 0) td.style.color = '#10B981';
            else if (val < 0) td.style.color = '#EF4444';
            else td.style.color = '#374151';

            trTotal.appendChild(td);
        });

        tbody.appendChild(trTotal);

        table.appendChild(tbody);
        wrapper.appendChild(table);
        container.appendChild(wrapper);
    };

    // Load Data
    const loadData = async () => {
        try {
            // Show loading state if table exists
            const wrapper = container.querySelector('.fechamento-table-wrapper');
            if (wrapper) wrapper.style.opacity = '0.5';

            // 1. Load Report Data (now includes companies)
            let startStr, endStr;

            if (viewMode === 'monthly') {
                startStr = `${startMonth.getFullYear()}-${(startMonth.getMonth() + 1).toString().padStart(2, '0')}`;
                endStr = `${endMonth.getFullYear()}-${(endMonth.getMonth() + 1).toString().padStart(2, '0')}`;
            } else {
                startStr = startMonth.toISOString().split('T')[0];
                endStr = endMonth.toISOString().split('T')[0];
            }

            let url = `${API_BASE_URL}/fechamento?projectId=${project.id}&startMonth=${startStr}&endMonth=${endStr}&viewMode=${viewMode}`;

            // Add account filter if any selected
            if (selectedAccountIds.length > 0) {
                selectedAccountIds.forEach(id => {
                    url += `&accountIds=${id}`;
                });
            }

            const reportResp = await fetch(url, { headers: getHeaders() });

            if (reportResp.ok) {
                const reportData = await reportResp.json();
                initialBalances = reportData.initialBalances || {};
                movementsData = reportData.movements || {};
                companies = reportData.companies || [];

                // Build accounts list from companies
                accounts = [];
                companies.forEach(company => {
                    company.accounts.forEach(acc => {
                        accounts.push({
                            id: acc.account_id,
                            name: acc.account_name,
                            company_id: company.company_id,
                            company_name: company.company_name
                        });
                    });
                });

                // Initialize hierarchical filter if not yet created
                if (!hierarchicalFilter && companies.length > 0) {
                    const filterContainer = document.getElementById('hierarchical-filter-container');
                    if (filterContainer) {
                        const filterData = companies.map(company => ({
                            id: `company-${company.company_id}`,
                            label: company.company_name,
                            children: company.accounts.map(acc => ({
                                id: acc.account_id.toString(),
                                label: acc.account_name
                            }))
                        }));

                        hierarchicalFilter = new HierarchicalFilter({
                            container: filterContainer,
                            data: filterData,
                            onChange: (ids) => {
                                selectedAccountIds = ids.map(id => parseInt(id));
                                loadData();
                            },
                            placeholder: 'Todas as contas'
                        });
                    }
                }
            } else {
                console.error('Failed to load report data');
                initialBalances = {};
                movementsData = {};
                companies = [];
                accounts = [];
            }

            renderTable();

        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar dados', 'error');
            renderTable();
        }
    };

    // Initial Render
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>🎚️ Fechamento de Contas</h2>
             <div style="display: flex; gap: 0.5rem;">
                 <a href="#" style="font-size: 0.9rem; color: var(--color-primary);">Lar</a>
                 <span style="color: var(--color-text-muted);">/</span>
                 <span style="font-size: 0.9rem; color: var(--color-text-muted);">fechamento</span>
            </div>
        </div>
    `;

    const controlsElement = renderControls();
    container.appendChild(controlsElement);

    // Export Handlers
    setTimeout(() => {
        const btnExcel = container.querySelector('#btn-excel-fech');
        const btnPdf = container.querySelector('#btn-pdf-fech');

        if (btnExcel) {
            btnExcel.onclick = async () => {
                try {
                    if (accounts.length === 0) {
                        showToast('Sem dados para exportar', 'warning');
                        return;
                    }

                    // Load ExcelJS if not already loaded
                    if (!window.ExcelJS) {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
                        await new Promise((resolve, reject) => {
                            script.onload = resolve;
                            script.onerror = reject;
                            document.head.appendChild(script);
                        });
                    }

                    const workbook = new window.ExcelJS.Workbook();
                    const worksheet = workbook.addWorksheet('Fechamento de Contas');

                    const columns = getColumnList();

                    // Group accounts by company
                    const companyGroups = {};
                    accounts.forEach(acc => {
                        if (!companyGroups[acc.company_id]) {
                            companyGroups[acc.company_id] = {
                                company_name: acc.company_name,
                                accounts: []
                            };
                        }
                        companyGroups[acc.company_id].accounts.push(acc);
                    });

                    // Define columns
                    worksheet.columns = [
                        { header: 'Empresa', key: 'empresa', width: 20 },
                        { header: 'Conta Bancária', key: 'conta', width: 25 },
                        ...columns.map(d => ({
                            header: formatDateHeader(d),
                            key: `col_${d.getTime()}`,
                            width: 15
                        }))
                    ];

                    // Style header row
                    const headerRow = worksheet.getRow(1);
                    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    headerRow.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF00425F' }
                    };
                    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
                    headerRow.height = 25;

                    let currentRow = 2;
                    const monthTotals = new Array(columns.length).fill(0);

                    // Add data rows grouped by company
                    Object.values(companyGroups).forEach((group, groupIndex) => {
                        const startRow = currentRow;
                        const isEvenGroup = groupIndex % 2 === 0;

                        group.accounts.forEach((acc, accIndex) => {
                            const row = worksheet.getRow(currentRow);
                            const rowData = { empresa: group.company_name, conta: acc.name };

                            let currentBalance = initialBalances[acc.id] || 0;

                            columns.forEach((colDate, colIndex) => {
                                let key = '';
                                if (viewMode === 'monthly') {
                                    key = `${colDate.getFullYear()}-${(colDate.getMonth() + 1).toString().padStart(2, '0')}`;
                                } else {
                                    const d = colDate.getDate().toString().padStart(2, '0');
                                    const m = (colDate.getMonth() + 1).toString().padStart(2, '0');
                                    key = `${colDate.getFullYear()}-${m}-${d}`;
                                }

                                const delta = (movementsData[acc.id] && movementsData[acc.id][key])
                                    ? movementsData[acc.id][key]
                                    : 0;
                                currentBalance += delta;
                                if (monthTotals[colIndex] === undefined) monthTotals[colIndex] = 0;
                                monthTotals[colIndex] += currentBalance;
                                rowData[`col_${colDate.getTime()}`] = currentBalance;
                            });

                            row.values = rowData;

                            // Alternating row colors (white and light gray)
                            const bgColor = isEvenGroup ? 'FFFFFFFF' : 'FFF8FAFC';
                            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                                cell.fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: bgColor }
                                };

                                // Company and Account columns: dark blue background, white text
                                if (colNumber <= 2) {
                                    cell.fill = {
                                        type: 'pattern',
                                        pattern: 'solid',
                                        fgColor: { argb: 'FF00425F' }
                                    };
                                    cell.font = { color: { argb: 'FFFFFFFF' }, bold: colNumber === 1 };

                                    // BORDERS: Match screen logic
                                    // Col 1 (Empresa) -> Right White
                                    // Col 2 (Conta) -> Right Blue #00425F (to fix "dente") - but here background is already blue, so border color doesn't matter unless it's contrasting.
                                    // Actually, in Excel, if bg is blue, blue border is invisible. 
                                    // But we need the separator. The screen uses white borders for headers/fixed columns.
                                    // EXCEPT the rightmost border of fixed columns which pushes against the scrollable area.
                                    // Screen Logic Update (from Step 1743):
                                    // Header/Data Fixed Col 2: borderRight = '2px solid #00425F' (Blue)
                                    // Since cell bg is blue, we need a way to distinguish? No, on screen fixed cols are blue.
                                    // Wait, on screen fixed cols are blue BG, white text.
                                    // The border separates Fixed Col 2 from Scrollable Col 1.
                                    // Scrollable Col 1 has white BG.
                                    // So a Blue border on Fixed Col 2 merges with Fixed Col 2 BG?
                                    // Or does Col 3 have a border?
                                    // Let's stick effectively to what looks like the screen.
                                    // Screen: Blue BG. Next col: White/Gray BG. 
                                    // If border is Blue, it blends with Col 2. Visual effect: No border between Col 2 and 3?

                                    const borderStyle = { style: 'thin', color: { argb: 'FFFFFFFF' } }; // White default
                                    // Special case: Col 2 Right Border needs to be Blue to match screen fix?
                                    // If BG is Blue, Blue border is invisible. 
                                    // Maybe the screen "Blue Border" was effectively REMOVING the white border that was there?
                                    // PROPOSAL: Set Right Border of Col 2 to match neighboring cell BG (White/Gray) or just standard Blue?
                                    // Retaining White border to match standard internal borders.

                                    cell.border = {
                                        bottom: borderStyle,
                                        right: borderStyle
                                    };

                                    // FIX: If colNumber === 2 (Conta), remove right white border to simulate the "dente" fix?
                                    // Or make it same color as header/data? 
                                    // Let's stick effectively to what looks like the screen.
                                    // Screen: Blue BG. Next col: White/Gray BG. 
                                    // If border is Blue, it blends with Col 2. Visual effect: No border between Col 2 and 3?
                                    // Or does Col 3 have a border?
                                    if (colNumber === 2) {
                                        // Use blue border to match screen fix
                                        cell.border = {
                                            bottom: borderStyle,
                                            right: { style: 'medium', color: { argb: 'FF00425F' } }
                                        };
                                    }
                                } else {
                                    // Data columns: currency formatting and color based on value
                                    cell.numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00';
                                    const value = cell.value;

                                    // Text Color
                                    if (value > 0) {
                                        cell.font = { color: { argb: 'FF10B981' } };
                                    } else if (value < 0) {
                                        cell.font = { color: { argb: 'FFEF4444' } };
                                    } else {
                                        cell.font = { color: { argb: 'FF9CA3AF' } }; // Gray for zero
                                    }

                                    // Borders for month cells (standard gray grid)
                                    cell.border = {
                                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, // slate-200
                                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                                    };
                                }

                                cell.alignment = { vertical: 'middle', horizontal: colNumber <= 2 ? 'left' : 'right' };
                            });

                            currentRow++;
                        });

                        // Merge company cells
                        if (group.accounts.length > 1) {
                            worksheet.mergeCells(`A${startRow}:A${currentRow - 1}`);
                            const mergedCell = worksheet.getCell(`A${startRow}`);
                            mergedCell.alignment = { vertical: 'middle', horizontal: 'left' };
                        }
                    });

                    // Add TOTAL row
                    const totalRow = worksheet.getRow(currentRow);
                    const totalData = { empresa: 'TOTAL', conta: '' };
                    columns.forEach((d, idx) => {
                        totalData[`col_${d.getTime()}`] = monthTotals[idx];
                    });
                    totalRow.values = totalData;

                    // Merge TOTAL cells for empresa and conta
                    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
                    const totalMergedCell = worksheet.getCell(`A${currentRow}`);
                    totalMergedCell.value = 'TOTAL';
                    totalMergedCell.alignment = { vertical: 'middle', horizontal: 'center' };

                    // Style TOTAL Row - Match Screen exactly
                    // Label (Merged A-B): Dark Blue BG, White Text
                    totalMergedCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF00425F' }
                    };
                    totalMergedCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                    totalMergedCell.border = {
                        right: { style: 'medium', color: { argb: 'FF00425F' } } // Match the "dente" fix
                    };

                    // Values (Month Cols): Gray BG (#E2E8F0), Top Border (#CBD5E1)
                    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        if (colNumber > 2) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFE2E8F0' }
                            };
                            cell.border = {
                                top: { style: 'medium', color: { argb: 'FFCBD5E1' } }
                            };

                            cell.numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00';
                            const value = cell.value;
                            if (value > 0) {
                                cell.font = { color: { argb: 'FF10B981' }, bold: true };
                            } else if (value < 0) {
                                cell.font = { color: { argb: 'FFEF4444' }, bold: true };
                            } else {
                                cell.font = { color: { argb: 'FF374151' }, bold: true };
                            }
                        }
                        // Alignment
                        cell.alignment = { vertical: 'middle', horizontal: colNumber <= 2 ? 'center' : 'right' };
                    });

                    // Freeze first row and first two columns
                    worksheet.views = [
                        { state: 'frozen', xSplit: 2, ySplit: 1 }
                    ];

                    // Generate and download file
                    const buffer = await workbook.xlsx.writeBuffer();
                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'fechamento_contas.xlsx';
                    a.click();
                    window.URL.revokeObjectURL(url);

                    showToast('Excel exportado com sucesso!', 'success');
                } catch (error) {
                    console.error('Error during Excel export:', error);
                    showToast(`Erro ao exportar: ${error.message}`, 'error');
                }
            };
        }

        if (btnPdf) {
            btnPdf.onclick = () => {
                PrintHelper.autoConfigureOrientation('.fechamento-table-wrapper table');
                window.print();
            };
        }
    }, 100);

    // Load initial data
    loadData();

    return container;
};
