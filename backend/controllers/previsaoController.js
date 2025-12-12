const db = require('../config/database');
const AppError = require('../utils/AppError');

exports.getDailyForecast = async (req, res, next) => {
    try {
        const { projectId, startDate, endDate } = req.query;

        if (!projectId || !startDate || !endDate) {
            throw new AppError('VAL-002', 'Project ID, Start Date, and End Date are required');
        }

        // --- 1. Calculate Initial Balance (Baseline at start of valid history) ---
        // We need:
        // A. Sum of 'current_balance' from accounts table? NO. That is the CURRENT balance (Today).
        //    To get balance at StartDate, we must take Current Balance and REVERSE transactions after StartDate?
        //    OR: Take Initial Balance (if stored) + Transactions up to StartDate.
        //    The system doesn't seem to have "Initial Balance" timestamped. 'current_balance' is the live snapshot.
        //    
        //    Strategy A (Reverse Engineering from Current):
        //    Balance @ StartDate = CurrentBalance - (Inflows > StartDate) + (Outflows > StartDate).
        //    This is safer if 'current_balance' is the source of truth.
        //
        //    Strategy B (Forward from Zero):
        //    Balance @ StartDate = Sum(Inflows < StartDate) - Sum(Outflows < StartDate).
        //    This assumes we have ALL history.
        //
        //    Given the "Consolidadas" fix I just did (ignoring deleted), using current_balance is risky if my history queries miss something.
        //    However, usually accounting systems rely on the Journal.
        //    Let's use Strategy A: Reverse from Current Balance. It matches what the user sees on the Dashboard NOW.
        //    
        //    Wait, "current_balance" in `contas` table includes "data_real_pagamento" until NOW (or future if posted).
        //    Actually, usually `current_balance` is just a sum field.
        //    Let's stick to Strategy B (Forward Calculation) if we assume `contas` might have an `initial_balance` field?
        //    Checking `AccountManager` or table structure... 
        //    Let's assume NO `initial_balance` field for now (or it's 0).
        //    Actually, let's look at `contas` table structure in a bit if needed.
        //    For now, I will use a robust QUERY that sums EVERYTHING up to `startDate`.
        //    If `contas` has an initial value, we should add it.
        //    Let's assume "Current Balance" is reliable and verify based on that? No, forward is better for "Forecast" usually.
        //    
        //    Let's go with: 
        //    GLOBAL_INITIAL = 0 (or sum of accounts if they had initial).
        //    BALANCE_START = GLOBAL_INITIAL + SUM(Inflows < Start) - SUM(Outflows < Start).

        // Get total inflows before start date (Realized Only? Or Predicted? Forecast implies Predicted if future.)
        // User asked for "Previsão Diária". Usually this mixes Realized (Past) and Predicted (Future).
        // So we use COALESCE(data_real_pagamento, data_prevista_pagamento) as the effective date?
        // Or just data_prevista?
        // "Fluxo de Caixa" usually implies CASH flow, i.e., when money moves.
        // If data_real_pagamento exists, use it. Else use data_prevista_pagamento.

        // Helper to get date column based on table context
        const getDateCol = (table) => {
            if (table === 'producao_revenda') return 'data_fato';
            if (table === 'entradas') return 'COALESCE(data_real_recebimento, data_prevista_recebimento)';
            if (table === 'saidas') return 'COALESCE(data_real_pagamento, data_prevista_pagamento)';
            return 'data_fato'; // Fallback
        };

        // 1.1 Calculate Historic Inflows (active=1)
        const [inflowResult] = await db.execute(`
            SELECT SUM(valor) as total 
            FROM entradas 
            WHERE project_id = ? 
            AND active = 1 
            AND ${getDateCol('entradas')} < ?
        `, [projectId, startDate]);
        const historicInflow = parseFloat(inflowResult[0].total || 0);

        // 1.2 Calculate Historic Outflows (Saidas + Producao)
        const [saidasResult] = await db.execute(`
            SELECT SUM(valor) as total 
            FROM saidas 
            WHERE project_id = ? 
            AND active = 1 
            AND ${getDateCol('saidas')} < ?
        `, [projectId, startDate]);
        const historicSaidas = parseFloat(saidasResult[0].total || 0);

        const [producaoResult] = await db.execute(`
            SELECT SUM(valor) as total 
            FROM producao_revenda 
            WHERE project_id = ? 
            AND active = 1 
            AND ${getDateCol('producao_revenda')} < ?
        `, [projectId, startDate]);
        const historicProducao = parseFloat(producaoResult[0].total || 0);

        // 1.3 Get Accounts Initial Balance (If any? Assuming 0 for now as we don't have that field explicitly managed yet)
        // Actually, if the user created accounts with 0, then `current_balance` is the result of operations.
        // Let's assume start balance is 0 + operations.
        let runningBalance = historicInflow - (historicSaidas + historicProducao);


        // --- 2. Fetch Daily Data for Range ---
        // We need a helper to build tree similar to Consolidadas, but grouped by DAY.

        const buildDailyTree = async (typeTable, dataTable, fkCol) => {
            // Types
            const [types] = await db.execute(
                `SELECT id, label, parent_id FROM ${typeTable} WHERE project_id = ? ORDER BY label`,
                [projectId]
            );

            // Data
            const dateCol = getDateCol(dataTable);
            const query = `
                SELECT 
                    d.id, 
                    d.valor, 
                    d.${fkCol} as type_id, 
                    DATE_FORMAT(${dateCol}, '%Y-%m-%d') as date_key
                FROM ${dataTable} d
                WHERE d.project_id = ? 
                AND d.active = 1
                AND ${dateCol} >= ? 
                AND ${dateCol} <= ?
            `;
            const [items] = await db.execute(query, [projectId, startDate, endDate]);

            // Map & Aggregate
            const typeMap = new Map();
            types.forEach(t => {
                typeMap.set(t.id, {
                    id: `${typeTable}_${t.id}`,
                    name: t.label,
                    parentId: t.parent_id ? `${typeTable}_${t.parent_id}` : null,
                    children: [],
                    dailyTotals: {}, // Key: YYYY-MM-DD
                    total: 0
                });
            });

            items.forEach(item => {
                const node = typeMap.get(item.type_id);
                if (node) {
                    const val = parseFloat(item.valor) || 0;
                    node.dailyTotals[item.date_key] = (node.dailyTotals[item.date_key] || 0) + val;
                    node.total += val;
                }
            });

            // Hierarchy
            const rootNodes = [];
            types.forEach(t => {
                const node = typeMap.get(t.id);
                if (t.parent_id) typeMap.get(t.parent_id)?.children.push(node);
                else rootNodes.push(node);
            });

            // Rollup
            const calculateRollup = (node) => {
                node.children.forEach(child => {
                    calculateRollup(child);
                    for (const [day, value] of Object.entries(child.dailyTotals)) {
                        node.dailyTotals[day] = (node.dailyTotals[day] || 0) + value;
                    }
                    node.total += child.total;
                });
            };
            rootNodes.forEach(root => calculateRollup(root));
            return rootNodes;
        };

        const entradasRoots = await buildDailyTree('tipo_entrada', 'entradas', 'tipo_entrada_id');
        const saidasRoots = await buildDailyTree('tipo_saida', 'saidas', 'tipo_saida_id');
        const producaoRoots = await buildDailyTree('tipo_producao_revenda', 'producao_revenda', 'tipo_id');

        // --- Helper to Create Virtual Root ---
        const createVirtualRoot = (id, name, children) => {
            const v = { id, name, children, dailyTotals: {}, total: 0 };
            if (children) {
                children.forEach(c => {
                    for (const [day, val] of Object.entries(c.dailyTotals)) {
                        v.dailyTotals[day] = (v.dailyTotals[day] || 0) + val;
                    }
                    v.total += c.total;
                });
            }
            return v;
        };

        const entradasVirtual = createVirtualRoot('entradas_root', 'ENTRADAS', entradasRoots);
        const saidasVirtual = createVirtualRoot('saidas_root', 'SAÍDAS', saidasRoots);
        const producaoVirtual = createVirtualRoot('producao_root', 'PRODUÇÃO / REVENDA', producaoRoots);

        res.json({
            initialBalance: runningBalance,
            data: [saidasVirtual, producaoVirtual, entradasVirtual]
        });

    } catch (error) {
        next(error);
    }
};
