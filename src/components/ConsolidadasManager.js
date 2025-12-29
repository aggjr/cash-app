import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { MonthPicker } from './MonthPicker.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';

export const ConsolidadasManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '0'; // No internal padding, table controls spacing
    container.style.margin = '0.5rem';
    container.style.height = 'calc(100vh - 40px)'; // Full height minus header
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.position = 'relative';
    container.style.color = '#1f2937';

    // --- State ---
    const today = new Date();
    // Default to 'competencia' as per user request flow/standard
    let viewType = 'competencia';
    let startMonth = localStorage.getItem('consolidadas_startMonth') || `${today.getFullYear()}-01`;
    let endMonth = localStorage.getItem('consolidadas_endMonth') || `${today.getFullYear()}-12`;
    let expandedNodes = new Set();
    let currentData = []; // Store fetched data for export

    // --- Helper: Format Currency ---
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    // --- Helper: Format Percentage ---
    const formatPercent = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);
    };

    // --- Helper: Generate Month Keys between Start and End ---
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

    // --- Fetch Data ---
    const loadData = async () => {
        const overlay = container.querySelector('.loading-overlay');
        try {
            if (overlay) overlay.style.display = 'flex';

            const token = localStorage.getItem('token');
            const url = `${API_BASE_URL}/consolidadas?projectId=${project.id}&viewType=${viewType}&startMonth=${startMonth}&endMonth=${endMonth}`;

            const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!resp.ok) throw new Error('Falha ao carregar dados consolidados');

            currentData = await resp.json();
            renderTable(currentData);

        } catch (error) {
            console.error(error);
            showToast(error.message || 'Erro ao carregar dados', 'error');
        } finally {
            if (overlay) overlay.style.display = 'none';
        }
    };

    // --- Render Single Table ---
    const renderTable = (data) => {
        const tableContainer = container.querySelector('#consolidadas-table-container');
        tableContainer.innerHTML = ''; // Clear existing

        const months = getMonthKeys();

        // Define Title based on View Type
        const title = viewType === 'caixa' ? 'TRANSAÇÕES REAIS (CAIXA)' : 'TRANSAÇÕES DE COMPETÊNCIA';

        // Helper to generate a single table HTML
        const generateTableHtml = () => {
            let html = `
            <div style="margin-bottom: 2rem; overflow-x: auto;">
                <table style="width: auto; border-collapse: separate; border-spacing: 0; min-width: 100%;">
                    <thead style="position: sticky; top: 0; z-index: 10; background-color: #00425F; color: white;">
                        <!-- Main Title Row spanning all columns -->
                        <tr>
                            <th colspan="${months.length + 3}" style="padding: 0.5rem 1rem; text-align: center; border-bottom: 1px solid #ffffff33; background-color: #00425F; border-radius: 8px 8px 0 0; white-space: nowrap;">
                                ${title}
                            </th>
                        </tr>
                        <!-- Column Headers -->
                        <tr>
                            <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: 320px; min-width: 320px; max-width: 320px; position: sticky; left: 0; z-index: 11; background-color: #00425F; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></th>
                            <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: 140px; min-width: 140px; position: sticky; left: 320px; z-index: 11; background-color: #00425F; white-space: nowrap;">MÉDIA</th>
                            <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: 140px; min-width: 140px; position: sticky; left: 460px; z-index: 11; background-color: #00425F; white-space: nowrap;">TOTAL</th>
                            ${months.map(m => {
                const [y, mo] = m.split('-');
                return `<th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; min-width: 120px; white-space: nowrap;">${mo}/${y}</th>`;
            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        `;

            // Recursive Row Renderer (Scoped to this table gen)
            const renderRows = (nodes, level = 0) => {
                let rowsHtml = '';
                nodes.forEach(node => {
                    const rootIds = ['saidas_root', 'producao_root', 'entradas_root', 'resultado_operacional_root', 'aportes_root', 'retiradas_root', 'fluxo_financeiro_root', 'lucro_bruto_root', 'margem_bruta_root', 'margem_operacional_root'];
                    const isRoot = rootIds.includes(node.id);

                    // For percentage rows, we don't skip if close to zero, unless value is NaN/0 specifically
                    // For value rows, hide if very small
                    if (!isRoot && !node.isPercentage && Math.abs(node.total) < 0.01) return;

                    const hasChildren = node.children && node.children.length > 0;
                    const isExpanded = expandedNodes.has(node.id);
                    const paddingLeft = level * 1.5 + 1;

                    let rowBg = level === 0 ? '#f0f9ff' : '#ffffff';
                    let fontWeight = level === 0 ? '700' : (hasChildren ? '600' : '400');
                    const baseSizeRem = 1;
                    const decreasePerLevel = 0.063;
                    const fontSize = `${baseSizeRem - (level * decreasePerLevel)}rem`;

                    // Specific styling for Totals
                    if (['resultado_operacional_root', 'lucro_bruto_root'].includes(node.id)) {
                        rowBg = '#e0f2fe';
                        fontWeight = '800';
                    }
                    if (node.id === 'fluxo_financeiro_root') {
                        rowBg = '#dbeafe';
                        fontWeight = '800';
                    }
                    // Styling for Percentages
                    if (node.isPercentage) {
                        rowBg = '#f9fafb';
                        fontWeight = '600';
                    }

                    const rowClass = hasChildren ? 'expandable-row' : '';

                    let monthCells = '';
                    months.forEach(m => {
                        const val = node.monthlyTotals[m] || 0;
                        let color = '#374151'; // Default dark gray

                        if (Math.abs(val) > 0.001 || node.isPercentage) {
                            if (node.isPercentage) {
                                color = '#4B5563';
                            } else if (node.id === 'aportes_root') {
                                color = '#10B981';
                            } else if (node.id === 'retiradas_root') {
                                color = '#EF4444';
                            } else if (['resultado_operacional_root', 'fluxo_financeiro_root', 'lucro_bruto_root'].includes(node.id) || (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada')))) {
                                color = val >= 0 ? '#10B981' : '#EF4444';
                            } else {
                                color = val >= 0 ? '#EF4444' : '#10B981'; // Expenses: positive value = red
                            }
                        } else {
                            color = '#9CA3AF'; // Zero/Light
                        }

                        const displayVal = node.isPercentage ? formatPercent(val) : (val !== 0 ? formatCurrency(val) : '-');
                        monthCells += `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; color: ${color}; font-weight: 600; font-size: ${fontSize}; white-space: nowrap;">${displayVal}</td>`;
                    });

                    let totalColor = '#374151';
                    if (Math.abs(node.total) > 0.001 || node.isPercentage) {
                        const val = node.total;
                        if (node.isPercentage) {
                            totalColor = '#111827';
                        } else if (node.id === 'aportes_root') {
                            totalColor = '#10B981';
                        } else if (node.id === 'retiradas_root') {
                            totalColor = '#EF4444';
                        } else if (['resultado_operacional_root', 'fluxo_financeiro_root', 'lucro_bruto_root'].includes(node.id) || (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada')))) {
                            totalColor = val >= 0 ? '#10B981' : '#EF4444';
                        } else {
                            totalColor = val >= 0 ? '#EF4444' : '#10B981';
                        }
                    } else {
                        totalColor = '#9CA3AF';
                    }

                    const displayTotal = node.isPercentage ? formatPercent(node.total) : (node.total !== 0 ? formatCurrency(node.total) : '-');
                    const totalCell = `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: ${totalColor}; font-size: ${fontSize}; position: sticky; left: 460px; background-color: ${rowBg}; z-index: 1; white-space: nowrap;">${displayTotal}</td>`;

                    // Simple average
                    let average = 0;
                    if (node.isPercentage) {
                        let sumPercents = 0;
                        let count = 0;
                        months.forEach(m => { sumPercents += (node.monthlyTotals[m] || 0); count++; });
                        average = count > 0 ? sumPercents / count : 0;
                    } else {
                        average = months.length > 0 ? (node.total / months.length) : 0;
                    }

                    const displayAvg = node.isPercentage ? formatPercent(average) : (average !== 0 ? formatCurrency(average) : '-');
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

            if (data.length === 0) {
                html += `<tr><td colspan="${months.length + 3}" style="padding: 3rem; text-align: center; color: #6B7280;">Nenhum dado encontrado para o período.</td></tr>`;
            } else {
                html += renderRows(data);
            }

            html += '</tbody></table></div>';
            return html;
        };

        // Render Table
        tableContainer.innerHTML = generateTableHtml();

        // Attach Click Listeners
        tableContainer.querySelectorAll('.expandable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = row.dataset.id;
                if (expandedNodes.has(id)) {
                    expandedNodes.delete(id);
                } else {
                    expandedNodes.add(id);
                }
                renderTable(data);
            });
        });
    };


    // --- Build Header / Controls ---
    const controls = document.createElement('div');
    controls.innerHTML = '';
    controls.style.display = 'flex';
    controls.style.flexDirection = 'column';
    controls.style.gap = '0.5rem';
    controls.style.padding = '1rem 0.5rem 0.5rem 0.5rem';
    controls.style.marginBottom = '0';
    // Sticky styles
    controls.style.position = 'sticky';
    controls.style.top = '0';
    controls.style.zIndex = '40';
    controls.style.backgroundColor = '#ffffff';
    controls.style.borderBottom = '1px solid #e5e7eb';

    // 1. Header Row (Title Top Right)
    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'flex-end'; // Align to right
    headerRow.style.marginBottom = '0.5rem';

    const title = document.createElement('div');
    title.innerHTML = '📑 Consolidadas';
    title.style.fontSize = '1.5rem';
    title.style.fontWeight = 'bold';
    title.style.color = '#00425F';

    headerRow.appendChild(title);

    // 2. Controls Row (Radios - Dates - Exports)
    const controlsRow = document.createElement('div');
    controlsRow.style.display = 'flex';
    controlsRow.style.alignItems = 'center';
    controlsRow.style.justifyContent = 'space-between';
    controlsRow.style.flexWrap = 'wrap';
    controlsRow.style.gap = '1rem';

    // Group: Radios + Dates
    const leftControls = document.createElement('div');
    leftControls.style.display = 'flex';
    leftControls.style.alignItems = 'center';
    leftControls.style.gap = '1.5rem';

    // Radio Group
    const radioGroup = document.createElement('div');
    radioGroup.style.display = 'flex';
    radioGroup.style.gap = '1.5rem';
    radioGroup.style.alignItems = 'center';
    radioGroup.style.backgroundColor = '#f3f4f6';
    radioGroup.style.padding = '0.25rem 1rem'; // Compact padding
    radioGroup.style.borderRadius = '8px';
    radioGroup.style.height = '40px';

    const createRadio = (label, value) => {
        const wrapper = document.createElement('label');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '0.5rem';
        wrapper.style.cursor = 'pointer';
        wrapper.style.marginBottom = '0';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'viewType';
        input.value = value;
        input.checked = (viewType === value);
        input.style.accentColor = '#00425F'; // Brand color match
        input.onchange = (e) => {
            if (e.target.checked) {
                viewType = value;
                loadData();
            }
        };

        const span = document.createElement('span');
        span.textContent = label;
        span.style.fontWeight = '500';
        span.style.color = '#374151';
        span.style.fontSize = '0.95rem';

        wrapper.appendChild(input);
        wrapper.appendChild(span);
        return wrapper;
    };

    radioGroup.appendChild(createRadio('Visão de Competência', 'competencia'));
    radioGroup.appendChild(createRadio('Visão de Caixa', 'caixa'));

    // Date Pickers Group
    const dateGroup = document.createElement('div');
    dateGroup.style.display = 'flex';
    dateGroup.style.alignItems = 'center';
    dateGroup.style.gap = '0.5rem';

    const lblDe = document.createElement('span');
    lblDe.textContent = 'De:'; lblDe.style.fontSize = '0.9rem'; lblDe.style.color = '#4B5563';

    // Using imported MonthPicker
    const startPicker = MonthPicker(startMonth, (val) => {
        startMonth = val;
        localStorage.setItem('consolidadas_startMonth', startMonth);
        loadData();
    });

    const lblAte = document.createElement('span');
    lblAte.textContent = 'Até:'; lblAte.style.fontSize = '0.9rem'; lblAte.style.color = '#4B5563';

    // Using imported MonthPicker
    const endPicker = MonthPicker(endMonth, (val) => {
        endMonth = val;
        localStorage.setItem('consolidadas_endMonth', endMonth);
        loadData();
    });

    dateGroup.appendChild(lblDe);
    dateGroup.appendChild(startPicker);
    dateGroup.appendChild(lblAte);
    dateGroup.appendChild(endPicker);

    leftControls.appendChild(radioGroup);
    leftControls.appendChild(dateGroup);

    // Export Buttons (Right side)
    const exportDiv = document.createElement('div');
    exportDiv.style.display = 'flex';
    exportDiv.style.gap = '1rem'; // More spacing
    exportDiv.style.alignItems = 'center';

    const btnExcel = document.createElement('button');
    btnExcel.className = 'btn-outline';
    btnExcel.innerHTML = '<span style="margin-right:0.25rem">📊</span> Excel';
    btnExcel.style.border = 'none';
    btnExcel.style.background = 'transparent';
    btnExcel.style.padding = '0.25rem 0.5rem';
    btnExcel.style.boxShadow = 'none';
    btnExcel.style.fontWeight = '600';
    btnExcel.style.color = '#374151';
    btnExcel.onmouseover = () => btnExcel.style.color = '#1f2937';
    btnExcel.onmouseout = () => btnExcel.style.color = '#374151';

    btnExcel.onclick = () => {
        if (!currentData || currentData.length === 0) {
            showToast('Sem dados para exportar.', 'info');
            return;
        }
        // Basic Excel Logic
        try {
            const exporter = new ExcelExporter();
            // Since format is complex hierarchical, a simple export might not be perfect, 
            // but we can pass the raw structure if ExcelExporter supports it, or flatten it.
            // For now, let's export the visible top level
            const exportData = currentData.map(node => ({
                Nome: node.name,
                Total: node.total,
                ...node.monthlyTotals
            }));
            exporter.exportJsonToExcel(exportData, `consolidadas_${viewType}`);
        } catch (e) {
            console.error(e);
            showToast('Erro na exportação Excel', 'error');
        }
    };

    const btnPdf = document.createElement('button');
    btnPdf.className = 'btn-outline';
    btnPdf.innerHTML = '<span style="margin-right:0.25rem">🖨️</span> PDF';
    btnPdf.style.border = 'none';
    btnPdf.style.background = 'transparent';
    btnPdf.style.padding = '0.25rem 0.5rem';
    btnPdf.style.boxShadow = 'none';
    btnPdf.style.fontWeight = '600';
    btnPdf.style.color = '#374151';
    btnPdf.onclick = () => window.print();

    exportDiv.appendChild(btnExcel);
    exportDiv.appendChild(btnPdf);

    // Assemble
    controlsRow.appendChild(leftControls);
    controlsRow.appendChild(exportDiv);

    controls.appendChild(headerRow);
    controls.appendChild(controlsRow);


    // --- Container Assembly ---
    const tableContainer = document.createElement('div');
    tableContainer.id = 'consolidadas-table-container';
    tableContainer.style.flex = '1';
    tableContainer.style.overflow = 'hidden'; // Let inner div handle scroll
    tableContainer.style.overflowY = 'auto'; // Vertical Scroll on container

    const loadingOverlay = document.createElement('div');
    loadingOverlay.classList.add('loading-overlay', 'hidden');
    loadingOverlay.innerHTML = '<div class="spinner"></div>';
    loadingOverlay.style.position = 'absolute';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.background = 'rgba(255,255,255,0.7)';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.style.zIndex = '50';
    loadingOverlay.style.display = 'none'; // Default hidden

    container.appendChild(controls);
    container.appendChild(tableContainer);
    container.appendChild(loadingOverlay);

    // Initial Load
    loadData();

    return container;
};
