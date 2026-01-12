const db = require('../config/database');

exports.getFechamentoReport = async (req, res) => {
    try {
        const { projectId, startMonth, endMonth, viewMode } = req.query;

        if (!projectId || !startMonth || !endMonth) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        let startDate, endDate;

        if (viewMode === 'daily') {
            // Expecting YYYY-MM-DD
            startDate = startMonth;
            endDate = endMonth;
        } else {
            // Expecting YYYY-MM
            startDate = `${startMonth}-01`;
            const [endYear, endM] = endMonth.split('-');
            const lastDay = new Date(endYear, endM, 0).getDate();
            endDate = `${endMonth}-${lastDay}`;
        }

        // --- 1. PRE-PERIOD BALANCE (Historic) ---
        // Sum of all (In - Out) before startDate
        // Inputs: Entradas, Aportes
        // Outputs: Saidas, Producao, Retiradas

        const sqlBalance = `
            SELECT 
                account_id,
                SUM(val) as balance
            FROM (
                -- Inputs (Positive)
                SELECT account_id, valor AS val FROM entradas 
                WHERE project_id = ? AND data_real_recebimento < ? AND active = 1 AND data_real_recebimento IS NOT NULL
                UNION ALL
                SELECT account_id, valor AS val FROM aportes 
                WHERE project_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL
                
                UNION ALL
                
                -- Outputs (Negative)
                SELECT account_id, -valor AS val FROM saidas 
                WHERE project_id = ? AND data_real_pagamento < ? AND active = 1 AND data_real_pagamento IS NOT NULL
                UNION ALL
                SELECT account_id, -valor AS val FROM producao_revenda 
                WHERE project_id = ? AND data_real_pagamento < ? AND active = 1 AND data_real_pagamento IS NOT NULL
                UNION ALL
                SELECT account_id, -valor AS val FROM retiradas 
                WHERE project_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL
                
                UNION ALL
                
                -- Transferencias (Source = Out, Dest = In)
                SELECT source_account_id AS account_id, -valor AS val FROM transferencias 
                WHERE project_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL
                UNION ALL
                SELECT destination_account_id AS account_id, valor AS val FROM transferencias 
                WHERE project_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL

            ) as historic
            GROUP BY account_id
        `;

        // Params for Balance Query: 7 pairs of (projectId, startDate)
        const balanceParams = [
            projectId, startDate,
            projectId, startDate,
            projectId, startDate,
            projectId, startDate,
            projectId, startDate,
            projectId, startDate,
            projectId, startDate
        ];

        const [initialBalances] = await db.query(sqlBalance, balanceParams);

        // Quick lookup map for Initial Balances
        const balanceMap = {};
        initialBalances.forEach(row => {
            balanceMap[row.account_id] = parseFloat(row.balance || 0);
        });


        // --- 2. PERIOD MOVEMENTS (Monthly Deltas) ---
        // Sum of (In - Out) between startDate and endDate, grouped by Month

            ) as period_movements
            GROUP BY account_id, month_key
            `;

        // DYNAMIC GROUPING BASED ON MODE
        const viewMode = req.query.viewMode || 'monthly';
        const dateFormat = viewMode === 'daily' ? '%Y-%m-%d' : '%Y-%m';

        const sqlPeriod = `
        SELECT
        account_id,
            DATE_FORMAT(dt, '${dateFormat}') as month_key,
            SUM(val) as monthly_delta
        FROM(
            --Inputs
                SELECT account_id, data_real_recebimento as dt, valor AS val FROM entradas 
                WHERE project_id = ? AND data_real_recebimento BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT account_id, data_real as dt, valor AS val FROM aportes 
                WHERE project_id = ? AND data_real BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT destination_account_id AS account_id, data_real as dt, valor AS val FROM transferencias 
                WHERE project_id = ? AND data_real BETWEEN ? AND ? AND active = 1
                
                UNION ALL
                
                --Outputs
                SELECT account_id, data_real_pagamento as dt, -valor AS val FROM saidas 
                WHERE project_id = ? AND data_real_pagamento BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT account_id, data_real_pagamento as dt, -valor AS val FROM producao_revenda 
                WHERE project_id = ? AND data_real_pagamento BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT account_id, data_real as dt, -valor AS val FROM retiradas 
                WHERE project_id = ? AND data_real BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT source_account_id AS account_id, data_real as dt, -valor AS val FROM transferencias 
                WHERE project_id = ? AND data_real BETWEEN ? AND ? AND active = 1

        ) as period_movements
            GROUP BY account_id, month_key
            `;

        const periodParams = [
            projectId, startDate, endDate,
            projectId, startDate, endDate,
            projectId, startDate, endDate,
            projectId, startDate, endDate,
            projectId, startDate, endDate,
            projectId, startDate, endDate,
            projectId, startDate, endDate
        ];

        const [movements] = await db.query(sqlPeriod, periodParams);

        // Process into a structured format: { accountId: { monthKey: delta } }
        const movementsMap = {};
        movements.forEach(row => {
            if (!movementsMap[row.account_id]) movementsMap[row.account_id] = {};
            movementsMap[row.account_id][row.month_key] = parseFloat(row.monthly_delta || 0);
        });

        // --- 3. FETCH ACCOUNTS WITH COMPANY INFO ---
        let accountsQuery = `
        SELECT
        c.id as account_id,
            c.name as account_name,
            c.company_id,
            e.name as company_name
            FROM contas c
            INNER JOIN empresas e ON c.company_id = e.id
            WHERE c.project_id = ? AND c.active = 1
            `;

        const accountsParams = [projectId];

        // Apply account filter if provided
        if (req.query.accountIds) {
            const accountIds = Array.isArray(req.query.accountIds)
                ? req.query.accountIds
                : [req.query.accountIds];

            if (accountIds.length > 0) {
                accountsQuery += ` AND c.id IN(${ accountIds.map(() => '?').join(',') })`;
                accountsParams.push(...accountIds);
            }
        }

        accountsQuery += ` ORDER BY e.name, c.name`;

        const [accounts] = await db.query(accountsQuery, accountsParams);

        // Group accounts by company
        const companiesMap = {};
        accounts.forEach(acc => {
            if (!companiesMap[acc.company_id]) {
                companiesMap[acc.company_id] = {
                    company_id: acc.company_id,
                    company_name: acc.company_name,
                    accounts: []
                };
            }
            companiesMap[acc.company_id].accounts.push({
                account_id: acc.account_id,
                account_name: acc.account_name
            });
        });

        const companies = Object.values(companiesMap);

        res.json({
            initialBalances: balanceMap,
            movements: movementsMap,
            companies: companies
        });

    } catch (error) {
        console.error('Error fetching fechamento report:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
