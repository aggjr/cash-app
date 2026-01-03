import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { MonthPicker } from './MonthPicker.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';

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
    let initialBalances = {};
    let movementsData = {};

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

        // Fixed First Column Header
        const thFixed = document.createElement('th');
        thFixed.textContent = 'Conta Bancária';
        thFixed.style.position = 'sticky';
        thFixed.style.left = '0';
        thFixed.style.zIndex = '101'; // Higher priority than other headers (corner)
        thFixed.style.backgroundColor = '#00425F';
        thFixed.style.color = 'white';
        thFixed.style.padding = '0.5rem 0.75rem'; // Compact padding
        thFixed.style.textAlign = 'left';
        thFixed.style.width = '1%'; // Auto-shrink
        thFixed.style.whiteSpace = 'nowrap';
        thFixed.style.borderBottom = '1px solid #1e3a8a';
        thFixed.style.borderRight = '1px solid #1e3a8a';
        headerRow.appendChild(thFixed);

        // Month Columns Headers
        months.forEach(m => {
            const th = document.createElement('th');
            th.textContent = formatDateMonth(m);
            th.style.padding = '0.5rem 0.25rem';
            th.style.textAlign = 'right';
            th.style.minWidth = '120px'; // 150% of prev 80px
            th.style.width = '120px';
            th.style.borderBottom = '1px solid #1e3a8a';
            th.style.whiteSpace = 'nowrap';
            // No overflow hidden to respect "without hiding info"
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // --- TBODY ---
        const tbody = document.createElement('tbody');

        // Totals array (one per month)
        const monthTotals = new Array(months.length).fill(0);

        accounts.forEach((acc, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#FFFFFF' : '#F8FAFC';

            const tr = document.createElement('tr');

            // Fixed First Column Cell
            const tdFixed = document.createElement('td');
            tdFixed.textContent = acc.name;
            tdFixed.style.position = 'sticky';
            tdFixed.style.left = '0';
            tdFixed.style.backgroundColor = '#00425F'; // Header Match ??? No, should match row but sticky needs bg.
            // Using a specific dark grey/blue for row headers or just white/grey?
            // To match the design requests commonly: sticky columns often keep background.
            // But let's use the requested dark header style for the first column or standard row color?
            // The previous code had '#00425F' for the first column cell? That makes the first column look like a header.
            // Let's stick to the previous design if not complained about, but user asked for "standardized width".
            // If I change the color it changes design. I'll keep the previous color logic for the first column.
            tdFixed.style.backgroundColor = '#00425F';
            tdFixed.style.color = 'white';
            tdFixed.style.fontWeight = '500';
            tdFixed.style.zIndex = '10'; // Sticky Horizontal
            tdFixed.style.padding = '0.5rem 0.75rem'; // Compact
            tdFixed.style.textAlign = 'left';
            tdFixed.style.borderBottom = '1px solid #e2e8f0'; // Light, but on dark bg?
            tdFixed.style.borderBottom = '1px solid #1e3a8a'; // Match header border for consistency in dark col
            tdFixed.style.borderRight = '1px solid #1e3a8a';
            tdFixed.style.whiteSpace = 'nowrap';
            tr.appendChild(tdFixed);

            // Calculation Logic
            // Start with Pre-Period Balance
            let currentBalance = initialBalances[acc.id] || 0;

            // Month Data Cells
            months.forEach((m, mIndex) => {
                const monthKey = `${m.getFullYear()}-${(m.getMonth() + 1).toString().padStart(2, '0')}`;

                // Get Delta for this month (In - Out)
                const monthDelta = (movementsData[acc.id] && movementsData[acc.id][monthKey])
                    ? movementsData[acc.id][monthKey]
                    : 0;

                // Update Running Balance
                currentBalance += monthDelta;

                // Add to Column Total
                monthTotals[mIndex] += currentBalance;

                const td = document.createElement('td');
                const val = currentBalance;

                td.textContent = formatCurrency(val);
                td.style.backgroundColor = bgColor;
                td.style.padding = '0.5rem 0.25rem'; // Match header compact padding
                td.style.textAlign = 'right';
                td.style.borderBottom = '1px solid #e2e8f0';
                td.style.whiteSpace = 'nowrap'; // Prevent wrapping of currency

                // Color Logic: Positive Green, Negative Red
                if (val > 0) td.style.color = '#10B981'; // Green
                else if (val < 0) td.style.color = '#EF4444'; // Red
                else td.style.color = '#9ca3af'; // Gray for zero

                td.addEventListener('mouseenter', () => td.style.backgroundColor = 'rgba(218, 177, 119, 0.5)');
                td.addEventListener('mouseleave', () => td.style.backgroundColor = bgColor);

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        // --- TOTAL ROW ---
        const trTotal = document.createElement('tr');
        trTotal.style.fontWeight = '700';
        trTotal.style.backgroundColor = '#f0f9ff'; // Light highlight

        // Fixed First Cell (Label TOTAL)
        const tdTotalLabel = document.createElement('td');
        tdTotalLabel.textContent = 'TOTAL';
        tdTotalLabel.style.position = 'sticky';
        tdTotalLabel.style.left = '0';
        tdTotalLabel.style.backgroundColor = '#00425F';
        tdTotalLabel.style.color = 'white';
        tdTotalLabel.style.zIndex = '10';
        tdTotalLabel.style.padding = '0.5rem 0.75rem';
        tdTotalLabel.style.textAlign = 'center'; // Summary align
        tdTotalLabel.style.borderTop = '2px solid #00425F';
        tdTotalLabel.style.whiteSpace = 'nowrap';
        trTotal.appendChild(tdTotalLabel);

        // Month Totals
        monthTotals.forEach(val => {
            const td = document.createElement('td');
            td.textContent = formatCurrency(val);
            td.style.padding = '0.5rem 0.5rem';
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

            // 1. Load Accounts (if not loaded)
            if (accounts.length === 0) {
                const accountsResp = await fetch(`${API_BASE_URL}/accounts?projectId=${project.id}`, { headers: getHeaders() });
                if (!accountsResp.ok) throw new Error('Failed to load accounts');
                accounts = await accountsResp.json();
            }

            // 2. Load Report Data
            const startStr = `${startMonth.getFullYear()}-${(startMonth.getMonth() + 1).toString().padStart(2, '0')}`;
            const endStr = `${endMonth.getFullYear()}-${(endMonth.getMonth() + 1).toString().padStart(2, '0')}`;

            const reportResp = await fetch(`${API_BASE_URL}/fechamento?projectId=${project.id}&startMonth=${startStr}&endMonth=${endStr}`, { headers: getHeaders() });

            if (reportResp.ok) {
                const reportData = await reportResp.json();
                initialBalances = reportData.initialBalances || {};
                movementsData = reportData.movements || {};
            } else {
                console.error('Failed to load report data');
                initialBalances = {};
                movementsData = {};
            }

            renderTable();

        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar dados', 'error');
            // Mock if fails
            if (accounts.length === 0) accounts = [{ name: 'Conta Teste 1', id: -1 }];
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

                    const months = getMonthList();
                    const exportData = [];

                    // Prepare data rows
                    accounts.forEach(acc => {
                        const row = { 'Conta Bancária': acc.name };
                        let currentBalance = initialBalances[acc.id] || 0;

                        months.forEach(m => {
                            const monthKey = `${m.getFullYear()}-${(m.getMonth() + 1).toString().padStart(2, '0')}`;
                            const monthDelta = (movementsData[acc.id] && movementsData[acc.id][monthKey])
                                ? movementsData[acc.id][monthKey]
                                : 0;
                            currentBalance += monthDelta;
                            row[formatDateMonth(m)] = currentBalance;
                        });

                        exportData.push(row);
                    });

                    // Add totals row
                    const totalsRow = { 'Conta Bancária': 'TOTAL' };
                    const monthTotals = new Array(months.length).fill(0);

                    accounts.forEach(acc => {
                        let currentBalance = initialBalances[acc.id] || 0;
                        months.forEach((m, mIndex) => {
                            const monthKey = `${m.getFullYear()}-${(m.getMonth() + 1).toString().padStart(2, '0')}`;
                            const monthDelta = (movementsData[acc.id] && movementsData[acc.id][monthKey])
                                ? movementsData[acc.id][monthKey]
                                : 0;
                            currentBalance += monthDelta;
                            monthTotals[mIndex] += currentBalance;
                        });
                    });

                    months.forEach((m, idx) => {
                        totalsRow[formatDateMonth(m)] = monthTotals[idx];
                    });
                    exportData.push(totalsRow);

                    // Define columns (Account + Month columns)
                    const columns = [
                        { header: 'Conta Bancária', key: 'Conta Bancária', width: 30, type: 'text' }
                    ];

                    months.forEach(m => {
                        columns.push({
                            header: formatDateMonth(m),
                            key: formatDateMonth(m),
                            width: 15,
                            type: 'currency'
                        });
                    });

                    await ExcelExporter.exportTable(
                        exportData,
                        columns,
                        'Relatório de Fechamento de Contas',
                        'fechamento_contas'
                    );
                } catch (error) {
                    console.error('Error during Excel export:', error);
                    showToast(`Erro ao exportar: ${error.message}`, 'error');
                }
            };
        }

        if (btnPdf) {
            btnPdf.onclick = () => window.print();
        }
    }, 100);

    // Load initial data
    loadData();

    return container;
};
