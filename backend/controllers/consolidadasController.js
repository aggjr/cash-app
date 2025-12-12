const db = require('../config/database');

exports.getConsolidatedData = async (req, res) => {
    try {
        const { projectId, viewType, startMonth, endMonth } = req.query; // startMonth/endMonth format: YYYY-MM

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        // 1. Determine Date Field based on View Type
        const dateField = viewType === 'caixa' ? 'data_real_pagamento' : 'data_fato';

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
        if (viewType === 'caixa') {
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
            if (viewType === 'caixa') {
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
        // For caixa: saidas/producao use data_real_pagamento, entradas use data_real_recebimento
        const saidasDateField = viewType === 'caixa' ? 'data_real_pagamento' : 'data_fato';
        const entradasDateField = viewType === 'caixa' ? 'data_real_recebimento' : 'data_fato';

        const saidasRoots = await buildTreeForTable('tipo_saida', 'saidas', 'tipo_saida_id', saidasDateField);
        const producaoRoots = await buildTreeForTable('tipo_producao_revenda', 'producao_revenda', 'tipo_id', 'data_fato');
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

        // 1. SAÍDAS
        const saidasVirtual = createVirtualRoot('saidas_root', 'SAÍDAS', saidasRoots);

        // 2. PRODUÇÃO / REVENDA
        const producaoVirtual = createVirtualRoot('producao_root', 'PRODUÇÃO / REVENDA', producaoRoots);

        // 3. TOTAL SAÍDAS DE CAIXA (Calculated)
        const totalSaidasVirtual = {
            id: 'total_saidas_root',
            name: 'TOTAL SAÍDAS DE CAIXA',
            children: [], // Leaf node, essentially
            monthlyTotals: {},
            total: 0,
            isTotal: true // Flag for frontend styling
        };

        // Sum Saidas + Producao
        [saidasVirtual, producaoVirtual].forEach(v => {
            for (const [month, value] of Object.entries(v.monthlyTotals)) {
                totalSaidasVirtual.monthlyTotals[month] = (totalSaidasVirtual.monthlyTotals[month] || 0) + value;
            }
            totalSaidasVirtual.total += v.total;
        });


        // 4. ENTRADAS
        const entradasVirtual = createVirtualRoot('entradas_root', 'ENTRADAS', entradasRoots);

        // 5. FETCH APORTES (Non-operational contributions)
        const aportesDateField = viewType === 'caixa' ? 'data_real' : 'data_fato';
        let aportesFilter = '';
        const aportesParams = [projectId];

        if (startMonth) {
            aportesFilter += ` AND DATE_FORMAT(${aportesDateField}, '%Y-%m') >= ?`;
            aportesParams.push(startMonth);
        }
        if (endMonth) {
            aportesFilter += ` AND DATE_FORMAT(${aportesDateField}, '%Y-%m') <= ?`;
            aportesParams.push(endMonth);
        }
        if (viewType === 'caixa') {
            aportesFilter += ` AND ${aportesDateField} IS NOT NULL`;
        }

        const [aportesData] = await db.execute(`
            SELECT 
                DATE_FORMAT(${aportesDateField}, '%Y-%m') AS month_key,
                SUM(valor) AS total
            FROM aportes
            WHERE project_id = ? AND active = 1 ${aportesFilter}
           GROUP BY month_key
        `, aportesParams);

        // 6. FETCH RETIRADAS (Non-operational withdrawals)
        const retiradasDateField = viewType === 'caixa' ? 'data_real' : 'data_fato';
        let retiradasFilter = '';
        const retiradasParams = [projectId];

        if (startMonth) {
            retiradasFilter += ` AND DATE_FORMAT(${retiradasDateField}, '%Y-%m') >= ?`;
            retiradasParams.push(startMonth);
        }
        if (endMonth) {
            retiradasFilter += ` AND DATE_FORMAT(${retiradasDateField}, '%Y-%m') <= ?`;
            retiradasParams.push(endMonth);
        }
        if (viewType === 'caixa') {
            retiradasFilter += ` AND ${retiradasDateField} IS NOT NULL`;
        }

        const [retiradasData] = await db.execute(`
            SELECT 
                DATE_FORMAT(${retiradasDateField}, '%Y-%m') AS month_key,
                SUM(valor) AS total
            FROM retiradas
            WHERE project_id = ? AND active = 1 ${retiradasFilter}
            GROUP BY month_key
        `, retiradasParams);

        // 7. RESULTADO OPERACIONAL (Entradas - Total Saídas)
        const resultadoOperacionalVirtual = {
            id: 'resultado_operacional_root',
            name: 'RESULTADO OPERACIONAL',
            children: [],
            monthlyTotals: {},
            total: 0,
            isTotal: true
        };

        // Calculate: Entradas - Total Saídas
        for (const [month, value] of Object.entries(entradasVirtual.monthlyTotals)) {
            resultadoOperacionalVirtual.monthlyTotals[month] = value;
        }
        resultadoOperacionalVirtual.total = entradasVirtual.total;

        for (const [month, value] of Object.entries(totalSaidasVirtual.monthlyTotals)) {
            resultadoOperacionalVirtual.monthlyTotals[month] = (resultadoOperacionalVirtual.monthlyTotals[month] || 0) - value;
        }
        resultadoOperacionalVirtual.total -= totalSaidasVirtual.total;

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

        // 10. RESULTADO FINAL (Resultado Operacional + Aportes - Retiradas)
        const resultadoFinalVirtual = {
            id: 'resultado_final_root',
            name: '= RESULTADO FINAL',
            children: [],
            monthlyTotals: {},
            total: 0,
            isTotal: true,
            isFinal: true
        };

        // Start with Resultado Operacional
        for (const [month, value] of Object.entries(resultadoOperacionalVirtual.monthlyTotals)) {
            resultadoFinalVirtual.monthlyTotals[month] = value;
        }
        resultadoFinalVirtual.total = resultadoOperacionalVirtual.total;

        // Add Aportes
        for (const [month, value] of Object.entries(aportesVirtual.monthlyTotals)) {
            resultadoFinalVirtual.monthlyTotals[month] = (resultadoFinalVirtual.monthlyTotals[month] || 0) + value;
        }
        resultadoFinalVirtual.total += aportesVirtual.total;

        // Subtract Retiradas
        for (const [month, value] of Object.entries(retiradasVirtual.monthlyTotals)) {
            resultadoFinalVirtual.monthlyTotals[month] = (resultadoFinalVirtual.monthlyTotals[month] || 0) - value;
        }
        resultadoFinalVirtual.total -= retiradasVirtual.total;


        // Return combined list in order
        res.json([
            saidasVirtual,
            producaoVirtual,
            totalSaidasVirtual,
            entradasVirtual,
            resultadoOperacionalVirtual,
            aportesVirtual,
            retiradasVirtual,
            resultadoFinalVirtual
        ]);

    } catch (error) {
        console.error('Error in getConsolidatedData:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};
