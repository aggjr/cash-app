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
    // Default to current year or stored
    let startMonth = localStorage.getItem('consolidadas_startMonth') || `${today.getFullYear()}-01`;
    let endMonth = localStorage.getItem('consolidadas_endMonth') || `${today.getFullYear()}-12`;
    // Store IDs of expanded nodes (Strings now)
    let expandedNodes = new Set();

    // --- Helper: Format Currency ---
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
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

            // 1. Fetch Realized Data (Caixa - strictly realized)
            const urlReal = `${API_BASE_URL}/consolidadas?projectId=${project.id}&viewType=caixa&startMonth=${startMonth}&endMonth=${endMonth}`;
            const respReal = await fetch(urlReal, { headers: { 'Authorization': `Bearer ${token}` } });

            if (!respReal.ok) throw new Error('Falha ao carregar dados realizados');
            const dataReal = await respReal.json();

            // 2. Fetch Forecast Data (Previsto - all items/predicted)
            const urlPrev = `${API_BASE_URL}/consolidadas?projectId=${project.id}&viewType=previsto&startMonth=${startMonth}&endMonth=${endMonth}`;
            const respPrev = await fetch(urlPrev, { headers: { 'Authorization': `Bearer ${token}` } });

            if (!respPrev.ok) throw new Error('Falha ao carregar dados previstos');
            const dataPrev = await respPrev.json();

            // Render Both Tables
            renderTables(dataReal, dataPrev);

        } catch (error) {
            console.error(error);
            showToast(error.message || 'Erro ao carregar dados', 'error');
        } finally {
            if (overlay) overlay.style.display = 'none';
        }
    };

    // --- Render Tables ---
    const renderTables = (realData, prevData) => {
        const tableContainer = container.querySelector('#consolidadas-table-container');
        tableContainer.innerHTML = ''; // Clear existing

        const months = getMonthKeys();

        // Helper to generate a single table HTML
        const generateTableHtml = (data, title, type) => {
            let html = `
                <div style="margin-bottom: 2rem;">
                    <div style="background-color: #00425F; color: white; padding: 0.5rem 1rem; font-weight: bold; border-radius: 8px 8px 0 0; text-align: center;">
                        ${title}
                    </div>
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0; min-width: 100%;">
                        <thead style="position: sticky; top: 0; z-index: 10; background-color: #00425F; color: white;">
                            <tr>
                                <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; min-width: 300px; position: sticky; left: 0; z-index: 11; background-color: #00425F;">TRANSAÇÕES</th>
                                <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; min-width: 120px; position: sticky; left: 300px; z-index: 11; background-color: #00425F;">MÉDIA</th>
                                <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; min-width: 120px; position: sticky; left: 420px; z-index: 11; background-color: #00425F;">TOTAL</th>
                                ${months.map(m => {
                const [y, mo] = m.split('-');
                return `<th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; min-width: 120px;">${mo}/${y}</th>`;
            }).join('')}
                            </tr>
                        </thead>
                        <tbody>
            `;

            // Recursive Row Renderer (Scoped to this table gen)
            const renderRows = (nodes, level = 0) => {
                let rowsHtml = '';
                nodes.forEach(node => {
                    const isRoot = ['saidas_root', 'producao_root', 'total_saidas_root', 'entradas_root', 'resultado_operacional_root', 'aportes_root', 'retiradas_root', 'resultado_final_root'].includes(node.id);

                    // Hide non-root items with effectively zero values to keep clean
                    if (!isRoot && Math.abs(node.total) < 0.01) return;

                    const hasChildren = node.children && node.children.length > 0;
                    const isExpanded = expandedNodes.has(node.id);
                    const paddingLeft = level * 1.5 + 1;

                    let rowBg = level === 0 ? '#f0f9ff' : '#ffffff';
                    let fontWeight = level === 0 ? '700' : (hasChildren ? '600' : '400');
                    const baseSizeRem = 1;
                    const decreasePerLevel = 0.063;
                    const fontSize = `${baseSizeRem - (level * decreasePerLevel)}rem`;

                    if (node.id === 'total_saidas_root' || node.id === 'resultado_operacional_root') {
                        rowBg = '#e0f2fe';
                        fontWeight = '800';
                    }
                    if (node.id === 'resultado_final_root') {
                        rowBg = '#dbeafe';
                        fontWeight = '800';
                    }

                    const rowClass = hasChildren ? 'expandable-row' : '';

                    let monthCells = '';
                    months.forEach(m => {
                        const val = node.monthlyTotals[m] || 0;
                        let color = '#9CA3AF';
                        if (Math.abs(val) > 0.001) {
                            if (node.id === 'aportes_root') color = '#10B981';
                            else if (node.id === 'retiradas_root') color = '#EF4444';
                            else if (node.id === 'resultado_operacional_root' || node.id === 'resultado_final_root' || (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada')))) {
                                color = val >= 0 ? '#10B981' : '#EF4444';
                            } else {
                                color = val >= 0 ? '#EF4444' : '#10B981';
                            }
                        }
                        monthCells += `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; color: ${color}; font-weight: 600; font-size: ${fontSize};">${val !== 0 ? formatCurrency(val) : '-'}</td>`;
                    });

                    let totalColor = '#9CA3AF';
                    if (Math.abs(node.total) > 0.001) {
                        // Same color logic for totals
                        const val = node.total;
                        if (node.id === 'aportes_root') totalColor = '#10B981';
                        else if (node.id === 'retiradas_root') totalColor = '#EF4444';
                        else if (node.id === 'resultado_operacional_root' || node.id === 'resultado_final_root' || (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada')))) {
                            totalColor = val >= 0 ? '#10B981' : '#EF4444';
                        } else {
                            totalColor = val >= 0 ? '#EF4444' : '#10B981';
                        }
                    }

                    const totalCell = `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: ${totalColor}; font-size: ${fontSize}; position: sticky; left: 420px; background-color: ${rowBg}; z-index: 1;">${node.total !== 0 ? formatCurrency(node.total) : '-'}</td>`;

                    let average = months.length > 0 ? (node.total / months.length) : 0;
                    const averageCell = `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: ${totalColor}; font-size: ${fontSize}; position: sticky; left: 300px; background-color: ${rowBg}; z-index: 1;">${average !== 0 ? formatCurrency(average) : '-'}</td>`;

                    rowsHtml += `
                        <tr class="${rowClass}" data-id="${node.id}" style="background-color: ${rowBg}; cursor: ${hasChildren ? 'pointer' : 'default'};">
                            <td style="padding: 0.5rem 1rem 0.5rem ${paddingLeft}rem; border-bottom: 1px solid #f3f4f6; font-weight: ${fontWeight}; font-size: ${fontSize}; display: flex; align-items: center; gap: 0.5rem; position: sticky; left: 0; background-color: ${rowBg}; z-index: 1;">
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

        // Render Table 1: Realized
        tableContainer.innerHTML += generateTableHtml(realData, 'TRANSAÇÕES REAIS', 'real');

        // Render Table 2: Predicted
        tableContainer.innerHTML += generateTableHtml(prevData, 'TRANSAÇÕES PREVISTAS', 'prev');

        // Attach Click Listeners for Expansion (Global for container)
        tableContainer.querySelectorAll('.expandable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = row.dataset.id;
                if (expandedNodes.has(id)) {
                    expandedNodes.delete(id);
                } else {
                    expandedNodes.add(id);
                }
                // Re-render both with new state (inefficient but safe for sync)
                renderTables(realData, prevData);
            });
        });
    };


    // --- Custom Month-Year Picker Component ---
    const createMonthPicker = (initialValue, onChange) => {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';

        let [year, month] = initialValue.split('-').map(Number);
        let displayYear = year; // For navigation

        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const fullMonthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        // 1. The Trigger Input
        const trigger = document.createElement('div');
        trigger.className = 'form-input';
        trigger.style.cursor = 'pointer';
        trigger.style.display = 'flex';
        trigger.style.alignItems = 'center';
        trigger.style.justifyContent = 'space-between';
        trigger.style.width = '160px'; // Fixed width for consistency
        trigger.style.height = '38px';
        trigger.style.padding = '0 0.75rem';
        trigger.style.backgroundColor = 'white';
        trigger.style.userSelect = 'none';

        const updateTriggerText = () => {
            trigger.innerHTML = `
                <span style="font-weight: 500; color: #374151;">${fullMonthNames[month - 1]} / ${year}</span>
                <span style="font-size: 0.8rem; color: #9CA3AF;">▼</span>
            `;
        };
        updateTriggerText();

        // 2. The Popover
        const popover = document.createElement('div');
        popover.className = 'month-picker-popover glass-panel'; // Reuse glass panel style or similar
        popover.style.display = 'none';
        popover.style.position = 'absolute';
        popover.style.top = '100%';
        popover.style.left = '0';
        popover.style.marginTop = '0.25rem';
        popover.style.zIndex = '1000';
        popover.style.width = '240px';
        popover.style.padding = '0.5rem';
        popover.style.backgroundColor = 'white';
        popover.style.border = '1px solid #e5e7eb';
        popover.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
        popover.style.borderRadius = '0.5rem';

        const renderPopoverContent = () => {
            popover.innerHTML = '';

            // Header: Year Navigation
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '0.5rem';
            header.style.paddingBottom = '0.5rem';
            header.style.borderBottom = '1px solid #f3f4f6';

            const btnPrev = document.createElement('button');
            btnPrev.textContent = '◀';
            btnPrev.style.background = 'none';
            btnPrev.style.border = 'none';
            btnPrev.style.cursor = 'pointer';
            btnPrev.style.padding = '0.25rem 0.5rem';
            btnPrev.style.color = '#4B5563';
            btnPrev.onclick = (e) => {
                e.stopPropagation();
                displayYear--;
                renderPopoverContent();
            };

            const yearLabel = document.createElement('span');
            yearLabel.textContent = displayYear;
            yearLabel.style.fontWeight = 'bold';
            yearLabel.style.color = '#111827';

            const btnNext = document.createElement('button');
            btnNext.textContent = '▶';
            btnNext.style.background = 'none';
            btnNext.style.border = 'none';
            btnNext.style.cursor = 'pointer';
            btnNext.style.padding = '0.25rem 0.5rem';
            btnNext.style.color = '#4B5563';
            btnNext.onclick = (e) => {
                e.stopPropagation();
                displayYear++;
                renderPopoverContent();
            };

            header.appendChild(btnPrev);
            header.appendChild(yearLabel);
            header.appendChild(btnNext);
            popover.appendChild(header);

            // Grid: Months
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            grid.style.gap = '0.25rem';

            monthNames.forEach((mName, idx) => {
                const btnMonth = document.createElement('button');
                btnMonth.textContent = mName;
                const mNum = idx + 1;
                const isSelected = displayYear === year && mNum === month;

                btnMonth.style.padding = '0.5rem 0.25rem';
                btnMonth.style.border = 'none';
                btnMonth.style.borderRadius = '0.25rem';
                btnMonth.style.cursor = 'pointer';
                btnMonth.style.fontSize = '0.9rem';

                if (isSelected) {
                    btnMonth.style.backgroundColor = 'var(--color-primary)'; // Blue
                    btnMonth.style.color = 'white';
                    btnMonth.style.fontWeight = '600';
                } else {
                    btnMonth.style.backgroundColor = 'transparent';
                    btnMonth.style.color = '#374151';
                }

                btnMonth.onmouseover = () => { if (!isSelected) btnMonth.style.backgroundColor = '#f3f4f6'; };
                btnMonth.onmouseout = () => { if (!isSelected) btnMonth.style.backgroundColor = 'transparent'; };

                btnMonth.onclick = (e) => {
                    e.stopPropagation();
                    year = displayYear;
                    month = mNum;
                    updateTriggerText();
                    closePopover();

                    // Format YYYY-MM
                    const formatted = `${year}-${String(month).padStart(2, '0')}`;
                    onChange(formatted);
                };

                grid.appendChild(btnMonth);
            });
            popover.appendChild(grid);
        };

        // Logic
        const closePopover = () => {
            popover.style.display = 'none';
            document.removeEventListener('click', outsideClickListener);
        };

        const outsideClickListener = (e) => {
            if (!wrapper.contains(e.target)) {
                closePopover();
            }
        };

        trigger.onclick = (e) => {
            e.stopPropagation();
            if (popover.style.display === 'block') {
                closePopover();
            } else {
                displayYear = year; // Reset view to selected year
                renderPopoverContent();
                popover.style.display = 'block';
                document.addEventListener('click', outsideClickListener);
            }
        };

        wrapper.appendChild(trigger);
        wrapper.appendChild(popover);

        // API for external set
        wrapper.setValue = (val) => {
            [year, month] = val.split('-').map(Number);
            displayYear = year;
            updateTriggerText();
        };

        return wrapper;
    };

    // --- Build Header / Controls ---
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.justifyContent = 'space-between';
    controls.style.alignItems = 'center';
    controls.style.padding = '0 0.5rem 1rem 0.5rem';
    controls.style.marginBottom = '1rem';
    // controls.style.backgroundColor = 'white'; // Transparent bg for header
    // controls.style.borderBottom = '1px solid #e5e7eb';
    // controls.style.borderRadius = '8px 8px 0 0';

    // Left Logic Group
    const leftGroup = document.createElement('div');
    leftGroup.style.display = 'flex';
    leftGroup.style.alignItems = 'center';
    leftGroup.style.gap = '1.5rem';

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

    leftGroup.appendChild(dateGroup);

    // Export Buttons
    const exportDiv = document.createElement('div');
    exportDiv.style.display = 'flex';
    exportDiv.style.gap = '0.5rem';

    const btnExcel = document.createElement('button');
    btnExcel.id = 'btn-excel-consol';
    btnExcel.className = 'btn-outline';
    btnExcel.textContent = '📊 Excel';
    exportDiv.appendChild(btnExcel);

    const btnPdf = document.createElement('button');
    btnPdf.id = 'btn-pdf-consol';
    btnPdf.className = 'btn-outline';
    btnPdf.textContent = '🖨️ PDF';
    exportDiv.appendChild(btnPdf);

    leftGroup.appendChild(exportDiv);

    // Title
    const title = document.createElement('div');
    title.innerHTML = '📑 Consolidadas';
    title.style.fontSize = '1.5rem';
    title.style.fontWeight = 'bold';
    title.style.color = '#00425F';

    controls.appendChild(leftGroup);
    controls.appendChild(title);

    // Export Handlers
    setTimeout(() => {
        const excelBtn = container.querySelector('#btn-excel-consol');
        const pdfBtn = container.querySelector('#btn-pdf-consol');

        if (excelBtn) {
            excelBtn.onclick = async () => {
                try {
                    // Since we don't have a single consolidatedData anymore, we might need to 
                    // export what is currently rendered or fetch again. 
                    // For now, let's just toast
                    showToast('Exportação indisponível com visualização dupla. Imprima a página ou PDF.', 'info');
                    /*
                    // Previous logic relied on consolidatedData array
                    */
                } catch (error) {
                    console.error('Excel export error:', error);
                    showToast(`Erro ao exportar: ${error.message}`, 'error');
                }
            };
        }

        if (pdfBtn) {
            pdfBtn.onclick = () => window.print();
        }
    }, 100);

    // --- Container Assembly ---
    const tableContainer = document.createElement('div');
    tableContainer.id = 'consolidadas-table-container';
    tableContainer.style.flex = '1';
    tableContainer.style.overflow = 'auto'; // Internal scroll

    const loadingOverlay = document.createElement('div');
    loadingOverlay.classList.add('loading-overlay', 'hidden'); // Corrected logic
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
