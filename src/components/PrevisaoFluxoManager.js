import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

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

    // --- Fetch Data ---
    const loadData = async () => {
        const overlay = container.querySelector('.loading-overlay');
        try {
            if (overlay) overlay.style.display = 'flex';

            const token = localStorage.getItem('token');
            const url = `${API_BASE_URL}/previsao?projectId=${project.id}&startDate=${startStr}&endDate=${endStr}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao carregar previsão');

            forecastData = await response.json();
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
        let runningBalance = forecastData.initialBalance;

        // Extract roots for easy access
        const saidasRoot = forecastData.data.find(n => n.id === 'saidas_root');
        const producaoRoot = forecastData.data.find(n => n.id === 'producao_root');
        const entradasRoot = forecastData.data.find(n => n.id === 'entradas_root');

        days.forEach(day => {
            const inVal = (entradasRoot?.dailyTotals[day] || 0);
            const outVal = (saidasRoot?.dailyTotals[day] || 0) + (producaoRoot?.dailyTotals[day] || 0);

            const initial = runningBalance;
            const final = initial + inVal - outVal; // Inputs add, Outputs subtract (OutVal is usually positive mag?)
            // Wait, my controller returns Outflows as POSITIVE Magnitude sums?
            // Yes: `SUM(valor)` on despesas (positive db values) = Positive Total.
            // So: Final = Initial + In - Out. Correct.

            dayBalances[day] = { initial, final };
            runningBalance = final; // Next day starts with this final
        });

        // Header
        let html = `
            <table style="width: auto; min-width: 50%; border-collapse: separate; border-spacing: 0;">
                <thead style="position: sticky; top: 0; z-index: 10; background-color: #00425F; color: white;">
                    <tr>
                        <th style="padding: 1rem; text-align: left; border-bottom: 2px solid #e5e7eb; min-width: 300px;">TRANSAÇÕES</th>
                        ${days.map(d => {
            const [y, m, day] = d.split('-');
            return `<th style="padding: 1rem; text-align: right; border-bottom: 2px solid #e5e7eb; min-width: 120px;">${day}/${m}</th>`;
        }).join('')}
                        <!-- Total Column? Maybe not needed for daily flow -->
                    </tr>
                </thead>
                <tbody>
        `;

        // 1. SALDO INICIAL ROW
        html += `
            <tr style="background-color: #e0f2fe;">
                <td style="padding: 0.5rem 1rem; font-weight: 800; border-bottom: 2px solid #cbd5e1;">Saldo Inicial</td>
                ${days.map(d => {
            const val = dayBalances[d].initial;
            const color = val >= 0 ? '#10B981' : '#EF4444';
            return `<td style="padding: 0.5rem 1rem; text-align: right; font-weight: 800; color: ${color}; border-bottom: 2px solid #cbd5e1;">${formatCurrency(val)}</td>`;
        }).join('')}
            </tr>
        `;

        // Recursive Row Renderer
        const renderRows = (nodes, level = 0) => {
            nodes.forEach(node => {
                // Visibility: Always show roots. Hide zero leaves.
                const isRoot = ['saidas_root', 'producao_root', 'entradas_root'].includes(node.id);
                if (!isRoot && Math.abs(node.total) < 0.01) return;

                const hasChildren = node.children && node.children.length > 0;
                const isExpanded = expandedNodes.has(node.id);
                const paddingLeft = level * 1.5 + 1;

                const bgColor = level === 0 ? '#f0f9ff' : '#ffffff';
                const fontWeight = level === 0 ? '700' : (hasChildren ? '600' : '400');
                const rowClass = hasChildren ? 'expandable-row' : '';

                let dayCells = '';
                days.forEach(d => {
                    const val = node.dailyTotals[d] || 0;
                    let color = '#9CA3AF';
                    if (Math.abs(val) > 0.001) {
                        if (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada'))) {
                            color = val >= 0 ? '#10B981' : '#EF4444';
                        } else {
                            // Expenses
                            color = val >= 0 ? '#EF4444' : '#10B981';
                        }
                    }
                    dayCells += `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; color: ${color}; font-weight: 600;">${val !== 0 ? formatCurrency(val) : '-'}</td>`;
                });

                html += `
                    <tr class="${rowClass}" data-id="${node.id}" style="background-color: ${bgColor}; cursor: ${hasChildren ? 'pointer' : 'default'};">
                        <td style="padding: 0.5rem 1rem 0.5rem ${paddingLeft}rem; border-bottom: 1px solid #f3f4f6; font-weight: ${fontWeight}; display: flex; align-items: center; gap: 0.5rem;">
                            ${hasChildren ? `<span style="font-size: 0.8rem; transform: rotate(${isExpanded ? '90deg' : '0deg'}); transition: transform 0.2s;">▶</span>` : ''}
                            ${node.name}
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
        // Order: Saidas, Producao, Entradas
        // Actually user said: "itens de saída, produção e revenda e entrada"
        // So Render: Saidas Root, Producao Root, Entradas Root.
        if (forecastData.data) {
            // Find roots
            const s = forecastData.data.find(n => n.id === 'saidas_root');
            const p = forecastData.data.find(n => n.id === 'producao_root');
            const e = forecastData.data.find(n => n.id === 'entradas_root');

            if (s) renderRows([s]);
            if (p) renderRows([p]);
            if (e) renderRows([e]);
        }

        // 2. SALDO FINAL ROW
        html += `
            <tr style="background-color: #e0f2fe;">
                <td style="padding: 0.5rem 1rem; font-weight: 800; border-top: 2px solid #cbd5e1;">Saldo Final</td>
                ${days.map(d => {
            const val = dayBalances[d].final;
            const color = val >= 0 ? '#10B981' : '#EF4444';
            return `<td style="padding: 0.5rem 1rem; text-align: right; font-weight: 800; color: ${color}; border-top: 2px solid #cbd5e1;">${formatCurrency(val)}</td>`;
        }).join('')}
            </tr>
        `;

        // 3. RELATIVE DAYS ROW
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        html += `
            <tr style="background-color: #f9fafb;">
                <td style="padding: 0.5rem 1rem; font-weight: 600; font-size: 0.8rem; color: #6B7280; border-top: 2px solid #cbd5e1;">Dias Relativos</td>
                ${days.map(d => {
            const cellDate = new Date(d + 'T00:00:00');
            const diffTime = cellDate - todayDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Style for Today (0)
            let style = "color: #6B7280;";
            if (diffDays === 0) style = "color: #00425F; font-weight: bold; background-color: #e0f2fe;";

            return `<td style="padding: 0.5rem 1rem; text-align: right; font-size: 0.8rem; ${style} border-top: 2px solid #cbd5e1;">${diffDays}</td>`;
        }).join('')}
            </tr>
        `;

        html += '</tbody></table>';
        tableContainer.innerHTML = html;

        // Toggle Listeners
        tableContainer.querySelectorAll('.expandable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const id = row.dataset.id;
                if (expandedNodes.has(id)) expandedNodes.delete(id);
                else expandedNodes.add(id);
                renderTable();
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
             <!-- Date Range -->
             <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.9rem; color: #4B5563;">De:</label>
                <input type="date" id="start-date" value="${startStr}" style="padding: 0.4rem; border: 1px solid #d1d5db; border-radius: 4px; font-family: inherit;">
                
                <label style="font-size: 0.9rem; color: #4B5563;">Até:</label>
                <input type="date" id="end-date" value="${endStr}" style="padding: 0.4rem; border: 1px solid #d1d5db; border-radius: 4px; font-family: inherit;">
             </div>
             
             <button id="btn-refresh" class="btn-primary" style="padding: 0.4rem 1rem;">
                🔄 Atualizar
             </button>
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
    const btnRefresh = controls.querySelector('#btn-refresh');

    const handleDateChange = () => {
        startStr = startInput.value;
        endStr = endInput.value;
        localStorage.setItem('previsao_startDate', startStr);
        localStorage.setItem('previsao_endDate', endStr);
    };

    startInput.addEventListener('change', handleDateChange);
    endInput.addEventListener('change', handleDateChange);
    btnRefresh.addEventListener('click', () => {
        handleDateChange();
        loadData();
    });

    // Init
    loadData();

    return container;
};
