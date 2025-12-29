import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { MonthPicker } from './MonthPicker.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';

export const ConsolidadasManager = (project) => {
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
    let viewType = 'competencia';
    let startMonth = localStorage.getItem('consolidadas_startMonth') || `${today.getFullYear()}-01`;
    let endMonth = localStorage.getItem('consolidadas_endMonth') || `${today.getFullYear()}-12`;
    let expandedNodes = new Set();

    // Store full response
    let currentData = { realized: [], provisioned: [] };

    // --- Helpers ---
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    const formatPercent = (val) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

    const getMonthKeys = () => {
        const months = [];
        let [y, m] = startMonth.split('-').map(Number);
        const [endY, endM] = endMonth.split('-').map(Number);
        let current = new Date(y, m - 1, 1);
        const end = new Date(endY, endM - 1, 1);
        while (current <= end) {
            const yr = current.getFullYear();
            const mo = String(current.getMonth() + 1).padStart(2, '0');
            months.push(`${yr}-${mo}`);
            current.setMonth(current.getMonth() + 1);
        }
        return months;
    };

    // --- Data Loading ---
    const loadData = async () => {
        const overlay = container.querySelector('.loading-overlay');
        try {
            if (overlay) overlay.style.display = 'flex';
            const token = localStorage.getItem('token');
            const url = `${API_BASE_URL}/consolidadas?projectId=${project.id}&viewType=${viewType}&startMonth=${startMonth}&endMonth=${endMonth}`;

            const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!resp.ok) throw new Error('Falha ao carregar dados consolidados');

            currentData = await resp.json(); // Expect { realized: [], provisioned: [] }

            renderAllTables();

        } catch (error) {
            console.error(error);
            showToast(error.message || 'Erro ao carregar dados', 'error');
        } finally {
            if (overlay) overlay.style.display = 'none';
        }
    };

    const renderAllTables = () => {
        const tablesWrapper = container.querySelector('#consolidadas-tables-wrapper');
        tablesWrapper.innerHTML = '';

        const titleReal = viewType === 'caixa' ? 'TRANSAÇÕES REAIS (CAIXA)' : 'TRANSAÇÕES DE COMPETÊNCIA';
        const titleProv = 'TRANSAÇÕES PREVISTAS'; // Or "PROVISÃO"?

        // Table 1: Realized
        tablesWrapper.appendChild(createTableHTML(currentData.realized, titleReal));

        // Spacer
        const spacer = document.createElement('div');
        spacer.style.height = '2rem';
        tablesWrapper.appendChild(spacer);

        // Table 2: Provisioned
        tablesWrapper.appendChild(createTableHTML(currentData.provisioned, titleProv));
    };

    // --- Reusable Logic to Create Table Element ---
    const createTableHTML = (data, title) => {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '1rem';
        wrapper.style.overflowX = 'auto';

        const months = getMonthKeys();

        // Recursive Row Renderer
        const renderRows = (nodes, level = 0) => {
            let rowsHtml = '';
            nodes.forEach(node => {
                const rootIds = ['saidas_root', 'producao_root', 'entradas_root', 'resultado_operacional_root', 'aportes_root', 'retiradas_root', 'fluxo_financeiro_root', 'lucro_bruto_root', 'margem_bruta_root', 'margem_operacional_root'];
                const isRoot = rootIds.includes(node.id);

                // Hide rows with effectively zero total, unless it's a root
                if (!isRoot && !node.isPercentage && Math.abs(node.total) < 0.01) return;

                const hasChildren = node.children && node.children.length > 0;
                const isExpanded = expandedNodes.has(node.id);
                const paddingLeft = level * 1.5 + 1;

                let rowBg = level === 0 ? '#f0f9ff' : '#ffffff';
                let fontWeight = level === 0 ? '700' : (hasChildren ? '600' : '400');
                const baseSizeRem = 1;
                const decreasePerLevel = 0.063;
                const fontSize = `${baseSizeRem - (level * decreasePerLevel)}rem`;

                // Specific styling
                if (['resultado_operacional_root', 'lucro_bruto_root'].includes(node.id)) { rowBg = '#e0f2fe'; fontWeight = '800'; }
                if (node.id === 'fluxo_financeiro_root') { rowBg = '#dbeafe'; fontWeight = '800'; }
                if (node.isPercentage) { rowBg = '#f9fafb'; fontWeight = '600'; }

                const rowClass = hasChildren ? 'expandable-row' : '';

                // Cells
                let monthCells = '';
                months.forEach(m => {
                    const val = node.monthlyTotals[m] || 0;
                    let color = '#374151';
                    const tolerance = node.isPercentage ? 0.0001 : 0.01;

                    if (Math.abs(val) > tolerance) {
                        if (node.isPercentage) {
                            color = '#4B5563';
                        } else if (node.id === 'aportes_root') {
                            color = '#10B981';
                        } else if (node.id === 'retiradas_root') {
                            color = '#EF4444';
                        } else if (['resultado_operacional_root', 'fluxo_financeiro_root', 'lucro_bruto_root'].includes(node.id) || (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada')))) {
                            color = val >= 0 ? '#10B981' : '#EF4444';
                        } else {
                            color = val >= 0 ? '#EF4444' : '#10B981';
                        }
                    } else {
                        color = '#9CA3AF';
                    }

                    let displayVal = '-';
                    if (Math.abs(val) > tolerance) {
                        displayVal = node.isPercentage ? formatPercent(val) : formatCurrency(val);
                    }
                    monthCells += `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; color: ${color}; font-weight: 600; font-size: ${fontSize}; white-space: nowrap;">${displayVal}</td>`;
                });

                // Total
                let totalColor = '#374151';
                const totalTol = node.isPercentage ? 0.0001 : 0.01;
                if (Math.abs(node.total) > totalTol) {
                    if (node.isPercentage) {
                        totalColor = '#111827';
                    } else if (node.id === 'aportes_root') {
                        totalColor = '#10B981';
                    } else if (node.id === 'retiradas_root') {
                        totalColor = '#EF4444';
                    } else if (['resultado_operacional_root', 'fluxo_financeiro_root', 'lucro_bruto_root'].includes(node.id) || (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada')))) {
                        totalColor = node.total >= 0 ? '#10B981' : '#EF4444';
                    } else {
                        totalColor = node.total >= 0 ? '#EF4444' : '#10B981';
                    }
                } else {
                    totalColor = '#9CA3AF';
                }

                let displayTotal = '-';
                if (Math.abs(node.total) > totalTol) {
                    displayTotal = node.isPercentage ? formatPercent(node.total) : formatCurrency(node.total);
                }
                const totalCell = `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: ${totalColor}; font-size: ${fontSize}; position: sticky; left: 460px; background-color: ${rowBg}; z-index: 1; white-space: nowrap;">${displayTotal}</td>`;

                // Average
                let average = 0;
                if (node.isPercentage) {
                    // User Request: Use ratio of averages = Total ratio = node.total
                    average = node.total;
                } else {
                    average = months.length > 0 ? node.total / months.length : 0;
                }

                let displayAvg = '-';
                if (Math.abs(average) > totalTol) {
                    displayAvg = node.isPercentage ? formatPercent(average) : formatCurrency(average);
                }
                const averageCell = `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: ${totalColor}; font-size: ${fontSize}; position: sticky; left: 320px; background-color: ${rowBg}; z-index: 1; white-space: nowrap;">${displayAvg}</td>`;

                rowsHtml += `
                    <tr class="${rowClass}" data-id="${node.id}" style="background-color: ${rowBg}; cursor: ${hasChildren ? 'pointer' : 'default'};">
                        <td style="padding: 0.5rem 1rem 0.5rem ${paddingLeft}rem; border-bottom: 1px solid #f3f4f6; font-weight: ${fontWeight}; font-size: ${fontSize}; display: flex; align-items: center; gap: 0.5rem; position: sticky; left: 0; background-color: ${rowBg}; z-index: 1; width: 320px; min-width: 320px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${node.name}">
                            ${hasChildren ? `<span style="font-size: 0.8rem; transform: rotate(${isExpanded ? '90deg' : '0deg'}); transition: transform 0.2s;">▶</span>` : ''}
                            ${node.name}
                        </td>
                        ${averageCell}
                        ${totalCell}
                        ${monthCells}
                    </tr>
                `;

                if (hasChildren && isExpanded) {
                    rowsHtml += renderRows(node.children, level + 1);
                }
            });
            return rowsHtml;
        };

        const tableHtml = `
        <table style="width: auto; border-collapse: separate; border-spacing: 0; min-width: 100%;">
            <thead style="position: sticky; top: 0; z-index: 10; background-color: #00425F; color: white;">
                <tr>
                    <th colspan="${months.length + 3}" style="padding: 0.5rem 1rem; text-align: center; border-bottom: 1px solid #ffffff33; background-color: #00425F; border-radius: 8px 8px 0 0; white-space: nowrap;">
                        ${title}
                    </th>
                </tr>
                <tr>
                    <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: 320px; min-width: 320px; max-width: 320px; position: sticky; left: 0; z-index: 11; background-color: #00425F; white-space: nowrap;"></th>
                    <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: 140px; min-width: 140px; position: sticky; left: 320px; z-index: 11; background-color: #00425F; white-space: nowrap;">MÉDIA</th>
                    <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: 140px; min-width: 140px; position: sticky; left: 460px; z-index: 11; background-color: #00425F; white-space: nowrap;">TOTAL</th>
                    ${months.map(m => {
            const [y, mo] = m.split('-');
            // User Request: Smallest possible width (fit content). Removed min-width: 120px.
            // Reduced padding to 0.5rem (horizontal) to tighten it further.
            return `<th style="padding: 1rem 0.5rem; text-align: center; border-bottom: 2px solid #e5e7eb; white-space: nowrap;">${mo}/${y}</th>`;
        }).join('')}
                </tr>
            </thead>
            <tbody>
                ${data.length === 0
                ? `<tr><td colspan="${months.length + 3}" style="padding: 3rem; text-align: center; color: #6B7280;">Nenhum dado financeiro.</td></tr>`
                : renderRows(data)}
            </tbody>
        </table>
        `;

        wrapper.innerHTML = tableHtml;

        // Listeners for this table instance
        wrapper.querySelectorAll('.expandable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = row.dataset.id;
                if (expandedNodes.has(id)) expandedNodes.delete(id);
                else expandedNodes.add(id);
                renderAllTables(); // Re-render BOTH tables to maintain state consistency
            });
        });

        return wrapper;
    };


    // --- Header / Controls ---
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex; flex-direction:column; gap:0.5rem; padding:1rem 0.5rem 0.5rem; margin-bottom:0; position:sticky; top:0; z-index:40; background:#fff; border-bottom:1px solid #e5e7eb;';

    // Header Row
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex; justify-content:flex-end; margin-bottom:0.5rem;';
    headerRow.innerHTML = '<div style="font-size:1.5rem; font-weight:bold; color:#00425F;">📑 Consolidadas</div>';

    // Controls
    const controlsRow = document.createElement('div');
    controlsRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;';

    // Left
    const leftControls = document.createElement('div');
    leftControls.style.cssText = 'display:flex; align-items:center; gap:1.5rem;';

    // Radios
    const radioGroup = document.createElement('div');
    radioGroup.style.cssText = 'display:flex; gap:1.5rem; align-items:center; background:#f3f4f6; padding:0.25rem 1rem; border-radius:8px; height:40px;';

    const createRadio = (lbl, val) => {
        const d = document.createElement('label');
        d.style.cssText = 'display:flex; align-items:center; gap:0.5rem; cursor:pointer; margin-bottom:0;';
        const inp = document.createElement('input');
        inp.type = 'radio'; inp.name = 'viewType'; inp.value = val; inp.checked = (viewType === val); inp.style.accentColor = '#00425F';
        inp.onchange = (e) => { if (e.target.checked) { viewType = val; loadData(); } };
        const spn = document.createElement('span'); spn.textContent = lbl; spn.style.cssText = 'font-weight:500; color:#374151; font-size:0.95rem;';
        d.append(inp, spn); return d;
    };
    radioGroup.append(createRadio('Visão de Competência', 'competencia'), createRadio('Visão de Caixa', 'caixa'));

    // Dates
    const dateGroup = document.createElement('div'); dateGroup.style.cssText = 'display:flex; align-items:center; gap:0.5rem;';
    dateGroup.append(
        Object.assign(document.createElement('span'), { textContent: 'De:', style: 'font-size:0.9rem; color:#4B5563;' }),
        MonthPicker(startMonth, (v) => { startMonth = v; localStorage.setItem('consolidadas_startMonth', v); loadData(); }),
        Object.assign(document.createElement('span'), { textContent: 'Até:', style: 'font-size:0.9rem; color:#4B5563;' }),
        MonthPicker(endMonth, (v) => { endMonth = v; localStorage.setItem('consolidadas_endMonth', v); loadData(); })
    );
    leftControls.append(radioGroup, dateGroup);

    // Exports
    const exportDiv = document.createElement('div'); exportDiv.style.cssText = 'display:flex; gap:1rem; align-items:center;';

    const btnExcel = document.createElement('button');
    btnExcel.className = 'btn-outline';
    btnExcel.innerHTML = '<span style="margin-right:0.25rem">📊</span> Excel';
    btnExcel.style.cssText = 'border:none; background:transparent; padding:0.25rem 0.5rem; font-weight:600; color:#374151;';
    btnExcel.onclick = () => {
        if (!currentData.realized.length) { showToast('Sem dados.', 'info'); return; }
        try {
            // Export logic needs update for dual. Just exporting realized for now or flattening both.
            // Simplest: Export Realized as main
            const exporter = new ExcelExporter();
            const mapData = (arr) => arr.map(node => ({ Nome: node.name, Total: node.total, ...node.monthlyTotals }));

            // Maybe export 2 sheets? ExcelExporter might not support multple sheets easily. 
            // Just export Realized
            exporter.exportJsonToExcel(mapData(currentData.realized), `consolidadas_${viewType}_realizado`);
        } catch (e) { console.error(e); }
    };

    const btnPdf = document.createElement('button');
    btnPdf.className = 'btn-outline';
    btnPdf.innerHTML = '<span style="margin-right:0.25rem">🖨️</span> PDF';
    btnPdf.style.cssText = 'border:none; background:transparent; padding:0.25rem 0.5rem; font-weight:600; color:#374151;';
    btnPdf.onclick = () => window.print();

    exportDiv.append(btnExcel, btnPdf);
    controlsRow.append(leftControls, exportDiv);
    controls.append(headerRow, controlsRow);

    // --- Main Container ---
    const scrollContainer = document.createElement('div');
    scrollContainer.id = 'consolidadas-table-container'; // Keep ID for potential CSS reference
    scrollContainer.style.flex = '1';
    scrollContainer.style.overflow = 'hidden';
    scrollContainer.style.overflowY = 'auto';

    const tablesWrapper = document.createElement('div');
    tablesWrapper.id = 'consolidadas-tables-wrapper';
    tablesWrapper.style.paddingBottom = '3rem';
    scrollContainer.appendChild(tablesWrapper);

    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay hidden';
    loadingOverlay.innerHTML = '<div class="spinner"></div>';
    loadingOverlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.7); display:none; justify-content:center; align-items:center; z-index:50;';

    container.append(controls, scrollContainer, loadingOverlay);
    loadData();

    return container;

};
