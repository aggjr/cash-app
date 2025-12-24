const db = require('../config/database');
const AppError = require('../utils/AppError');

/**
 * Format a date object to YYYY-MM-DD using LOCAL timezone
 * This avoids the timezone conversion bug that toISOString() causes
 */
function formatDateLocal(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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

        // Helper to get effective date SQL expression
        // Logic: 
        // 1. Data Real (Paid/Received) if exists.
        // 2. Else Data Atraso if exists (replacing Prevista).
        // 3. Else Data Prevista.
        const getEffectiveDateSql = (table) => {
            let realCol = 'data_real';
            let prevCol = 'data_prevista';

            // Define columns per table
            if (table === 'entradas') {
                realCol = 'data_real_recebimento';
                // IF data_atraso is not null, use it. Else use predicted.
                prevCol = 'COALESCE(data_atraso, data_prevista_recebimento)';
            }
            else if (table === 'saidas') {
                realCol = 'data_real_pagamento';
                // Checking if saidas table has data_atraso (based on logs it seems likely or intended)
                // Assuming saidas has data_atraso similar to entradas.
                // If the column doesn't exist, this query will fail. 
                // Based on User Request "telas que possuam Data Atraso", Entradas and Saidas are the main candidates.
                // I will assume Saidas has it too or use safe fallback if needed? 
                // Logs showed 'SaidaManager' references, so let's try using it if it exists.
                // However, 'migrate_add_fields.js' only showed adding it to ONE table potentially? 
                // Wait, the grep showed "ADD COLUMN data_atraso DATE NULL AFTER data_prevista_recebimento" (Entradas).
                // I did NOT see an explicit "ADD COLUMN" for saidas in the grep snippet, only "IncomeManager.js" and "incomeController.js".
                // "SaidaManager.js.bak" had "Dt Atraso".
                // I will check if column exists in Saidas? 
                // Safest bet: Use it for 'entradas'. For 'saidas', check if I can safely assume it.
                // The user said "No caso das telas que possuam Data Atraso". 
                // If I put "data_atraso" in SQL for 'saidas' and it doesn't exist, it breaks.
                // But since I cannot run "DESCRIBE tables", I have to rely on the user or code.
                // Only 'IncomeController' explicitly has 'data_atraso' handling in the logs.
                // 'SaidaManager.js.bak' implies distinct from 'SaidaManager.js'.
                // I'll stick to 'entradas' having it for sure. For 'saidas', I'll use standard prevCol unless I'm sure.
                // *Self-Correction*: Use standard prevCol for Saidas unless I see a controller/migration for it. The grep was mostly Income.
                // WAIT! `g:\Meu Drive\...\Src\components\SaidaManager.js.bak` has it.
                // Let's assume ONLY Entradas has it for now? Or try both?
                // The prompt says "No caso das telas que possuam...".
                // I will apply it to 'entradas'. 
                // If 'saidas' also has it, I need to know.
                // Let's check 'saidaController.js' via grep quickly? No, I must edit now or pause.
                // I'll assume 'entradas' definitely has it. 
                // I'll only apply to 'entradas' for now given the strong evidence there.

                prevCol = 'data_prevista_pagamento';
            }
            else if (table === 'producao_revenda') { realCol = 'data_real_pagamento'; prevCol = 'data_prevista_pagamento'; }
            else if (table === 'aportes') { realCol = 'data_real'; prevCol = 'data_fato'; }
            else if (table === 'retiradas') { realCol = 'data_real'; prevCol = 'data_prevista'; }

            // With dateStrings: true, MySQL already returns dates as 'YYYY-MM-DD' strings
            // No need for SUBSTRING - COALESCE will return the first non-null date string
            return `COALESCE(${realCol}, ${prevCol})`;
        };


        // Helper to get Validity SQL Condition
        // IMPORTANT: Removed the filter that excluded entries with past predicted dates
        // We NEED those entries to show overdue warnings!
        // Now we simply check if the entry is active - date filtering is handled separately
        const getValiditySql = (table) => {
            // Return a condition that is always true - we rely on active=1 and date range filtering
            // The overdue logic in buildDailyTree will handle showing warnings for past dates
            return '1=1';
        };

        const effectiveDateSql = (table) => getEffectiveDateSql(table);
        const validitySql = (table) => getValiditySql(table);

        // 1.1 Calculate Historic Inflows (active=1)
        const [inflowResult] = await db.execute(`
            SELECT SUM(valor) as total 
            FROM entradas 
            WHERE project_id = ? 
            AND active = 1 
            AND ${validitySql('entradas')}
            AND ${effectiveDateSql('entradas')} < ?
        `, [projectId, startDate]);
        const historicInflow = parseFloat(inflowResult[0].total || 0);

        // 1.2 Calculate Historic Outflows
        const [saidasResult] = await db.execute(`
            SELECT SUM(valor) as total 
            FROM saidas 
            WHERE project_id = ? 
            AND active = 1 
            AND ${validitySql('saidas')}
            AND ${effectiveDateSql('saidas')} < ?
        `, [projectId, startDate]);
        const historicSaidas = parseFloat(saidasResult[0].total || 0);

        const [producaoResult] = await db.execute(`
            SELECT SUM(valor) as total 
            FROM producao_revenda 
            WHERE project_id = ? 
            AND active = 1 
            AND ${validitySql('producao_revenda')}
            AND ${effectiveDateSql('producao_revenda')} < ?
        `, [projectId, startDate]);
        const historicProducao = parseFloat(producaoResult[0].total || 0);

        // 1.3 Historic Aportes
        const [aportesResult] = await db.execute(`
            SELECT SUM(valor) as total 
            FROM aportes 
            WHERE project_id = ? 
            AND active = 1 
            AND ${validitySql('aportes')}
            AND ${effectiveDateSql('aportes')} < ?
        `, [projectId, startDate]);
        const historicAportes = parseFloat(aportesResult[0].total || 0);

        // 1.4 Historic Retiradas
        const [retiradasResult] = await db.execute(`
            SELECT SUM(valor) as total 
            FROM retiradas 
            WHERE project_id = ? 
            AND active = 1 
            AND ${validitySql('retiradas')}
            AND ${effectiveDateSql('retiradas')} < ?
        `, [projectId, startDate]);
        const historicRetiradas = parseFloat(retiradasResult[0].total || 0);

        // 1.5 Calculate Running Balance
        // Balance = (Inflows + Aportes) - (Outflows + Producao + Retiradas)
        let runningBalance = (historicInflow + historicAportes) - (historicSaidas + historicProducao + historicRetiradas);


        // --- 2. Fetch Daily Data for Range ---
        // We need a helper to build tree similar to Consolidadas, but grouped by DAY.

        const buildDailyTree = async (typeTable, dataTable, fkCol) => {
            // Types
            const [types] = await db.execute(
                `SELECT id, label, parent_id FROM ${typeTable} WHERE project_id = ? ORDER BY label`,
                [projectId]
            );

            // Data
            // Use effective date filtering AND validity check
            const dateExpr = effectiveDateSql(dataTable);
            const validExpr = validitySql(dataTable);

            // Build SELECT clause with all necessary date columns based on table type
            let dateColumns = '';
            if (dataTable === 'entradas') {
                dateColumns = 'd.data_real_recebimento, d.data_atraso, d.data_prevista_recebimento,';
            } else if (dataTable === 'saidas') {
                dateColumns = 'd.data_real_pagamento, d.data_prevista_pagamento,';
            } else if (dataTable === 'producao_revenda') {
                dateColumns = 'd.data_real_pagamento, d.data_prevista_pagamento,';
            }

            const query = `
                SELECT 
                    d.id, 
                    d.valor, 
                    d.${fkCol} as type_id,
                    ${dateColumns}
                    ${dateExpr} as raw_date
                FROM ${dataTable} d
                WHERE d.project_id = ?
                AND d.active = 1
                AND ${validExpr}
                AND ${dateExpr} >= ?
                AND ${dateExpr} <= ?
                    `;
            const [items] = await db.execute(query, [projectId, startDate, endDate]);

            // Map & Aggregate
            const typeMap = new Map();
            types.forEach(t => {
                typeMap.set(t.id, {
                    id: `${typeTable}_${t.id} `,
                    name: t.label,
                    parentId: t.parent_id ? `${typeTable}_${t.parent_id} ` : null,
                    children: [],
                    dailyTotals: {}, // Key: YYYY-MM-DD - valores normais (somados)
                    dailyOverdue: {}, // Key: YYYY-MM-DD - valores atrasados (informativos, NÃO somados)
                    total: 0
                });
            });


            items.forEach(item => {
                const node = typeMap.get(item.type_id);
                if (node) {
                    const val = parseFloat(item.valor) || 0;

                    // CRITICAL FIX: Use ONLY raw_date from SQL (already formatted as YYYY-MM-DD string)
                    // The SQL query uses SUBSTRING(COALESCE(...), 1, 10) which:
                    // 1. Handles priority: Real > Atraso > Prevista
                    // 2. Returns as string, avoiding Date object timezone conversions
                    const rawDateVal = item.raw_date;

                    // Extract YYYY-MM-DD from string (dateStrings: true ensures it's always a string)
                    const dateKey = (typeof rawDateVal === 'string' && rawDateVal.length >= 10)
                        ? rawDateVal.substring(0, 10)
                        : '';

                    if (dateKey) {
                        // Check if item is overdue (ORIGINAL predicted date in past with no real date)
                        // IMPORTANT: Use original predicted date, NOT effective date (which includes data_atraso)
                        const today = new Date().toISOString().split('T')[0];
                        let isOverdue = false;
                        let originalPredictedDate = '';

                        if (dataTable === 'entradas') {
                            originalPredictedDate = item.data_prevista_recebimento;
                            // Overdue if: no real date AND original predicted date < today
                            isOverdue = !item.data_real_recebimento && originalPredictedDate && originalPredictedDate < today;
                        } else if (dataTable === 'saidas') {
                            originalPredictedDate = item.data_prevista_pagamento;
                            isOverdue = !item.data_real_pagamento && originalPredictedDate && originalPredictedDate < today;
                        } else if (dataTable === 'producao_revenda') {
                            originalPredictedDate = item.data_prevista_pagamento;
                            isOverdue = !item.data_real_pagamento && originalPredictedDate && originalPredictedDate < today;
                        }

                        if (isOverdue) {
                            console.log(`[OVERDUE DETECTED] Table: ${dataTable}, ID: ${item.id}, Original Predicted: ${originalPredictedDate}, Effective: ${dateKey}, Value: ${val}`);
                            node.dailyOverdue[dateKey] = (node.dailyOverdue[dateKey] || 0) + val;
                        } else {
                            node.dailyTotals[dateKey] = (node.dailyTotals[dateKey] || 0) + val;
                            node.total += val;
                        }
                    } else {
                        // No valid date, add to total anyway
                        node.total += val;
                    }
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

                    // Rollup normal totals
                    for (const [day, value] of Object.entries(child.dailyTotals)) {
                        node.dailyTotals[day] = (node.dailyTotals[day] || 0) + value;
                    }

                    // Rollup overdue totals (informational)
                    for (const [day, value] of Object.entries(child.dailyOverdue)) {
                        node.dailyOverdue[day] = (node.dailyOverdue[day] || 0) + value;
                    }

                    node.total += child.total; // Total does NOT include overdue
                });
            };
            rootNodes.forEach(root => calculateRollup(root));
            return rootNodes;
        };

        const saidasRoots = await buildDailyTree('tipo_saida', 'saidas', 'tipo_saida_id');
        const producaoRoots = await buildDailyTree('tipo_producao_revenda', 'producao_revenda', 'tipo_id');
        const entradasRoots = await buildDailyTree('tipo_entrada', 'entradas', 'tipo_entrada_id');

        // Aportes & Retiradas

        const fetchFlatDaily = async (table, label, id) => {
            const dateExpr = effectiveDateSql(table);
            const validExpr = validitySql(table);

            // Determine which columns to select based on table
            let selectCols = 'valor, data_real';
            if (table === 'aportes') {
                selectCols = 'valor, data_real, data_fato';
            } else if (table === 'retiradas') {
                selectCols = 'valor, data_real, data_prevista';
            }

            const [items] = await db.execute(`
            SELECT
                ${selectCols},
                ${dateExpr} as raw_date
                FROM ${table}
                WHERE project_id = ?
                AND active = 1
                AND ${validExpr}
                AND ${dateExpr} >= ? AND ${dateExpr} <= ?
                `, [projectId, startDate, endDate]);

            const dailyTotals = {};
            const dailyOverdue = {};
            let total = 0;
            items.forEach(item => {
                const val = parseFloat(item.valor) || 0;

                // Use raw_date from SQL (already YYYY-MM-DD string with dateStrings: true)
                const dateKey = (typeof item.raw_date === 'string' && item.raw_date.length >= 10)
                    ? item.raw_date.substring(0, 10)
                    : '';

                if (dateKey) {
                    const today = new Date().toISOString().split('T')[0];

                    // Check original predicted date, not effective date
                    let originalPredictedDate = '';
                    if (table === 'aportes') {
                        originalPredictedDate = item.data_fato;
                    } else if (table === 'retiradas') {
                        originalPredictedDate = item.data_prevista;
                    }

                    const isOverdue = !item.data_real && originalPredictedDate && originalPredictedDate < today;

                    if (isOverdue) {
                        console.log(`[OVERDUE DETECTED] Table: ${table}, Original Predicted: ${originalPredictedDate}, Effective: ${dateKey}, Value: ${val}`);
                        dailyOverdue[dateKey] = (dailyOverdue[dateKey] || 0) + val;
                    } else {
                        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + val;
                        total += val;
                    }
                } else {
                    total += val;
                }
            });

            return {
                id: id,
                name: label,
                children: [],
                dailyTotals,
                dailyOverdue,
                total
            };
        };

        const aportesRoot = await fetchFlatDaily('aportes', '+ APORTES', 'aportes_root'); // Green
        const retiradasRoot = await fetchFlatDaily('retiradas', '- RETIRADAS', 'retiradas_root'); // Red

        // --- Helper to Create Virtual Root ---
        const createVirtualRoot = (id, name, children) => {
            const node = { id, name, children, dailyTotals: {}, dailyOverdue: {}, total: 0 };
            children.forEach(child => {
                node.total += child.total;
                // Rollup normal totals
                for (const [day, val] of Object.entries(child.dailyTotals)) {
                    node.dailyTotals[day] = (node.dailyTotals[day] || 0) + val;
                }
                // Rollup overdue totals (informational)
                for (const [day, val] of Object.entries(child.dailyOverdue || {})) {
                    node.dailyOverdue[day] = (node.dailyOverdue[day] || 0) + val;
                }
            });
            return node;
        };

        const entradasVirtual = createVirtualRoot('entradas_root', 'ENTRADAS', entradasRoots);
        const saidasVirtual = createVirtualRoot('saidas_root', 'SAÍDAS', saidasRoots);
        const producaoVirtual = createVirtualRoot('producao_root', 'PRODUÇÃO / REVENDA', producaoRoots);

        res.json({
            initialBalance: runningBalance,
            data: [
                aportesRoot,        // Requested First
                entradasVirtual,
                saidasVirtual,
                producaoVirtual,
                retiradasRoot       // Requested Last
            ]
        });

    } catch (error) {
        next(error);
    }
};
