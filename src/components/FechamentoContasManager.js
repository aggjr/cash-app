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

    // Helper to parse saved date or default
    const parseSavedDate = (saved, defaultDate) => {
        if (!saved) return defaultDate;
        const d = new Date(saved);
        return isNaN(d.getTime()) ? defaultDate : d;
    };

    let startMonth = parseSavedDate(localStorage.getItem(storageKeyStart), new Date(today.getFullYear(), 0, 1));
    let endMonth = parseSavedDate(localStorage.getItem(storageKeyEnd), new Date(today.getFullYear(), 11, 1));

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

    // Helper to generate array of months between start and end
    const getMonthList = () => {
        const months = [];
        const current = new Date(startMonth);
        const end = new Date(endMonth);

        // Normalize to first day of month to avoid overflow issues
        current.setDate(1);
        end.setDate(1);
        current.setHours(12);
        end.setHours(12);

        while (current <= end) {
            months.push(new Date(current));
            current.setMonth(current.getMonth() + 1);
        }
        return months;
    };

    const formatDateMonth = (date) => {
        const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
        // Format: MM/YYYY (MM/AAAA)
        return `${monthStr}/${date.getFullYear()}`;
    };

    // --- Render Functions ---

    const renderControls = () => {
        const containerDiv = document.createElement('div');
        containerDiv.className = 'fechamento-controls';

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '2rem';
        controls.style.marginBottom = '1rem'; // Reduced margin
        controls.style.alignItems = 'flex-end';
        controls.className = 'animate-float-in';

        // Start Month Input
        const startDiv = document.createElement('div');
        const startLabel = document.createElement('label');
        startLabel.textContent = 'Mês Inicial';
        startLabel.style.display = 'block';
        startLabel.style.marginBottom = '0.25rem'; // Reduced
        startLabel.style.fontWeight = '500';
        startLabel.style.fontSize = '0.9rem'; // Smaller label
        startLabel.style.color = '#374151';

        const startStr = `${startMonth.getFullYear()}-${(startMonth.getMonth() + 1).toString().padStart(2, '0')}`;
        const startPicker = MonthPicker(startStr, (val) => {
            if (val) {
                const parts = val.split('-');
                if (parts.length === 2) {
                    startMonth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1, 12);
                    localStorage.setItem(storageKeyStart, startMonth.toISOString()); // Persist
                    loadData();
                }
            }
        });

        startDiv.appendChild(startLabel);
        startDiv.appendChild(startPicker);

        // End Month Input
        const endDiv = document.createElement('div');
        const endLabel = document.createElement('label');
        endLabel.textContent = 'Mês Final';
        endLabel.style.display = 'block';
        endLabel.style.marginBottom = '0.25rem';
        endLabel.style.fontWeight = '500';
        endLabel.style.fontSize = '0.9rem';
        endLabel.style.color = '#374151';

        const endStr = `${endMonth.getFullYear()}-${(endMonth.getMonth() + 1).toString().padStart(2, '0')}`;
        const endPicker = MonthPicker(endStr, (val) => {
            if (val) {
                const parts = val.split('-');
                if (parts.length === 2) {
                    endMonth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1, 12);
                    localStorage.setItem(storageKeyEnd, endMonth.toISOString()); // Persist
                    loadData();
                }
            }
        });

        endDiv.appendChild(endLabel);
        endDiv.appendChild(endPicker);

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

        const months = getMonthList();

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
        thCompany.style.width = '1%';
        thCompany.style.whiteSpace = 'nowrap';
        thCompany.style.borderBottom = '2px solid white';
        thCompany.style.borderRight = '2px solid white';
        headerRow.appendChild(thCompany);

        // Fixed Account Column Header
        const thFixed = document.createElement('th');
        thFixed.textContent = 'Conta Bancária';
        thFixed.style.position = 'sticky';
        thFixed.style.left = '0'; // Will be calculated dynamically
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
        months.forEach((m, index) => {
            const th = document.createElement('th');
            th.textContent = formatDateMonth(m);
            th.style.padding = 'var(--row-padding)';
            th.style.textAlign = 'right';
            th.style.minWidth = '120px'; // 150% of prev 80px
            th.style.width = '120px';
            th.style.borderBottom = '1px solid #1e3a8a';
            th.style.whiteSpace = 'nowrap';

            // Removed blue right border from first month column

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
                tdFixed.style.left = '0'; // Will overlap company column
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

                // Month Data Cells
                months.forEach((m, mIndex) => {
                    const monthKey = `${m.getFullYear()}-${(m.getMonth() + 1).toString().padStart(2, '0')}`;
                    const monthDelta = (movementsData[acc.id] && movementsData[acc.id][monthKey])
                        ? movementsData[acc.id][monthKey]
                        : 0;

                    currentBalance += monthDelta;
                    monthTotals[mIndex] += currentBalance;

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
        tdTotalLabel.style.left = '0';
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
        monthTotals.forEach((val, index) => {
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
            const startStr = `${startMonth.getFullYear()}-${(startMonth.getMonth() + 1).toString().padStart(2, '0')}`;
            const endStr = `${endMonth.getFullYear()}-${(endMonth.getMonth() + 1).toString().padStart(2, '0')}`;

            let url = `${API_BASE_URL}/fechamento?projectId=${project.id}&startMonth=${startStr}&endMonth=${endStr}`;

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

                    const months = getMonthList();

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
                        ...months.map(m => ({
                            header: formatDateMonth(m),
                            key: `month_${m.getTime()}`,
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
                    const monthTotals = new Array(months.length).fill(0);

                    // Add data rows grouped by company
                    Object.values(companyGroups).forEach((group, groupIndex) => {
                        const startRow = currentRow;
                        const isEvenGroup = groupIndex % 2 === 0;

                        group.accounts.forEach((acc, accIndex) => {
                            const row = worksheet.getRow(currentRow);
                            const rowData = { empresa: group.company_name, conta: acc.name };

                            let currentBalance = initialBalances[acc.id] || 0;

                            months.forEach((m, mIndex) => {
                                const monthKey = `${m.getFullYear()}-${(m.getMonth() + 1).toString().padStart(2, '0')}`;
                                const monthDelta = (movementsData[acc.id] && movementsData[acc.id][monthKey])
                                    ? movementsData[acc.id][monthKey]
                                    : 0;
                                currentBalance += monthDelta;
                                monthTotals[mIndex] += currentBalance;
                                rowData[`month_${m.getTime()}`] = currentBalance;
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
                                    // Actually, in Excel, if bg is blue, right border blue is invisible. 
                                    // But we need the separator. The screen uses white borders for headers/fixed columns.
                                    // EXCEPT the rightmost border of fixed columns which pushes against the scrollable area.
                                    // Screen Logic Update (from Step 1743):
                                    // Header/Data Fixed Col 2: borderRight = '2px solid #00425F' (Blue)
                                    // Since cell bg is blue, we need a way to distinguish? No, on screen fixed cols are blue.
                                    // Wait, on screen fixed cols are blue BG, white text.
                                    // The border separates Fixed Col 2 from Scrollable Col 1.
                                    // Scrollable Col 1 has white BG.
                                    // So a Blue border on Fixed Col 2 merges with Fixed Col 2 BG?
                                    // Let's look at screen logic again.
                                    // Fixed data cells (Empresa/Conta) have blue BG?
                                    // No, looking at screenshot (Step 1770), Empresa/Conta have DARK BLUE BG.
                                    // Step 1743:
                                    // thFixed.style.borderRight = '2px solid #00425F'; (Header)
                                    // tdFixed.style.borderRight = '2px solid #00425F'; (Data)
                                    // WAIT. The data cells (tdFixed) in `FechamentoContasManager.js` (lines 310-330)
                                    // actually have `tdFixed.style.backgroundColor = '#00425F';` inside the `item` loop?
                                    // Let's check `view_file` 325.
                                    // It seems lines 580+ in Export logic assumes `backgroundColor` is Blue for cols 1-2.

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
                                    // Month columns: currency formatting and color based on value
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
                    months.forEach((m, idx) => {
                        totalData[`month_${m.getTime()}`] = monthTotals[idx];
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
