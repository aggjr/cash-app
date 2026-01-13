import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { PrintHelper } from '../utils/printHelper.js';
import { FlatMultiSelect } from './FlatMultiSelect.js';

export const PrevisaoFluxoManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '0';
    container.style.margin = '0.5rem';
    container.style.height = 'calc(100vh - 40px)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.position = 'relative';
    container.style.color = '#1f2937';

    // --- State ---
    const today = new Date();
    // Default to current month range
    let startStr = localStorage.getItem('previsao_startDate') || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    let endStr = localStorage.getItem('previsao_endDate') || new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    let expandedNodes = new Set();
    let forecastData = null; // { initialBalance: 0, data: [] }
    let selectedCompanyIds = [];
    let companies = [];
    let accounts = [];

    // --- Helper: Format Currency ---
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    // --- Helper: Generate Day Array ---
    const getDays = () => {
        const days = [];
        let current = new Date(startStr);
        // Fix timezone offset issue by setting T12:00:00 or using UTC?
        // Simple way: Add T00:00:00 and handle date object carefully.
        // Or just manipulate the string if we stick to YYYY-MM-DD.
        // Let's use Date object with T12:00:00 to avoid timezone rollover bugs.
        current = new Date(startStr + 'T12:00:00');
        const end = new Date(endStr + 'T12:00:00');

        while (current <= end) {
            days.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return days;
    };

    // Pre-declare renderTable
    let renderTable;

    // --- Load Metadata (Companies/Accounts) ---
    const loadMetadata = async () => {
        try {
            const token = localStorage.getItem('token');

            // Fetch companies
            const compResp = await fetch(`${API_BASE_URL}/companies?projectId=${project.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (compResp.ok) {
                companies = await compResp.json();
            }

            // Initialize filter
            const filterContainer = document.getElementById('previsao-filter-container');
            if (filterContainer && companies.length > 0) {
                // Map company data
                const filterData = companies.map(c => ({
                    id: c.id,
                    label: c.name
                }));

                new FlatMultiSelect({
                    container: filterContainer,
                    data: filterData,
                    onChange: (ids) => {
                        selectedCompanyIds = ids;
                        loadData();
                    },
                    placeholder: 'Todas as Empresas'
                });
            }
        } catch (e) {
            console.error('Error loading metadata', e);
        }
    };

    // --- Fetch Data ---
    const loadData = async () => {
        const overlay = container.querySelector('.loading-overlay');
        try {
            if (overlay) overlay.style.display = 'flex';

            const token = localStorage.getItem('token');
            let query = `projectId=${project.id}&startDate=${startStr}&endDate=${endStr}`;
            if (selectedCompanyIds.length > 0) {
                query += `&companyIds=${selectedCompanyIds.join(',')}`;
            }
            const url = `${API_BASE_URL}/previsao?${query}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao carregar previsão');

            forecastData = await response.json();
            console.log('[FORECAST DATA]', forecastData.data?.find(n => n.id === 'entradas_root'));
            if (renderTable) renderTable();

        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            if (overlay) overlay.style.display = 'none';
        }
    };

    // --- Render Table ---
    renderTable = () => {
        const tableContainer = container.querySelector('#previsao-table-container');
        const days = getDays();

        // Calculate Day Balances
        // We need an array map of day -> { initial, final }
        // starting with forecastData.initialBalance
        const dayBalances = {};
        const initialBalance = forecastData?.initialBalance || 0;
        let runningBalance = initialBalance;

        // Extract roots for easy access
        // If data is null/loading, these remain undefined, and rows won't render (just headers/footer)
        const data = forecastData?.data || [];
        const aportesRoot = data.find(n => n.id === 'aportes_root'); // Positive Flow
        const retiradasRoot = data.find(n => n.id === 'retiradas_root'); // Negative Flow
        const emprestimosRoot = data.find(n => n.id === 'emprestimos_root'); // Positive Flow - Loans
        const entradasRoot = data.find(n => n.id === 'entradas_root');
        const saidasRoot = data.find(n => n.id === 'saidas_root');
        const producaoRoot = data.find(n => n.id === 'producao_root');
        const pagamentosEmprestimosRoot = data.find(n => n.id === 'pagamentos_emprestimos_root');

        days.forEach(day => {
            const inVal = (entradasRoot?.dailyTotals[day] || 0) + (aportesRoot?.dailyTotals[day] || 0) + (emprestimosRoot?.dailyTotals[day] || 0);
            const outVal = (saidasRoot?.dailyTotals[day] || 0) + (producaoRoot?.dailyTotals[day] || 0) + (retiradasRoot?.dailyTotals[day] || 0) + (pagamentosEmprestimosRoot?.dailyTotals[day] || 0);

            const initial = runningBalance;
            const final = initial + inVal - outVal;

            dayBalances[day] = { initial, final };
            runningBalance = final;
            dayBalances[day] = { initial, final };
            runningBalance = final;
        });

        // --- IVA Context Broadcast (The Eyes) ---
        if (window.IVA && window.IVA.updateScreenContext) {
            // Calculate metrics for EVA
            let lowestBalance = Infinity;
            let lowestDate = null;
            let negativeDays = [];

            days.forEach(d => {
                const bal = dayBalances[d].final;
                if (bal < lowestBalance) {
                    lowestBalance = bal;
                    lowestDate = d;
                }
                if (bal < 0) {
                    negativeDays.push({ date: d, balance: bal });
                }
            });

            window.IVA.updateScreenContext({
                screenId: 'previsao-fluxo', // FIXED: Match actual screen ID
                title: 'Previsão de Fluxo de Caixa',
                summary: {
                    startDate: startStr,
                    endDate: endStr,
                    initialBalance: forecastData?.initialBalance || 0,
                    finalBalance: runningBalance,
                    lowestBalance,
                    lowestDate,
                    negativeDaysCount: negativeDays.length,
                    totalDays: days.length
                },
                critical_risks: negativeDays.length > 0 ? negativeDays : null,
                // FIXED: Send ALL days data, not just 5
                forecast_data: days.map(d => ({
                    date: d,
                    initial_balance: dayBalances[d].initial,
                    final_balance: dayBalances[d].final,
                    income: dayBalances[d].income,
                    expense: dayBalances[d].expense
                }))
            });
        }

        // Header
        let html = `
            <table style="width: auto; min-width: 50%; border-collapse: separate; border-spacing: 0;">
                <thead style="position: sticky; top: 0; z-index: 20; background-color: #00425F; color: white;">
                    <tr>
                        <th style="padding: 0.4rem 0.5rem; text-align: left; border-bottom: 2px solid #e5e7eb; min-width: 300px; position: sticky; left: 0; z-index: 21; background-color: #00425F;">TRANSAÇÕES</th>
                        ${days.map(d => {
            const [y, m, day] = d.split('-');
            return `<th style="padding: 0.4rem 0.5rem; text-align: center; border-bottom: 2px solid #e5e7eb; min-width: 120px;">${day}/${m}</th>`;
        }).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        // 1. SALDO INICIAL ROW
        html += `
            <tr style="background-color: #e0f2fe;">
                <td style="padding: 0.35rem 1rem; font-weight: 800; border-bottom: 2px solid #cbd5e1; position: sticky; left: 0; z-index: 5; background-color: #e0f2fe; font-size: 0.8rem;">Saldo Inicial</td>
                ${days.map(d => {
            const val = dayBalances[d].initial;
            const color = val >= 0 ? '#10B981' : '#EF4444';
            return `<td style="padding: 0.35rem 0.5rem; text-align: right; font-weight: 800; color: ${color}; border-bottom: 2px solid #cbd5e1; font-size: 0.8rem;">${formatCurrency(val)}</td>`;
        }).join('')}
            </tr>
        `;

        // Recursive Row Renderer
        const renderRows = (nodes, level = 0) => {
            nodes.forEach(node => {
                const isRoot = ['saidas_root', 'producao_root', 'entradas_root', 'aportes_root', 'retiradas_root', 'emprestimos_root', 'pagamentos_emprestimos_root'].includes(node.id);
                if (!isRoot && Math.abs(node.total) < 0.01) return;

                const hasChildren = node.children && node.children.length > 0;
                const isExpanded = expandedNodes.has(node.id);
                const paddingLeft = level * 1.5 + 1;

                const bgColor = '#ffffff'; // All data rows white
                const fontWeight = level === 0 ? '700' : (hasChildren ? '600' : '400');
                const rowClass = (hasChildren ? 'expandable-row' : '') + ' data-row';

                // Standardized Font Size (Match Consolidadas)
                const baseSizeRem = 0.85;
                const decreasePerLevel = 0.03;
                const fontSizeNum = baseSizeRem - (level * decreasePerLevel);
                const fontSize = `${fontSizeNum}rem`;


                let dayCells = '';
                days.forEach(d => {
                    const val = node.dailyTotals[d] || 0;
                    const delayedVal = node.dailyDelayed?.[d] || 0;
                    const overdueVal = node.dailyOverdue?.[d] || 0;

                    let cellContent = '';

                    // Determine if this is a positive flow node (for color logic)
                    const isPositiveFlow = node.id && (
                        node.id.toString().startsWith('entradas') ||
                        node.id.toString().includes('tipo_entrada') ||
                        node.id.toString().startsWith('aportes') ||
                        node.id.toString().startsWith('emprestimos')
                    );

                    // Calculate total to display (val includes delayedVal in backend)
                    // If there's a delayed value, we need to subtract it from val to avoid showing twice
                    const normalVal = val - delayedVal;
                    const isOverdue = Math.abs(overdueVal) > 0.001;

                    // Render normal value (green/red based on flow)
                    // NOW INCLUDES OVERDUE VALUES (as requested)
                    if (Math.abs(normalVal) > 0.001) {
                        const color = isPositiveFlow
                            ? (normalVal >= 0 ? '#10B981' : '#EF4444')
                            : (normalVal >= 0 ? '#EF4444' : '#10B981'); // Inverted for negatives

                        // Add Exclamation if overdue
                        const icon = isOverdue ? ' <span style="font-size: 1.2em; color: #F59E0B;" title="Item vencido (incluído no cálculo)">!</span>' : '';

                        cellContent += `<span style="color: ${color}; font-weight: 600; font-size: ${fontSize};">${formatCurrency(normalVal)}${icon}</span>`;
                    }

                    // Render delayed value (normal colors + warning icon ⚠)
                    if (Math.abs(delayedVal) > 0.001) {
                        if (cellContent) cellContent += '<br>';
                        const color = isPositiveFlow
                            ? (delayedVal >= 0 ? '#10B981' : '#EF4444')
                            : (delayedVal >= 0 ? '#EF4444' : '#10B981');
                        cellContent += `<span style="color: ${color}; font-weight: 600; font-size: ${fontSize};" title="Data prevista passou, mas adiado">⚠ ${formatCurrency(delayedVal)}</span>`;
                    }

                    // Removed separate "Overdue" block (Gray/Italic) because it's now merged into normalVal

                    // Default to '-' if all are zero
                    if (!cellContent) cellContent = '-';

                    // Highlight Style for Overdue
                    let cellStyle = `padding: 0.35rem 0.5rem; text-align: right; border-bottom: 1px solid #f3f4f6; position: relative; z-index: 1;`;
                    if (isOverdue) {
                        cellStyle += ` background-color: #E0F2FE;`; // Blue highlight
                    }

                    dayCells += `<td style="${cellStyle}">${cellContent}</td>`;
                });

                html += `
                    <tr class="${rowClass}" data-id="${node.id}" style="background-color: ${bgColor}; cursor: ${hasChildren ? 'pointer' : 'default'}; transition: background-color 0.2s;">
                        <td class="sticky-col" style="padding: 0; border-bottom: 1px solid #f3f4f6; position: sticky; left: 0; z-index: 10; background-color: #ffffff; transition: background-color 0.2s;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 1rem 0.35rem ${paddingLeft}rem; font-weight: ${fontWeight}; font-size: ${fontSize}; min-height: 100%;">
                                ${hasChildren ? `<span style="font-size: 0.8rem; transform: rotate(${isExpanded ? '90deg' : '0deg'}); transition: transform 0.2s;">▶</span>` : ''}
                                ${node.name}
                            </div>
                        </td>
                        ${dayCells}
                    </tr>
                `;

                if (hasChildren && isExpanded) {
                    renderRows(node.children, level + 1);
                }
            });
        };

        // Render Trees in Order
        // Requested Order: 
        // 1. Aportes (Before Entradas)
        // 2. Entradas
        // 3. Saidas
        // 4. Producao / Revenda
        // 5. Retiradas (After Producao)

        if (data && data.length > 0) {
            // Find roots
            const aportes = forecastData.data.find(n => n.id === 'aportes_root'); // + Flat
            const retiradas = forecastData.data.find(n => n.id === 'retiradas_root'); // - Flat
            const emprestimos = forecastData.data.find(n => n.id === 'emprestimos_root'); // + Flat - Loans
            const pagamentosEmprestimos = forecastData.data.find(n => n.id === 'pagamentos_emprestimos_root'); // - Flat - Loan Payments
            const entradas = forecastData.data.find(n => n.id === 'entradas_root'); // + Tree
            const saidas = forecastData.data.find(n => n.id === 'saidas_root'); // - Tree
            const producao = forecastData.data.find(n => n.id === 'producao_root'); // - Tree

            if (aportes) renderRows([aportes]);
            if (retiradas) renderRows([retiradas]);
            if (emprestimos) renderRows([emprestimos]);
            if (pagamentosEmprestimos) renderRows([pagamentosEmprestimos]);
            if (entradas) renderRows([entradas]); // Group Entradas
            if (saidas) renderRows([saidas]);
            if (producao) renderRows([producao]);
        }

        // 2. SALDO FINAL ROW
        html += `
            <tr style="background-color: #e0f2fe;">
                <td style="padding: 0.35rem 1rem; font-weight: 800; border-top: 2px solid #cbd5e1; position: sticky; left: 0; z-index: 5; background-color: #e0f2fe; font-size: 0.8rem;">Saldo Final</td>
                ${days.map(d => {
            const val = dayBalances[d].final;
            const color = val >= 0 ? '#10B981' : '#EF4444';
            return `<td style="padding: 0.35rem 0.5rem; text-align: right; font-weight: 800; color: ${color}; border-top: 2px solid #cbd5e1; font-size: 0.8rem;">${formatCurrency(val)}</td>`;
        }).join('')}
            </tr>
        `;

        // 3. RELATIVE DAYS ROW
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        html += `
            <tr style="background-color: #f9fafb;">
                <td style="padding: 0.35rem 1rem; font-weight: 600; font-size: 0.75rem; color: #6B7280; border-top: 2px solid #cbd5e1; position: sticky; left: 0; z-index: 5; background-color: #f9fafb;">Dias Relativos</td>
                ${days.map(d => {
            const cellDate = new Date(d + 'T00:00:00');
            const diffTime = cellDate - todayDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Style for Today (0)
            let style = "color: #6B7280;";
            if (diffDays === 0) style = "color: #00425F; font-weight: bold; background-color: #e0f2fe;";

            return `<td style="padding: 0.35rem 0.5rem; text-align: right; font-size: 0.75rem; ${style} border-top: 2px solid #cbd5e1;">${diffDays}</td>`;
        }).join('')}
            </tr>
        `;

        html += '</tbody></table>';
        tableContainer.innerHTML = html;

        // Listeners: Expand/Collapse
        tableContainer.querySelectorAll('.expandable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const id = row.dataset.id;
                if (expandedNodes.has(id)) expandedNodes.delete(id);
                else expandedNodes.add(id);
                renderTable();
            });
        });

        // Listeners: Hover Effect (Gold)
        tableContainer.querySelectorAll('.data-row').forEach(row => {
            row.addEventListener('mouseenter', () => {
                const color = '#EDD8BB'; // Solid gold (rgba(218,177,119,0.5) on white)
                row.style.backgroundColor = color;
                const sticky = row.querySelector('.sticky-col');
                if (sticky) sticky.style.backgroundColor = color;
            });
            row.addEventListener('mouseleave', () => {
                const color = '#ffffff'; // Reset to white
                row.style.backgroundColor = color;
                const sticky = row.querySelector('.sticky-col');
                if (sticky) sticky.style.backgroundColor = color;
            });
        });
    };

    // --- Build Header ---
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.justifyContent = 'space-between';
    controls.style.alignItems = 'center';
    controls.style.padding = '1rem';
    controls.style.backgroundColor = 'white';
    controls.style.borderBottom = '1px solid #e5e7eb';
    controls.style.borderRadius = '8px 8px 0 0';

    controls.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1.5rem;">
             <!-- Company Filter -->
             <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.9rem; color: #4B5563; font-weight: 500;">Empresas:</label>
                <div id="previsao-filter-container"></div>
             </div>
             <!-- Date Range -->
             <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.9rem; color: #4B5563;">De:</label>
                <input type="date" id="start-date" value="${startStr}" style="padding: 0.4rem; border: 1px solid #d1d5db; border-radius: 4px; font-family: inherit;">
                
                <label style="font-size: 0.9rem; color: #4B5563;">Até:</label>
                <input type="date" id="end-date" value="${endStr}" style="padding: 0.4rem; border: 1px solid #d1d5db; border-radius: 4px; font-family: inherit;">
             </div>
             <div style="display: flex; gap: 0.5rem;">
                 <button id="btn-excel-prev" class="btn-outline">📊 Excel</button>
                 <button id="btn-pdf-prev" class="btn-outline">🖨️ PDF</button>
             </div>
        </div>
        
        <div style="font-size: 1.2rem; font-weight: bold; color: #00425F;">
            📊 Previsão Diária
        </div>
    `;

    // --- Container ---
    const tableContainer = document.createElement('div');
    tableContainer.id = 'previsao-table-container';
    tableContainer.style.flex = '1';
    tableContainer.style.overflow = 'auto';

    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay hidden';
    loadingOverlay.innerHTML = '<div class="spinner"></div>';

    // Style loading overlay... (omitted detailed css for brevity, assume class works or basic style)
    loadingOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.7);display:none;justify-content:center;align-items:center;z-index:50;';

    container.appendChild(controls);
    container.appendChild(tableContainer);
    container.appendChild(loadingOverlay);

    // --- Listeners ---
    const startInput = controls.querySelector('#start-date');
    const endInput = controls.querySelector('#end-date');

    const handleDateChange = () => {
        startStr = startInput.value;
        endStr = endInput.value;
        localStorage.setItem('previsao_startDate', startStr);
        localStorage.setItem('previsao_endDate', endStr);
        loadData(); // Auto-refresh
    };

    startInput.addEventListener('change', handleDateChange);
    endInput.addEventListener('change', handleDateChange);

    // Export Handlers
    setTimeout(() => {
        const btnExcel = container.querySelector('#btn-excel-prev');
        const btnPdf = container.querySelector('#btn-pdf-prev');

        if (btnExcel) {
            btnExcel.onclick = async () => {
                try {
                    if (!forecastData || !forecastData.data) {
                        showToast('Sem dados para exportar', 'warning');
                        return;
                    }

                    const days = getDays();
                    const exportData = [];

                    // Flatten hierarchy
                    const flattenNodes = (nodes, level = 0) => {
                        nodes.forEach(node => {
                            const indent = '  '.repeat(level);
                            const row = { 'Categoria': indent + node.name };

                            days.forEach(d => {
                                const [y, m, day] = d.split('-');
                                const label = `${day}/${m}`;
                                row[label] = node.dailyTotals[d] || 0;
                            });

                            exportData.push(row);

                            if (node.children && node.children.length > 0) {
                                flattenNodes(node.children, level + 1);
                            }
                        });
                    };

                    // Add initial balance row
                    const initialRow = { 'Categoria': 'Saldo Inicial' };
                    let runningBalance = forecastData.initialBalance || 0;
                    days.forEach(d => {
                        const [y, m, day] = d.split('-');
                        const label = `${day}/${m}`;
                        initialRow[label] = runningBalance;
                        // Update running balance for next day
                        const data = forecastData.data || [];
                        const aportesRoot = data.find(n => n.id === 'aportes_root');
                        const retiradasRoot = data.find(n => n.id === 'retiradas_root');
                        const emprestimosRoot = data.find(n => n.id === 'emprestimos_root');
                        const entradasRoot = data.find(n => n.id === 'entradas_root');
                        const saidasRoot = data.find(n => n.id === 'saidas_root');
                        const producaoRoot = data.find(n => n.id === 'producao_root');
                        const inVal = (entradasRoot?.dailyTotals[d] || 0) + (aportesRoot?.dailyTotals[d] || 0) + (emprestimosRoot?.dailyTotals[d] || 0);
                        const outVal = (saidasRoot?.dailyTotals[d] || 0) + (producaoRoot?.dailyTotals[d] || 0) + (retiradasRoot?.dailyTotals[d] || 0);
                        runningBalance = runningBalance + inVal - outVal;
                    });
                    exportData.push(initialRow);

                    // Add data
                    flattenNodes(forecastData.data);

                    // Add final balance row
                    const finalRow = { 'Categoria': 'Saldo Final' };
                    let finalBalance = forecastData.initialBalance || 0;
                    days.forEach(d => {
                        const data = forecastData.data || [];
                        const aportesRoot = data.find(n => n.id === 'aportes_root');
                        const retiradasRoot = data.find(n => n.id === 'retiradas_root');
                        const emprestimosRoot = data.find(n => n.id === 'emprestimos_root');
                        const entradasRoot = data.find(n => n.id === 'entradas_root');
                        const saidasRoot = data.find(n => n.id === 'saidas_root');
                        const producaoRoot = data.find(n => n.id === 'producao_root');
                        const inVal = (entradasRoot?.dailyTotals[d] || 0) + (aportesRoot?.dailyTotals[d] || 0) + (emprestimosRoot?.dailyTotals[d] || 0);
                        const outVal = (saidasRoot?.dailyTotals[d] || 0) + (producaoRoot?.dailyTotals[d] || 0) + (retiradasRoot?.dailyTotals[d] || 0);
                        finalBalance = finalBalance + inVal - outVal;

                        const [y, m, day] = d.split('-');
                        const label = `${day}/${m}`;
                        finalRow[label] = finalBalance;
                    });
                    exportData.push(finalRow);

                    // Add relative days row
                    const relativeDaysRow = { 'Categoria': 'Dias Relativos' };
                    const todayDate = new Date();
                    todayDate.setHours(0, 0, 0, 0);

                    days.forEach(d => {
                        const cellDate = new Date(d + 'T00:00:00');
                        const diffTime = cellDate - todayDate;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        const [y, m, day] = d.split('-');
                        const label = `${day}/${m}`;
                        relativeDaysRow[label] = diffDays;
                    });
                    exportData.push(relativeDaysRow);

                    // Define columns
                    const columns = [
                        { header: 'Categoria', key: 'Categoria', width: 40, type: 'text' }
                    ];

                    days.forEach(d => {
                        const [y, m, day] = d.split('-');
                        const label = `${day}/${m}`;
                        columns.push({
                            header: label,
                            key: label,
                            width: 15,
                            type: 'currency'
                        });
                    });

                    await ExcelExporter.exportTable(
                        exportData,
                        columns,
                        'Previsão Diária de Fluxo',
                        'previsao_fluxo'
                    );
                } catch (error) {
                    console.error('Excel export error:', error);
                    showToast(`Erro ao exportar: ${error.message}`, 'error');
                }
            };
        }

        if (btnPdf) {
            btnPdf.onclick = () => {
                PrintHelper.autoConfigureOrientation('#previsao-table-container table');
                window.print();
            };
        }
    }, 100);

    // Init
    renderTable(); // Render empty structure immediately
    loadMetadata(); // Load companies/accounts for filter
    loadData();

    return container;
};
