const db = require('../config/database');

exports.getConsolidatedData = async (req, res) => {
    try {
        const { projectId, viewType, startMonth, endMonth } = req.query; // startMonth/endMonth format: YYYY-MM

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        // 1. Determine Date Field based on View Type
        // DEFAULT to Competência (Accrual) if not 'caixa'
        const isCaixa = viewType === 'caixa';
        // Main entities use detailed names, simpler ones use generic
        const dateField = isCaixa ? 'data_real_pagamento' : 'data_fato';

        // 2. Build Date Filter
        let dateFilter = '';
        const params = [projectId];

        if (startMonth) {
            dateFilter += ` AND DATE_FORMAT(${dateField}, '%Y-%m') >= ?`;
            params.push(startMonth);
        }
        if (endMonth) {
            dateFilter += ` AND DATE_FORMAT(${dateField}, '%Y-%m') <= ?`;
            params.push(endMonth);
        }
        if (isCaixa) {
            dateFilter += ` AND ${dateField} IS NOT NULL`;
        }

        // --- HELPER: Fetch and Aggregation Logic ---
        const buildTreeForTable = async (typeTable, dataTable, foreignKeyColumn, tableDateField) => {
            // Fetch Types
            const [types] = await db.execute(
                `SELECT id, label, parent_id FROM ${typeTable} WHERE project_id = ? ORDER BY label`,
                [projectId]
            );

            // Build date filter using tableDateField for this specific table
            let localFilter = '';
            const queryParams = [projectId];

            if (startMonth) {
                localFilter += ` AND DATE_FORMAT(d.${tableDateField}, '%Y-%m') >= ?`;
                queryParams.push(startMonth);
            }
            if (endMonth) {
                localFilter += ` AND DATE_FORMAT(d.${tableDateField}, '%Y-%m') <= ?`;
                queryParams.push(endMonth);
            }
            if (isCaixa) {
                localFilter += ` AND d.${tableDateField} IS NOT NULL`;
            }

            // Fetch Data
            const query = `
                SELECT 
                    d.id, 
                    d.valor, 
                    d.${foreignKeyColumn} as type_id, 
                    DATE_FORMAT(d.${tableDateField}, '%Y-%m') as month_key
                FROM ${dataTable} d
                WHERE d.project_id = ? AND d.active = 1 ${localFilter}
            `;
            const [items] = await db.execute(query, queryParams);

            // Build Map
            const typeMap = new Map();
            types.forEach(t => {
                typeMap.set(t.id, {
                    id: `${typeTable}_${t.id}`, // Unique String ID
                    originalId: t.id,
                    name: t.label,
                    parentId: t.parent_id ? `${typeTable}_${t.parent_id}` : null,
                    children: [],
                    monthlyTotals: {},
                    total: 0
                });
            });

            // Aggregate Data
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
                    if (parent) {
                        parent.children.push(node);
                    }
                } else {
                    rootNodes.push(node);
                }
            });

            // Rollup Calculation
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

        // --- Execute for tables (with proper date fields) ---
        let saidasDateField = 'data_fato';
        let entradasDateField = 'data_fato';
        let producaoDateField = 'data_fato';

        if (isCaixa) {
            saidasDateField = 'data_real_pagamento';
            entradasDateField = 'data_real_recebimento';
            producaoDateField = 'data_real_pagamento';
        }
        // Competencia (default) uses data_fato for all

        const saidasRoots = await buildTreeForTable('tipo_saida', 'saidas', 'tipo_saida_id', saidasDateField);
        const producaoRoots = await buildTreeForTable('tipo_producao_revenda', 'producao_revenda', 'tipo_id', producaoDateField);
        const entradasRoots = await buildTreeForTable('tipo_entrada', 'entradas', 'tipo_entrada_id', entradasDateField);

        // --- Helper: Create Virtual Root ---
        const createVirtualRoot = (id, name, children) => {
            const virtual = {
                id: id,
                name: name,
                children: children,
                monthlyTotals: {},
                total: 0
            };

            if (children && children.length > 0) {
                children.forEach(child => {
                    for (const [month, value] of Object.entries(child.monthlyTotals)) {
                        virtual.monthlyTotals[month] = (virtual.monthlyTotals[month] || 0) + value;
                    }
                    virtual.total += child.total;
                });
            }
            return virtual;
        };

        // --- FETCH EXTRA DATA (Aportes / Retiradas) ---
        // Aportes Logic
        // Aportes typically represents realized cash injection, so data_fato IS the real date.
        // Schema check indicates 'data_fato' exists, but 'data_real' might not.
        let aportesDateField = 'data_fato';
        // if (isCaixa) { aportesDateField = 'data_real'; } // Removed unsafe assumption

        let extraFilter = '';
        const extraParams = [projectId];

        if (startMonth) {
            extraFilter += ` AND DATE_FORMAT(${aportesDateField}, '%Y-%m') >= ?`;
            extraParams.push(startMonth);
        }
        if (endMonth) {
            extraFilter += ` AND DATE_FORMAT(${aportesDateField}, '%Y-%m') <= ?`;
            extraParams.push(endMonth);
        }
        // Strict Caixa Check: ONLY if it's considered "Real" (Not Null)
        if (isCaixa) {
            extraFilter += ` AND ${aportesDateField} IS NOT NULL`;
        }

        const [aportesData] = await db.execute(`
            SELECT 
                DATE_FORMAT(${aportesDateField}, '%Y-%m') AS month_key,
                SUM(valor) AS total
            FROM aportes
            WHERE project_id = ? AND active = 1 ${extraFilter}
           GROUP BY month_key
        `, extraParams);

        // Retiradas Logic
        // Retiradas also typically realized immediately. Use data_fato.
        let retiradasDateField = 'data_fato';
        // if (isCaixa) { retiradasDateField = 'data_real'; } // Removed unsafe assumption

        let retFilter = '';
        const retParams = [projectId];
        if (startMonth) { retFilter += ` AND DATE_FORMAT(${retiradasDateField}, '%Y-%m') >= ?`; retParams.push(startMonth); }
        if (endMonth) { retFilter += ` AND DATE_FORMAT(${retiradasDateField}, '%Y-%m') <= ?`; retParams.push(endMonth); }
        if (isCaixa) { retFilter += ` AND ${retiradasDateField} IS NOT NULL`; }

        const [retiradasData] = await db.execute(`
            SELECT 
                DATE_FORMAT(${retiradasDateField}, '%Y-%m') AS month_key,
                SUM(valor) AS total
            FROM retiradas
            WHERE project_id = ? AND active = 1 ${retFilter}
            GROUP BY month_key
        `, retParams);


        // --- FINANCIAL CALCULATIONS & ORDERING ---

        // 1. ENTRADAS (Moved to top)
        const entradasVirtual = createVirtualRoot('entradas_root', 'ENTRADAS', entradasRoots);

        // 2. PRODUÇÃO / REVENDA
        const producaoVirtual = createVirtualRoot('producao_root', 'PRODUÇÃO / REVENDA', producaoRoots);

        // 3. LUCRO BRUTO (Entradas - Produção)
        const lucroBrutoVirtual = {
            id: 'lucro_bruto_root',
            name: '= LUCRO BRUTO',
            children: [],
            monthlyTotals: {},
            total: 0,
            isTotal: true
        };

        for (const [month, value] of Object.entries(entradasVirtual.monthlyTotals)) {
            lucroBrutoVirtual.monthlyTotals[month] = value;
        }
        lucroBrutoVirtual.total = entradasVirtual.total;

        for (const [month, value] of Object.entries(producaoVirtual.monthlyTotals)) {
            lucroBrutoVirtual.monthlyTotals[month] = (lucroBrutoVirtual.monthlyTotals[month] || 0) - value;
        }
        lucroBrutoVirtual.total -= producaoVirtual.total;

        // 4. MARGEM BRUTA% (Lucro Bruto / Entradas)
        const margemBrutaVirtual = {
            id: 'margem_bruta_root',
            name: '% MARGEM BRUTA',
            children: [],
            monthlyTotals: {},
            total: 0,
            isPercentage: true,
            isTotal: false // Styled differently
        };

        // Calculate monthly margins
        for (const [month, lucro] of Object.entries(lucroBrutoVirtual.monthlyTotals)) {
            const entrada = entradasVirtual.monthlyTotals[month] || 0;
            if (Math.abs(entrada) > 0.01) {
                margemBrutaVirtual.monthlyTotals[month] = (lucro / entrada);
            } else {
                margemBrutaVirtual.monthlyTotals[month] = 0;
            }
        }
        // Calculate total margin
        if (Math.abs(entradasVirtual.total) > 0.01) {
            margemBrutaVirtual.total = (lucroBrutoVirtual.total / entradasVirtual.total);
        }

        // 5. SAÍDAS (Despesas Operacionais)
        const saidasVirtual = createVirtualRoot('saidas_root', 'SAÍDAS OPERACIONAIS', saidasRoots);

        // 6. RESULTADO OPERACIONAL (Lucro Bruto - Saídas)
        const resultadoOperacionalVirtual = {
            id: 'resultado_operacional_root',
            name: '= RESULTADO OPERACIONAL',
            children: [],
            monthlyTotals: {},
            total: 0,
            isTotal: true
        };

        for (const [month, value] of Object.entries(lucroBrutoVirtual.monthlyTotals)) {
            resultadoOperacionalVirtual.monthlyTotals[month] = value;
        }
        resultadoOperacionalVirtual.total = lucroBrutoVirtual.total;

        for (const [month, value] of Object.entries(saidasVirtual.monthlyTotals)) {
            resultadoOperacionalVirtual.monthlyTotals[month] = (resultadoOperacionalVirtual.monthlyTotals[month] || 0) - value;
        }
        resultadoOperacionalVirtual.total -= saidasVirtual.total;


        // 7. MARGEM OPERACIONAL% (Resultado Operacional / Entradas)
        const margemOperacionalVirtual = {
            id: 'margem_operacional_root',
            name: '% MARGEM OPERACIONAL',
            children: [],
            monthlyTotals: {},
            total: 0,
            isPercentage: true,
            isTotal: false
        };

        for (const [month, resOp] of Object.entries(resultadoOperacionalVirtual.monthlyTotals)) {
            const entrada = entradasVirtual.monthlyTotals[month] || 0;
            if (Math.abs(entrada) > 0.01) {
                margemOperacionalVirtual.monthlyTotals[month] = (resOp / entrada);
            } else {
                margemOperacionalVirtual.monthlyTotals[month] = 0;
            }
        }
        if (Math.abs(entradasVirtual.total) > 0.01) {
            margemOperacionalVirtual.total = (resultadoOperacionalVirtual.total / entradasVirtual.total);
        }


        // 8. APORTES (formatted as row)
        const aportesVirtual = {
            id: 'aportes_root',
            name: '+ APORTES',
            children: [],
            monthlyTotals: {},
            total: 0,
            isPositive: true
        };

        aportesData.forEach(row => {
            const val = parseFloat(row.total) || 0;
            aportesVirtual.monthlyTotals[row.month_key] = val;
            aportesVirtual.total += val;
        });

        // 9. RETIRADAS (formatted as row)
        const retiradasVirtual = {
            id: 'retiradas_root',
            name: '- RETIRADAS',
            children: [],
            monthlyTotals: {},
            total: 0,
            isNegative: true
        };

        retiradasData.forEach(row => {
            const val = parseFloat(row.total) || 0;
            retiradasVirtual.monthlyTotals[row.month_key] = val;
            retiradasVirtual.total += val;
        });

        // 10. FLUXO FINANCEIRO MENSAL (Resultado Operacional + Aportes - Retiradas)
        const fluxoFinanceiroVirtual = {
            id: 'fluxo_financeiro_root',
            name: '= FLUXO FINANCEIRO MENSAL',
            children: [],
            monthlyTotals: {},
            total: 0,
            isTotal: true,
            isFinal: true
        };

        // Start with Resultado Operacional
        for (const [month, value] of Object.entries(resultadoOperacionalVirtual.monthlyTotals)) {
            fluxoFinanceiroVirtual.monthlyTotals[month] = value;
        }
        fluxoFinanceiroVirtual.total = resultadoOperacionalVirtual.total;

        // Add Aportes
        for (const [month, value] of Object.entries(aportesVirtual.monthlyTotals)) {
            fluxoFinanceiroVirtual.monthlyTotals[month] = (fluxoFinanceiroVirtual.monthlyTotals[month] || 0) + value;
        }
        fluxoFinanceiroVirtual.total += aportesVirtual.total;

        // Subtract Retiradas
        for (const [month, value] of Object.entries(retiradasVirtual.monthlyTotals)) {
            fluxoFinanceiroVirtual.monthlyTotals[month] = (fluxoFinanceiroVirtual.monthlyTotals[month] || 0) - value;
        }
        fluxoFinanceiroVirtual.total -= retiradasVirtual.total;


        // Return combined list in CORRECT REORDERED FORMAT
        res.json([
            entradasVirtual,
            producaoVirtual,
            lucroBrutoVirtual,
            margemBrutaVirtual,
            saidasVirtual,
            resultadoOperacionalVirtual,
            margemOperacionalVirtual,
            aportesVirtual,
            retiradasVirtual,
            fluxoFinanceiroVirtual
        ]);

    } catch (error) {
        console.error('Error in getConsolidatedData:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};
