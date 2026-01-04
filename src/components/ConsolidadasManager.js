import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { MonthPicker } from './MonthPicker.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { PrintHelper } from '../utils/printHelper.js';
import { HierarchicalFilter } from './HierarchicalFilter.js';

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
    // User Request: Default to 'caixa'
    let viewType = 'caixa';
    let startMonth = localStorage.getItem('consolidadas_startMonth') || `${today.getFullYear()}-01`;
    let endMonth = localStorage.getItem('consolidadas_endMonth') || `${today.getFullYear()}-12`;
    let expandedNodes = new Set();
    let selectedCompanyIds = [];
    let companies = [];
    let accounts = [];

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
            let query = `projectId=${project.id}&viewType=${viewType}&startMonth=${startMonth}&endMonth=${endMonth}`;
            if (selectedCompanyIds.length > 0) {
                query += `&companyIds=${selectedCompanyIds.join(',')}`;
            }

            const url = `${API_BASE_URL}/consolidadas?${query}`;

            const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!resp.ok) throw new Error('Falha ao carregar dados consolidados');

            currentData = await resp.json(); // Expect { realized: [], provisioned: [] }

            renderAllTables();

            // --- IVA Context Broadcast (The Eyes) ---
            if (window.IVA && window.IVA.updateScreenContext) {
                // Calculate high-level summaries for IVA
                const summarizeRoot = (data, rootId) => {
                    const node = data.find(n => n.id === rootId);
                    return node ? { total: node.total, name: node.name } : null;
                };

                window.IVA.updateScreenContext({
                    screenId: 'consolidadas_dre',
                    title: 'Consolidadas (DRE / Fluxo)',
                    viewType: viewType, // Caixa or Competencia
                    period: { start: startMonth, end: endMonth },
                    summary: {
                        realized: {
                            total_revenue: summarizeRoot(currentData.realized, 'entradas_root'),
                            total_expenses: summarizeRoot(currentData.realized, 'saidas_root'),
                            net_result: summarizeRoot(currentData.realized, 'resultado_operacional_root') || summarizeRoot(currentData.realized, 'fluxo_financeiro_root')
                        },
                        provisioned: {
                            total_revenue: summarizeRoot(currentData.provisioned, 'entradas_root'),
                            total_expenses: summarizeRoot(currentData.provisioned, 'saidas_root'),
                            net_result: summarizeRoot(currentData.provisioned, 'resultado_operacional_root') || summarizeRoot(currentData.provisioned, 'fluxo_financeiro_root')
                        }
                    },
                    // We can also pass the raw top-level nodes if token limit allows, but summary is safer for now
                    raw_data_sample: null
                });
            }

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

        const titleReal = 'OPERAÇÕES FINALIZADAS';
        const titleProv = 'OPERAÇÕES FINALIZADAS E PREVISTAS';

        // Table 1: Realized
        tablesWrapper.appendChild(createTableHTML(currentData.realized, titleReal));

        // Spacer
        const spacer = document.createElement('div');
        spacer.style.height = '2rem';
        tablesWrapper.appendChild(spacer);

        // Table 2: Provisioned
        // Table 2: Provisioned
        tablesWrapper.appendChild(createTableHTML(currentData.provisioned, titleProv));

        // Adjust sticky columns dynamically
        setTimeout(adjustStickyColumns, 0);
    };

    const adjustStickyColumns = () => {
        const tablesWrapper = container.querySelector('#consolidadas-tables-wrapper');
        const tables = tablesWrapper.querySelectorAll('table');

        tables.forEach(table => {
            // Find max width of first column
            // We can't trust the TH width alone if it's auto.
            // But table layout auto should handle it?
            // Let's measure the first TH.
            const firstTh = table.querySelector('th.js-col-name');
            if (firstTh) {
                const w1 = firstTh.getBoundingClientRect().width;
                table.style.setProperty('--c1-width', `${w1}px`);

                // Avg Col Width (fixed 140px)
                const avgWidth = 140;
                table.style.setProperty('--c2-left', `${w1}px`);
                table.style.setProperty('--c3-left', `${w1 + avgWidth}px`);
            }
        });
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
                const rootIds = ['saidas_root', 'producao_root', 'entradas_root', 'resultado_operacional_root', 'aportes_root', 'retiradas_root', 'emprestimos_root', 'fluxo_financeiro_root', 'lucro_bruto_root', 'margem_bruta_root', 'margem_operacional_root'];
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
                        } else if (node.id === 'emprestimos_root' || node.id === 'pagamentos_emprestimos_root') {
                            color = '#3B82F6';
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
                    } else if (node.id === 'emprestimos_root' || node.id === 'pagamentos_emprestimos_root') {
                        totalColor = '#3B82F6';
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
                const totalCell = `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #d1d5db; font-weight: bold; color: ${totalColor}; font-size: ${fontSize}; position: sticky; left: var(--c3-left, 460px); background-color: #f3f4f6; z-index: 1; white-space: nowrap;">${displayTotal}</td>`;

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
                const averageCell = `<td style="padding: 0.5rem 1rem; text-align: right; border-bottom: 1px solid #d1d5db; font-weight: bold; color: ${totalColor}; font-size: ${fontSize}; position: sticky; left: var(--c2-left, 320px); background-color: #f3f4f6; z-index: 1; white-space: nowrap;">${displayAvg}</td>`;

                rowsHtml += `
                    <tr class="${rowClass}" data-id="${node.id}" style="background-color: ${rowBg}; cursor: ${hasChildren ? 'pointer' : 'default'};">
                        <td class="js-col-name" style="padding: 0.5rem 1rem 0.5rem ${paddingLeft}rem; border-bottom: 1px solid #f3f4f6; font-weight: ${fontWeight}; font-size: ${fontSize}; display: flex; align-items: center; gap: 0.5rem; position: sticky; left: 0; background-color: ${rowBg}; z-index: 1; width: auto; white-space: nowrap;" title="${node.name}">
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
        <table style="width: auto; border-collapse: separate; border-spacing: 0;">
            <thead style="position: sticky; top: 0; z-index: 10; background-color: #00425F; color: white;">
                <tr>
                    <th colspan="${months.length + 3}" style="padding: 0.5rem 1rem; text-align: center; border-bottom: 1px solid #ffffff33; background-color: #00425F; border-radius: 8px 8px 0 0; white-space: nowrap;">
                        ${title}
                    </th>
                </tr>
                <tr>
                    <th class="js-col-name" style="padding: 0.5rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: auto; position: sticky; left: 0; z-index: 11; background-color: #00425F; white-space: nowrap;"></th>
                    <th style="padding: 0.5rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: 140px; min-width: 140px; position: sticky; left: var(--c2-left, 320px); z-index: 11; background-color: #4B5563; color: white; white-space: nowrap;">MÉDIA</th>
                    <th style="padding: 0.5rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: 140px; min-width: 140px; position: sticky; left: var(--c3-left, 460px); z-index: 11; background-color: #374151; color: white; white-space: nowrap;">TOTAL</th>
                    ${months.map(m => {
            const [y, mo] = m.split('-');
            // User Request: Smallest possible width (fit content). Removed min-width: 120px.
            // Reduced padding to 0.5rem (all sides) to tighten height.
            return `<th style="padding: 0.5rem; text-align: center; border-bottom: 2px solid #e5e7eb; white-space: nowrap;">${mo}/${y}</th>`;
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

    // --- Fetch Metadata (Companies/Accounts) ---
    const loadMetadata = async () => {
        try {
            const token = localStorage.getItem('token');
            const [cRes, aRes] = await Promise.all([
                fetch(`${API_BASE_URL}/companies?projectId=${project.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/accounts?projectId=${project.id}`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            companies = await cRes.json();
            accounts = await aRes.json();

            // Render Filter
            const filterContainer = document.getElementById('consolidadas-filter-container');
            if (filterContainer && companies.length > 0) {
                // Build data structure for HierarchicalFilter
                const filterData = companies.map(comp => ({
                    id: comp.id,
                    label: comp.name,
                    children: [] // Consolidating by Company, we filter only Companies usually.
                    // But user said "like Fechamento", which filters Accounts too?
                    // Backend logic we implemented filters tables by `company_id`.
                    // Accounts table `contas` is not directly queried for transactions, but transactions have `account_id` too?
                    // No, transactions have `company_id`. 
                    // So filtering by ACCOUNT in transactions is possible but backend currently checks `company_id`.
                    // Let's stick to COMPANY filter as per request "seleção de EMPRESA".
                    // User said "seleção de EMPRESA usando o componente que permite a multipla seleção de empresas em estilo excel que tem na tela de fechamento de contas".
                    // Fechamento filters Accounts grouped by Companies.
                    // If I select a company, I select all its accounts?
                    // Backend check `company_id IN (...)`. 
                    // So I should treat the "Children" as just placeholders or maybe I don't need children if I only filter companies?
                    // HierarchicalFilter EXPECTS children structure?
                    // Let's make children empty or just use companies as leaf nodes if possible?
                    // HierarchicalFilter requires `children` array.
                    // I will format as: Company -> [Account1, Account2] but actually selecting 'Company' selects all accounts.
                    // BUT our backend filter uses `companyIds`.
                    // If user deselects an account, does it filter that account's transactions?
                    // Backend loop `company_id IN (...)`. It ignores account selection.
                    // So effectively this is a COMPANY filter.
                    // To avoid confusion, I will just list Companies. 
                    // But HierarchicalFilter is hierarchical.
                    // Let's mock children as "Todas" or just make it flat if possible?
                    // No, I'll just map companies.
                }));

                // Actually, to look like Fechamento, it should show accounts.
                // But since backend only filters by company_id, selecting specific accounts won't affect result unless I update backend to filter by account_id too.
                // Given query `companyIds`, I'll filter by Companies.
                // I will create dummy children if needed or just use `children: []`? 
                // HierarchicalFilter code: `parent.children.forEach`. It iterates children.
                // So I MUST populate children.
                // I will populate with accounts, but ignore specific account selection technically, 
                // OR I simply pass the company ID if *any* or *all* accounts are selected?
                // Simpler: Just allow Company selection (Parent). 
                // Impl: Company -> [ "Selecionar" ]. 
                // Or better: Just list Companies as parents, and give them 1 child "Selecionar".
                // Wait, `FechamentoContas` filters specific accounts. 
                // User asked for "seleção de EMPRESA".
                // I will just use companies. I'll hack HierarchicalFilter to have 1 dummy child per company if needed, or modify it?
                // No, I'll just use accounts as children. And if any account is selected, we include the company?
                // Or better: Pass `companyIds` of completely selected companies.
                // Let's try to pass all columns.
                // FOR NOW: I will load companies and accounts, build the tree.
                // If `selectedIds` contains accounts, I extract unique company IDs from those accounts.

                const treeData = companies.map(c => ({
                    id: `comp_${c.id}`,
                    label: c.name,
                    children: accounts.filter(a => a.company_id === c.id).map(a => ({ id: a.id, label: a.name }))
                }));

                new HierarchicalFilter({
                    container: filterContainer,
                    data: treeData,
                    onChange: (ids) => {
                        // IDs are Account IDs (integers).
                        // We need Company IDs.
                        // Map Account ID -> Company ID
                        const relevantCompanyIds = new Set();
                        ids.forEach(accId => {
                            const acc = accounts.find(a => a.id == accId);
                            if (acc) relevantCompanyIds.add(acc.company_id);
                        });
                        selectedCompanyIds = Array.from(relevantCompanyIds);
                        loadData();
                    },
                    placeholder: 'Todas as Empresas'
                });
            }
        } catch (e) {
            console.error('Error loading metadata', e);
        }
    };
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex; flex-direction:column; gap:0.5rem; padding:1rem 0.5rem 0.5rem; margin-bottom:0; position:sticky; top:0; z-index:40; background:#fff; border-bottom:1px solid #e5e7eb;';

    // Header Row
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;';

    // Radios (Moved to Top Left)
    const radioGroup = document.createElement('div');
    radioGroup.style.cssText = 'display:flex; gap:1.5rem; align-items:center; background:#f3f4f6; padding:0.25rem 1rem; border-radius:8px; min-height:40px; white-space:nowrap;';

    const createRadio = (lbl, val) => {
        const d = document.createElement('label');
        d.style.cssText = 'display:flex; align-items:center; gap:0.5rem; cursor:pointer; margin-bottom:0; white-space:nowrap;';
        const inp = document.createElement('input');
        inp.type = 'radio'; inp.name = 'viewType'; inp.value = val; inp.checked = (viewType === val); inp.style.accentColor = '#00425F';
        inp.onchange = (e) => { if (e.target.checked) { viewType = val; loadData(); } };
        const spn = document.createElement('span'); spn.textContent = lbl; spn.style.cssText = 'font-weight:500; color:#374151; font-size:0.95rem;';
        d.append(inp, spn); return d;
    };
    radioGroup.append(createRadio('Visão de Caixa', 'caixa'), createRadio('Visão de Competência', 'competencia'));

    headerRow.appendChild(radioGroup);
    headerRow.insertAdjacentHTML('beforeend', '<div style="font-size:1.5rem; font-weight:bold; color:#00425F;">📑 Consolidadas</div>');

    // Controls
    const controlsRow = document.createElement('div');
    controlsRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;';

    // Left
    const leftControls = document.createElement('div');
    leftControls.style.cssText = 'display:flex; align-items:center; gap:1.5rem;';

    // Company Filter (Replaces Radios)
    const filterContainer = document.createElement('div');
    filterContainer.id = 'consolidadas-filter-container';
    // Style it to match look
    filterContainer.style.marginRight = '1rem';

    // Dates
    const dateGroup = document.createElement('div'); dateGroup.style.cssText = 'display:flex; align-items:center; gap:0.5rem;';
    dateGroup.append(
        Object.assign(document.createElement('span'), { textContent: 'De:', style: 'font-size:0.9rem; color:#4B5563;' }),
        MonthPicker(startMonth, (v) => { startMonth = v; localStorage.setItem('consolidadas_startMonth', v); loadData(); }),
        Object.assign(document.createElement('span'), { textContent: 'Até:', style: 'font-size:0.9rem; color:#4B5563;' }),
        MonthPicker(endMonth, (v) => { endMonth = v; localStorage.setItem('consolidadas_endMonth', v); loadData(); })
    );

    leftControls.append(filterContainer, dateGroup);

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
    btnPdf.onclick = () => {
        PrintHelper.autoConfigureOrientation('#consolidadas-tables-wrapper table');
        window.print();
    };

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
    loadMetadata().then(() => loadData()); // Load metadata (companies) first, then data.


    return container;

};

