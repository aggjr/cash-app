const db = require('../config/database');

exports.getConsolidatedData = async (req, res) => {
    try {
        const { projectId, viewType, startMonth, endMonth, companyIds } = req.query; // startMonth/endMonth format: YYYY-MM

        let companyIdList = [];
        if (companyIds) {
            companyIdList = companyIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        }

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        const isCaixa = viewType === 'caixa';

        // --- CORE HELPER: Build Financial Tree ---
        const getFinancialTree = async (mode) => {
            // Mode: 'realized' or 'provisioned'
            const isProvisioned = mode === 'provisioned';

            // --- 1. Define Date Fields & Filters per Table ---
            // If Competencia:
            //   - Realized: data_fato
            //   - Provisioned: data_fato (But filter for Unpaid?)
            //   User said: "No caso de ser marcada a visão de competência, usa-se normalmente a data do fato".
            //   And "Este gride SC muda na visão de caixa".
            //   Implies Competencia logic is constant (data_fato).
            //   However, to separate "Realized" (Grid 1) from "Provisioned" (Grid 2), we MUST distinct filtering.
            //   Grid 1 is STRICTLY Realized items.
            //   Grid 2 is STRICTLY Provisioned (Open) items.
            //   So we use the payment status (data_real IS NULL/NOT NULL) to split them.

            const getTableConfig = (table) => {
                let dateField = '';
                let filter = '';

                // Common column map
                const colReal = table === 'entradas' ? 'data_real_recebimento' : 'data_real_pagamento';

                // --- CAIXA VIEW ---
                if (isCaixa) {
                    if (isProvisioned) {
                        // Logic Update: Show ALL items. Priority: Real > Atraso > Prevista
                        filter = '';
                        if (table === 'entradas') {
                            // Entradas uses 'data_atraso'
                            dateField = 'COALESCE(data_real_recebimento, data_atraso, data_prevista_recebimento)';
                        } else {
                            // Saidas / Producao uses 'data_prevista_atraso'
                            dateField = 'COALESCE(data_real_pagamento, data_prevista_atraso, data_prevista_pagamento)';
                        }
                    } else {
                        // Logic: Paid, use Real
                        filter = `AND ${colReal} IS NOT NULL`;
                        dateField = colReal;
                    }
                }
                // --- COMPETENCIA VIEW ---
                else {
                    dateField = 'data_fato';
                    // In Competencia, Realized means Incurred (data_fato exists). 
                    // No extra filter needed for "Realized" vs "Provisioned" if both rely on data_fato.
                    // Both show the same data? 
                    // User requested distinction, but conceptually Competencia Realizada is everything with data_fato.
                    // We remove the data_real check.
                    filter = '';
                }
                // Add company filter if present
                if (companyIdList.length > 0) {
                    // Check if table has company_column. Most do.
                    // entradas, saidas, producao_revenda all have company_id.
                    filter += ` AND company_id IN (${companyIdList.join(',')})`;
                }

                return { dateField, filter };
            };

            // --- 2. Build Tree Helper ---
            const buildTreeForTable = async (typeTable, dataTable, foreignKeyColumn) => {
                const config = getTableConfig(dataTable);

                // Fetch Types
                const [types] = await db.query(
                    `SELECT id, label, parent_id FROM ${typeTable} WHERE project_id = ? ORDER BY label`,
                    [projectId]
                );

                // Build Filter
                let localFilter = config.filter;
                const queryParams = [projectId];

                if (startMonth) {
                    localFilter += ` AND DATE_FORMAT(${config.dateField}, '%Y-%m') >= ?`;
                    queryParams.push(startMonth);
                }
                if (endMonth) {
                    localFilter += ` AND DATE_FORMAT(${config.dateField}, '%Y-%m') <= ?`;
                    queryParams.push(endMonth);
                }

                // Fetch Data
                const query = `
                    SELECT 
                        d.id, 
                        d.valor, 
                        d.${foreignKeyColumn} as type_id, 
                        DATE_FORMAT(${config.dateField}, '%Y-%m') as month_key
                    FROM ${dataTable} d
                    WHERE d.project_id = ? AND d.active = 1 ${localFilter}
                `;
                const [items] = await db.query(query, queryParams);

                // Build Map & Aggregate (Same generic logic)
                const typeMap = new Map();
                types.forEach(t => {
                    typeMap.set(t.id, {
                        id: `${typeTable}_${t.id}`,
                        originalId: t.id,
                        name: t.label,
                        parentId: t.parent_id ? `${typeTable}_${t.parent_id}` : null,
                        children: [],
                        monthlyTotals: {},
                        total: 0
                    });
                });

                items.forEach(item => {
                    const node = typeMap.get(item.type_id);
                    if (node) {
                        const val = parseFloat(item.valor) || 0;
                        node.monthlyTotals[item.month_key] = (node.monthlyTotals[item.month_key] || 0) + val;
                        node.total += val;
                    }
                });

                // Build Hierarchy
                const rootNodes = [];
                types.forEach(t => {
                    const node = typeMap.get(t.id);
                    if (t.parent_id) {
                        const parent = typeMap.get(t.parent_id);
                        if (parent) parent.children.push(node);
                    } else {
                        rootNodes.push(node);
                    }
                });

                // Rollup
                const calculateRollup = (node) => {
                    node.children.forEach(child => {
                        calculateRollup(child);
                        for (const [month, value] of Object.entries(child.monthlyTotals)) {
                            node.monthlyTotals[month] = (node.monthlyTotals[month] || 0) + value;
                        }
                        node.total += child.total;
                    });
                };
                rootNodes.forEach(root => calculateRollup(root));
                return rootNodes;
            };

            // --- 3. Execute for Main Tables ---
            let saidasRoots = await buildTreeForTable('tipo_saida', 'saidas', 'tipo_saida_id');
            const producaoRoots = await buildTreeForTable('tipo_producao_revenda', 'producao_revenda', 'tipo_id');
            let entradasRoots = await buildTreeForTable('tipo_entrada', 'entradas', 'tipo_entrada_id');

            // --- Separate LOAN PAYMENTS (SAIDAS) ---
            let pagamentosEmprestimosVirtual = { id: 'pagamentos_emprestimos_root', name: '- PGTO. EMPRÉSTIMOS', children: [], monthlyTotals: {}, total: 0, isNegative: true };

            const pgtoEmpIndex = saidasRoots.findIndex(n => {
                const name = n.name.toUpperCase();
                return (name.includes('PAGAMENTO') && name.includes('EMPRÉSTIMO')) || name.includes('AMORTIZAÇÃO');
            });

            if (pgtoEmpIndex !== -1) {
                const node = saidasRoots[pgtoEmpIndex];
                saidasRoots.splice(pgtoEmpIndex, 1);
                pagamentosEmprestimosVirtual.children = node.children;
                pagamentosEmprestimosVirtual.monthlyTotals = node.monthlyTotals;
                pagamentosEmprestimosVirtual.total = node.total;
            }

            // --- Separate EMPRÉSTIMOS from ENTRADAS ---
            let emprestimosVirtual = { id: 'emprestimos_root', name: '+ EMPRÉSTIMOS', children: [], monthlyTotals: {}, total: 0, isPositive: true };

            // Find and remove 'EMPRÉSTIMOS' from entradasRoots
            const empIndex = entradasRoots.findIndex(n => n.name.toUpperCase().includes('EMPRÉSTIMOS') || n.name.toUpperCase().includes('EMPRESTIMOS'));
            if (empIndex !== -1) {
                const empNode = entradasRoots[empIndex];
                entradasRoots.splice(empIndex, 1); // Remove from Entradas
                // Use this node as Emprestimos Virtual (or wrap it)
                // We wrap it to keep consistent ID structure or just use it?
                // Visual consistency: The row "EMPRESTIMOS" should be the root.
                // The found node is likely the root "EMPRÉSTIMOS".
                // But we want to ensure 'isPositive' styling etc.
                emprestimosVirtual.children = [empNode]; // Keep hierarchy if it has children? 
                // Actually empNode IS the tree for loans.
                // Let's just merge its data into emprestimosVirtual
                emprestimosVirtual.children = empNode.children; // Assuming simple structure or we keep empNode as child?
                // If I keep empNode as child, user sees "+ EMPRÉSTIMOS" -> "EMPRESTIMOS" -> items. Weird.
                // Better: Just take empNode and rename/re-id it?
                // Or if multiple loan types exist?
                // Let's copy totals.
                emprestimosVirtual.monthlyTotals = empNode.monthlyTotals;
                emprestimosVirtual.total = empNode.total;
                emprestimosVirtual.children = empNode.children; // Adopt children
            }

            // --- 4. Extra Data (Aportes / Retiradas) ---
            // Logic: Include in BOTH Views (Realized=Real Date, Provisioned=Predicted Date)
            let aportesVirtual = { id: 'aportes_root', name: '+ APORTES', children: [], monthlyTotals: {}, total: 0, isPositive: true };
            let retiradasVirtual = { id: 'retiradas_root', name: '- RETIRADAS', children: [], monthlyTotals: {}, total: 0, isNegative: true };

            // Fetch Helper for Extra Data
            const getExtraData = async (table) => {
                // Determine Date Field
                let dateField = 'data_fato'; // Default
                if (isCaixa) {
                    if (isProvisioned) dateField = 'COALESCE(data_real, data_prevista)'; // Priority: Real > Prevista
                    else dateField = 'COALESCE(data_real, data_fato)'; // Use Real (or Fato fallback) for Realized
                } else {
                    // Competencia
                    dateField = 'data_fato';
                }

                // Filter?
                // If Realized (Caixa), ensure it happened? 
                // Previously we assumed everything in Aportes/Retiradas was realized.
                // Now strictly: Provisioned = All, Realized = data_real NOT NULL?
                // Schema has data_real, data_prevista.
                let filter = '';
                // Logic Update: Realized Table (!isProvisioned) ALWAYS requires data_real checking (actual payment/receipt) ONLY IN CAIXA.
                // In Competencia, we show everything.
                if (isCaixa && !isProvisioned) {
                    filter = 'AND data_real IS NOT NULL';
                }

                if (companyIdList.length > 0) {
                    filter += ` AND company_id IN (${companyIdList.join(',')})`;
                }

                let qParams = [projectId];
                let qFilter = filter; // Start with base filter

                if (startMonth) { qFilter += ` AND DATE_FORMAT(${dateField}, '%Y-%m') >= ?`; qParams.push(startMonth); }
                if (endMonth) { qFilter += ` AND DATE_FORMAT(${dateField}, '%Y-%m') <= ?`; qParams.push(endMonth); }

                const [rows] = await db.query(`
                    SELECT DATE_FORMAT(${dateField}, '%Y-%m') as month_key, SUM(valor) as total
                    FROM ${table} WHERE project_id = ? AND active = 1 ${qFilter} GROUP BY month_key
                `, qParams);
                return rows;
            };

            const aportesRows = await getExtraData('aportes');
            aportesRows.forEach(r => {
                const v = parseFloat(r.total) || 0; aportesVirtual.monthlyTotals[r.month_key] = v; aportesVirtual.total += v;
            });

            const retiradasRows = await getExtraData('retiradas');
            retiradasRows.forEach(r => {
                const v = parseFloat(r.total) || 0; retiradasVirtual.monthlyTotals[r.month_key] = v; retiradasVirtual.total += v;
            });

            // --- 5. Virtual Nodes Construction (Calculations) ---
            const createVirtualRoot = (id, name, children) => {
                const v = { id, name, children, monthlyTotals: {}, total: 0 };
                children.forEach(c => {
                    for (const [m, val] of Object.entries(c.monthlyTotals)) v.monthlyTotals[m] = (v.monthlyTotals[m] || 0) + val;
                    v.total += c.total;
                });
                return v;
            };

            const entradasVirtual = createVirtualRoot('entradas_root', 'ENTRADAS', entradasRoots);
            const producaoVirtual = createVirtualRoot('producao_root', 'Compras (Produção/Revenda)', producaoRoots);
            const saidasVirtual = createVirtualRoot('saidas_root', 'SAÍDAS OPERACIONAIS', saidasRoots);

            // Lucro Bruto
            const lucroBrutoVirtual = { id: 'lucro_bruto_root', name: '= LUCRO BRUTO', children: [], monthlyTotals: {}, total: 0, isTotal: true };
            // Copied calculation logic...
            const allMonths = new Set([...Object.keys(entradasVirtual.monthlyTotals), ...Object.keys(producaoVirtual.monthlyTotals)]);
            allMonths.forEach(m => {
                const ent = entradasVirtual.monthlyTotals[m] || 0;
                const prod = producaoVirtual.monthlyTotals[m] || 0;
                lucroBrutoVirtual.monthlyTotals[m] = ent - prod;
            });
            lucroBrutoVirtual.total = entradasVirtual.total - producaoVirtual.total;

            // Margem Bruta
            const margemBrutaVirtual = { id: 'margem_bruta_root', name: '% MARGEM BRUTA', children: [], monthlyTotals: {}, total: 0, isPercentage: true };
            allMonths.forEach(m => {
                const lb = lucroBrutoVirtual.monthlyTotals[m] || 0;
                const ent = entradasVirtual.monthlyTotals[m] || 0;
                margemBrutaVirtual.monthlyTotals[m] = (Math.abs(ent) > 0.01) ? (lb / ent) : 0;
            });
            margemBrutaVirtual.total = (Math.abs(entradasVirtual.total) > 0.01) ? (lucroBrutoVirtual.total / entradasVirtual.total) : 0;

            // Resultado Operacional
            const resOpVirtual = { id: 'resultado_operacional_root', name: '= RESULTADO OPERACIONAL', children: [], monthlyTotals: {}, total: 0, isTotal: true };
            const opMonths = new Set([...Object.keys(lucroBrutoVirtual.monthlyTotals), ...Object.keys(saidasVirtual.monthlyTotals)]);
            opMonths.forEach(m => {
                resOpVirtual.monthlyTotals[m] = (lucroBrutoVirtual.monthlyTotals[m] || 0) - (saidasVirtual.monthlyTotals[m] || 0);
            });
            resOpVirtual.total = lucroBrutoVirtual.total - saidasVirtual.total;

            // Margem Operacional
            const margemOpVirtual = { id: 'margem_operacional_root', name: '% MARGEM OPERACIONAL', children: [], monthlyTotals: {}, total: 0, isPercentage: true };
            opMonths.forEach(m => {
                const ro = resOpVirtual.monthlyTotals[m] || 0;
                const ent = entradasVirtual.monthlyTotals[m] || 0;
                margemOpVirtual.monthlyTotals[m] = (Math.abs(ent) > 0.01) ? (ro / ent) : 0;
            });
            margemOpVirtual.total = (Math.abs(entradasVirtual.total) > 0.01) ? (resOpVirtual.total / entradasVirtual.total) : 0;

            // Fluxo Financeiro
            const fluxoVirtual = { id: 'fluxo_financeiro_root', name: '= FLUXO FINANCEIRO MENSAL', children: [], monthlyTotals: {}, total: 0, isTotal: true, isFinal: true };
            const flxMonths = new Set([
                ...Object.keys(resOpVirtual.monthlyTotals),
                ...Object.keys(aportesVirtual.monthlyTotals),
                ...Object.keys(retiradasVirtual.monthlyTotals),
                ...Object.keys(emprestimosVirtual.monthlyTotals),
                ...Object.keys(pagamentosEmprestimosVirtual.monthlyTotals)
            ]);

            flxMonths.forEach(m => {
                fluxoVirtual.monthlyTotals[m] = (resOpVirtual.monthlyTotals[m] || 0)
                    + (aportesVirtual.monthlyTotals[m] || 0)
                    + (emprestimosVirtual.monthlyTotals[m] || 0)
                    - (retiradasVirtual.monthlyTotals[m] || 0)
                    - (pagamentosEmprestimosVirtual.monthlyTotals[m] || 0);
            });
            fluxoVirtual.total = resOpVirtual.total + aportesVirtual.total + emprestimosVirtual.total - retiradasVirtual.total - pagamentosEmprestimosVirtual.total;

            return [
                entradasVirtual, producaoVirtual, lucroBrutoVirtual, margemBrutaVirtual,
                saidasVirtual, resOpVirtual, margemOpVirtual,
                emprestimosVirtual, pagamentosEmprestimosVirtual, aportesVirtual, retiradasVirtual, fluxoVirtual
            ];
        };

        // --- Execute for BOTH ---
        const realized = await getFinancialTree('realized');
        const provisioned = await getFinancialTree('provisioned');

        res.json({ realized, provisioned });

    } catch (error) {
        console.error('Error in getConsolidatedData:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};
