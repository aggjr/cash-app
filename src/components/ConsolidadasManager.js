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
    let viewType = localStorage.getItem('consolidadas_viewType') || 'caixa'; // 'caixa' (default) | 'competencia'
    let expandedNodes = new Set(); // Store IDs of expanded nodes (Strings now)
    let consolidatedData = [];

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

    // Pre-declare renderTable so loadData can use it
    let renderTable;

    // --- Fetch Data ---
    const loadData = async () => {
        const overlay = container.querySelector('.loading-overlay');
        try {
            if (overlay) overlay.style.display = 'flex';

            const token = localStorage.getItem('token');
            const url = `${API_BASE_URL}/consolidadas?projectId=${project.id}&viewType=${viewType}&startMonth=${startMonth}&endMonth=${endMonth}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                let errorMsg = errorData.error?.message || 'Falha ao carregar dados consolidados';
                if (errorData.error?.sqlError) {
                    const sql = errorData.error.sqlError;
                    errorMsg += ` [SQL: ${sql.sqlCode || 'N/A'} - ${sql.sqlMessage || ''}]`;
                    console.error('SQL Error Details:', sql);
                }
                if (errorData.error?.code) {
                    errorMsg = `[${errorData.error.code}] ${errorMsg}`;
                }
                throw new Error(errorMsg);
            }

            consolidatedData = await response.json();
            if (renderTable) renderTable();

        } catch (error) {
            console.error(error);
            showToast(error.message || 'Erro ao carregar dados', 'error');
        } finally {
            if (overlay) overlay.style.display = 'none';
        }
    };

    // --- Render Table ---
    renderTable = () => {
        const tableContainer = container.querySelector('#consolidadas-table-container');
        const months = getMonthKeys();

        // Header
        let html = `
            <table style="width: auto; min-width: 50%; border-collapse: separate; border-spacing: 0;">
                <thead style="position: sticky; top: 0; z-index: 10; background-color: #00425F; color: white;">
                    <tr>
                        <th style="padding: 1rem; text-align: left; border-bottom: 2px solid #e5e7eb; min-width: 300px; position: sticky; left: 0; background-color: #00425F; z-index: 11;">TRANSAÇÕES</th>
                        ${months.map(m => {
            const [y, mo] = m.split('-');
            return `<th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; min-width: 120px;">${mo}/${y}</th>`;
        }).join('')}
                        <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; min-width: 120px;">Total</th>
                        <th style="padding: 1rem; text-align: center; border-bottom: 2px solid #e5e7eb; min-width: 120px;">MÉDIA</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Recursive Row Renderer
        const renderRows = (nodes, level = 0) => {
            nodes.forEach(node => {
                // VISIBILITY RULES - updated to include new rows
                const isRoot = ['saidas_root', 'producao_root', 'total_saidas_root', 'entradas_root', 'resultado_operacional_root', 'aportes_root', 'retiradas_root', 'resultado_final_root'].includes(node.id);

                // If not root and total is essentially zero, check if we should hide it.
                // User said: "mesmo que estejam com valores zerados" FOR THE ROOTS.
                // For sub-items, we can probably hide zero rows to keep it clean, OR just show everything.
                // Let's hide zero SUB-items for clarity, but keep ROOTS always.
                if (!isRoot && Math.abs(node.total) < 0.01) return;

                const hasChildren = node.children && node.children.length > 0;
                const isExpanded = expandedNodes.has(node.id); // ID is string
                const paddingLeft = level * 1.5 + 1;

                // Styling
                let rowBg = level === 0 ? '#f0f9ff' : '#ffffff';
                let fontWeight = level === 0 ? '700' : (hasChildren ? '600' : '400');

                // Special Highlights for Totals and Final Rows
                if (node.id === 'total_saidas_root' || node.id === 'resultado_operacional_root') {
                    rowBg = '#e0f2fe'; // Blue highlight
                    fontWeight = '800';
                }

                if (node.id === 'resultado_final_root') {
                    rowBg = '#dbeafe'; // Lighter blue for final
                    fontWeight = '800';
                }

                const rowClass = hasChildren ? 'expandable-row' : '';

                // Generate Column Cells
                let monthCells = '';
                months.forEach(m => {
                    const val = node.monthlyTotals[m] || 0;

                    // --- COLOR LOGIC ---
                    let color = '#9CA3AF'; // Zero
                    if (Math.abs(val) > 0.001) {
                        // Check type based on ID
                        if (node.id === 'aportes_root') {
                            // APORTES: Always green (positive contribution)
                            color = '#10B981';
                        } else if (node.id === 'retiradas_root') {
                            // RETIRADAS: Always red (negative withdrawal)
                            color = '#EF4444';
                        } else if (node.id === 'resultado_operacional_root' || node.id === 'resultado_final_root') {
                            // RESULTADOS: Positive = Green, Negative = Red
                            color = val >= 0 ? '#10B981' : '#EF4444';
                        } else if (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada'))) {
                            // ENTRADAS: Positive = Green, Negative = Red
                            color = val >= 0 ? '#10B981' : '#EF4444';
                        } else {
                            // SAIDAS / PRODUCAO / TOTAL SAIDAS: Positive (Expense) = Red, Negative (Reversal) = Green
                            color = val >= 0 ? '#EF4444' : '#10B981';
                        }
                    }

                    monthCells += `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; color: ${color}; font-weight: 600;">${val !== 0 ? formatCurrency(val) : '-'}</td>`;
                });

                // Total Cell Color
                let totalColor = '#9CA3AF';
                if (Math.abs(node.total) > 0.001) {
                    const val = node.total;
                    if (node.id === 'aportes_root') {
                        totalColor = '#10B981'; // Always green
                    } else if (node.id === 'retiradas_root') {
                        totalColor = '#EF4444'; // Always red
                    } else if (node.id === 'resultado_operacional_root' || node.id === 'resultado_final_root') {
                        totalColor = val >= 0 ? '#10B981' : '#EF4444';
                    } else if (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada'))) {
                        totalColor = val >= 0 ? '#10B981' : '#EF4444';
                    } else {
                        totalColor = val >= 0 ? '#EF4444' : '#10B981';
                    }
                }

                const totalCell = `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: ${totalColor}; text-align: center;">${node.total !== 0 ? formatCurrency(node.total) : '-'}</td>`;

                // Average Calculation
                let average = 0;
                if (months.length > 0) {
                    average = node.total / months.length;
                }
                const averageCell = `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: ${totalColor}; text-align: center;">${average !== 0 ? formatCurrency(average) : '-'}</td>`;

                // Row HTML
                html += `
                    <tr class="${rowClass}" data-id="${node.id}" style="background-color: ${rowBg}; cursor: ${hasChildren ? 'pointer' : 'default'};">
                        <td style="padding: 0.5rem 1rem 0.5rem ${paddingLeft}rem; border-bottom: 1px solid #f3f4f6; font-weight: ${fontWeight}; display: flex; align-items: center; gap: 0.5rem; position: sticky; left: 0; background-color: ${rowBg}; z-index: 1;">
                            ${hasChildren ? `<span style="font-size: 0.8rem; transform: rotate(${isExpanded ? '90deg' : '0deg'}); transition: transform 0.2s;">▶</span>` : ''}
                            ${node.name}
                        </td>
                        ${monthCells}
                        ${totalCell}
                        ${averageCell}
                    </tr>
                `;

                // Recurse if expanded
                if (hasChildren && isExpanded) {
                    renderRows(node.children, level + 1);
                }
            });
        };

        if (consolidatedData.length === 0) {
            html += `<tr><td colspan="${months.length + 2}" style="padding: 3rem; text-align: center; color: #6B7280;">Nenhum dado encontrado para o período.</td></tr>`;
        } else {
            renderRows(consolidatedData);
        }

        html += '</tbody></table>';
        tableContainer.innerHTML = html;

        // Attach Click Listeners for Expansion
        tableContainer.querySelectorAll('.expandable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = row.dataset.id; // String ID
                if (expandedNodes.has(id)) {
                    expandedNodes.delete(id);
                } else {
                    expandedNodes.add(id);
                }
                renderTable(); // Re-render with new state
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
    controls.style.padding = '1rem';
    controls.style.backgroundColor = 'white';
    controls.style.borderBottom = '1px solid #e5e7eb';
    controls.style.borderRadius = '8px 8px 0 0';

    // Left Logic Group
    const leftGroup = document.createElement('div');
    leftGroup.style.display = 'flex';
    leftGroup.style.alignItems = 'center';
    leftGroup.style.gap = '1.5rem';

    // View Type
    const viewGroup = document.createElement('div');
    viewGroup.style.display = 'flex';
    viewGroup.style.gap = '1rem';
    viewGroup.style.background = '#f3f4f6';
    viewGroup.style.padding = '0.5rem';
    viewGroup.style.borderRadius = '8px';

    const renderRadio = (label, val) => {
        const lbl = document.createElement('label');
        lbl.style.display = 'flex'; lbl.style.alignItems = 'center'; lbl.style.gap = '0.5rem';
        lbl.style.cursor = 'pointer'; lbl.style.fontSize = '0.9rem'; lbl.style.fontWeight = '500';

        const inp = document.createElement('input');
        inp.type = 'radio';
        inp.name = 'viewType';
        inp.value = val;
        if (viewType === val) inp.checked = true;

        inp.onchange = (e) => {
            viewType = e.target.value;
            localStorage.setItem('consolidadas_viewType', viewType);
            loadData();
        };

        lbl.appendChild(inp);
        lbl.appendChild(document.createTextNode(label));
        return lbl;
    };

    viewGroup.appendChild(renderRadio('Visão de Caixa', 'caixa'));
    viewGroup.appendChild(renderRadio('Visão de Competência', 'competencia'));
    leftGroup.appendChild(viewGroup);

    // Date Pickers Group
    const dateGroup = document.createElement('div');
    dateGroup.style.display = 'flex';
    dateGroup.style.alignItems = 'center';
    dateGroup.style.gap = '0.5rem';

    const lblDe = document.createElement('span');
    lblDe.textContent = 'De:'; lblDe.style.fontSize = '0.9rem'; lblDe.style.color = '#4B5563';

    // Updated to use imported MonthPicker and auto-trigger loadData
    const startPicker = MonthPicker(startMonth, (val) => {
        startMonth = val;
        localStorage.setItem('consolidadas_startMonth', startMonth);
        loadData();
    });

    const lblAte = document.createElement('span');
    lblAte.textContent = 'Até:'; lblAte.style.fontSize = '0.9rem'; lblAte.style.color = '#4B5563';

    // Updated to use imported MonthPicker and auto-trigger loadData
    const endPicker = MonthPicker(endMonth, (val) => {
        endMonth = val;
        localStorage.setItem('consolidadas_endMonth', endMonth);
        loadData();
    });

    dateGroup.appendChild(lblDe);
    dateGroup.appendChild(startPicker);
    dateGroup.appendChild(lblAte);
    dateGroup.appendChild(endPicker);

    leftGroup.appendChild(dateGroup); // Refresh button removed

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
    title.style.fontSize = '1.2rem';
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
                    if (consolidatedData.length === 0) {
                        showToast('Sem dados para exportar', 'warning');
                        return;
                    }

                    const months = getMonthKeys();
                    const exportData = [];

                    // Flatten hierarchy function
                    const flattenNodes = (nodes, level = 0) => {
                        nodes.forEach(node => {
                            const indent = '  '.repeat(level);
                            const row = { 'Categoria': indent + node.name };

                            months.forEach(m => {
                                const [y, mo] = m.split('-');
                                const label = `${mo}/${y}`;
                                row[label] = node.monthlyTotals[m] || 0;
                            });

                            row['Total'] = node.total || 0;
                            row['Média'] = months.length > 0 ? (node.total / months.length) : 0;

                            exportData.push(row);

                            if (node.children && node.children.length > 0) {
                                flattenNodes(node.children, level + 1);
                            }
                        });
                    };

                    flattenNodes(consolidatedData);

                    // Define columns
                    const columns = [
                        { header: 'Categoria', key: 'Categoria', width: 40, type: 'text' }
                    ];

                    months.forEach(m => {
                        const [y, mo] = m.split('-');
                        const label = `${mo}/${y}`;
                        columns.push({
                            header: label,
                            key: label,
                            width: 15,
                            type: 'currency'
                        });
                    });

                    columns.push(
                        { header: 'Total', key: 'Total', width: 15, type: 'currency' },
                        { header: 'Média', key: 'Média', width: 15, type: 'currency' }
                    );

                    await ExcelExporter.exportTable(
                        exportData,
                        columns,
                        'Relatório Consolidado',
                        'consolidadas'
                    );
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
    loadingOverlay.className = 'loading-overlay hidden';
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

    container.appendChild(controls);
    container.appendChild(tableContainer);
    container.appendChild(loadingOverlay);

    // --- Init ---
    // Render empty table structure immediately
    renderTable();

    // Then load data
    loadData();

    return container;
};
