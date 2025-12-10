import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

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

            if (!response.ok) throw new Error('Falha ao carregar dados consolidados');

            consolidatedData = await response.json();
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
        const tableContainer = container.querySelector('#consolidadas-table-container');
        const months = getMonthKeys();

        // Header
        let html = `
            <table style="width: auto; min-width: 50%; border-collapse: separate; border-spacing: 0;">
                <thead style="position: sticky; top: 0; z-index: 10; background-color: #00425F; color: white;">
                    <tr>
                        <th style="padding: 1rem; text-align: left; border-bottom: 2px solid #e5e7eb; min-width: 300px;">TRANSAÇÕES</th>
                        ${months.map(m => {
            const [y, mo] = m.split('-');
            return `<th style="padding: 1rem; text-align: right; border-bottom: 2px solid #e5e7eb; min-width: 120px;">${mo}/${y}</th>`;
        }).join('')}
                        <th style="padding: 1rem; text-align: right; border-bottom: 2px solid #e5e7eb; min-width: 120px;">Total</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Recursive Row Renderer
        const renderRows = (nodes, level = 0) => {
            nodes.forEach(node => {
                // VISIBILITY RULES
                const isRoot = ['saidas_root', 'producao_root', 'total_saidas_root', 'entradas_root', 'resultado_final_root'].includes(node.id);

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

                // Special Highlights for Totals
                if (node.id === 'total_saidas_root' || node.id === 'resultado_final_root') {
                    rowBg = '#e0f2fe'; // Darker blue
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
                        if (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada'))) {
                            // ENTRADAS: Positive = Green, Negative = Red
                            color = val >= 0 ? '#10B981' : '#EF4444';
                        } else if (node.id === 'resultado_final_root') {
                            // RESULTADO: Positive = Green, Negative = Red
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
                    if (node.id && (node.id.toString().startsWith('entradas') || node.id.toString().includes('tipo_entrada'))) {
                        totalColor = val >= 0 ? '#10B981' : '#EF4444';
                    } else if (node.id === 'resultado_final_root') {
                        totalColor = val >= 0 ? '#10B981' : '#EF4444';
                    } else {
                        totalColor = val >= 0 ? '#EF4444' : '#10B981';
                    }
                }

                const totalCell = `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #f3f4f6; font-weight: bold; color: ${totalColor};">${node.total !== 0 ? formatCurrency(node.total) : '-'}</td>`;

                // Row HTML
                html += `
                    <tr class="${rowClass}" data-id="${node.id}" style="background-color: ${rowBg}; cursor: ${hasChildren ? 'pointer' : 'default'};">
                        <td style="padding: 0.5rem 1rem 0.5rem ${paddingLeft}rem; border-bottom: 1px solid #f3f4f6; font-weight: ${fontWeight}; display: flex; align-items: center; gap: 0.5rem;">
                            ${hasChildren ? `<span style="font-size: 0.8rem; transform: rotate(${isExpanded ? '90deg' : '0deg'}); transition: transform 0.2s;">▶</span>` : ''}
                            ${node.name}
                        </td>
                        ${monthCells}
                        ${totalCell}
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

    // --- Build Header / Controls ---
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
             <!-- View Type Radio -->
             <div style="display: flex; gap: 1rem; background: #f3f4f6; padding: 0.5rem; border-radius: 8px;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; font-weight: 500;">
                    <input type="radio" name="viewType" value="caixa" ${viewType === 'caixa' ? 'checked' : ''}>
                    Visão de Caixa
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; font-weight: 500;">
                    <input type="radio" name="viewType" value="competencia" ${viewType === 'competencia' ? 'checked' : ''}>
                    Visão de Competência
                </label>
             </div>

             <!-- Date Range -->
             <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.9rem; color: #4B5563;">De:</label>
                <input type="month" id="start-month" value="${startMonth}" style="padding: 0.4rem; border: 1px solid #d1d5db; border-radius: 4px; font-family: inherit;">
                
                <label style="font-size: 0.9rem; color: #4B5563;">Até:</label>
                <input type="month" id="end-month" value="${endMonth}" style="padding: 0.4rem; border: 1px solid #d1d5db; border-radius: 4px; font-family: inherit;">
             </div>
             
             <button id="btn-refresh" class="btn-primary" style="padding: 0.4rem 1rem;">
                🔄 Atualizar
             </button>
        </div>
        
        <div style="font-size: 1.2rem; font-weight: bold; color: #00425F;">
            📑 Consolidadas
        </div>
    `;

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

    // --- Event Listeners ---
    controls.querySelectorAll('input[name="viewType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            viewType = e.target.value;
            localStorage.setItem('consolidadas_viewType', viewType);
            loadData();
        });
    });

    const startInput = controls.querySelector('#start-month');
    const endInput = controls.querySelector('#end-month');
    const btnRefresh = controls.querySelector('#btn-refresh');

    const handleDateChange = () => {
        startMonth = startInput.value;
        endMonth = endInput.value;
        localStorage.setItem('consolidadas_startMonth', startMonth);
        localStorage.setItem('consolidadas_endMonth', endMonth);
    };

    startInput.addEventListener('change', handleDateChange);
    endInput.addEventListener('change', handleDateChange);

    btnRefresh.addEventListener('click', () => {
        startMonth = startInput.value;
        endMonth = endInput.value;
        localStorage.setItem('consolidadas_startMonth', startMonth);
        localStorage.setItem('consolidadas_endMonth', endMonth);
        loadData();
    });

    // --- Init ---
    loadData();

    return container;
};
