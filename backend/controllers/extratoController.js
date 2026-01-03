const db = require('../config/database');

exports.getExtrato = async (req, res) => {
    try {
        const { projectId, accountId, startDate, endDate } = req.query;

        if (!projectId || !accountId || !startDate || !endDate) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // --- 1. INITIAL BALANCE (Before Start Date) ---
        const sqlInitial = `
            SELECT SUM(val) as balance FROM (
                -- Inputs (+)
                SELECT valor AS val FROM entradas 
                WHERE project_id = ? AND account_id = ? AND data_real_recebimento < ? AND active = 1 AND data_real_recebimento IS NOT NULL
                UNION ALL
                SELECT valor AS val FROM aportes 
                WHERE project_id = ? AND account_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL
                UNION ALL
                SELECT valor AS val FROM transferencias 
                WHERE project_id = ? AND destination_account_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL
                
                UNION ALL
                
                -- Outputs (-)
                SELECT -valor AS val FROM saidas 
                WHERE project_id = ? AND account_id = ? AND data_real_pagamento < ? AND active = 1 AND data_real_pagamento IS NOT NULL
                UNION ALL
                SELECT -valor AS val FROM producao_revenda 
                WHERE project_id = ? AND account_id = ? AND data_fato < ? AND active = 1 AND data_fato IS NOT NULL
                UNION ALL
                SELECT -valor AS val FROM retiradas 
                WHERE project_id = ? AND account_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL
                UNION ALL
                SELECT -valor AS val FROM transferencias 
                WHERE project_id = ? AND source_account_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL

            ) as initial_calc
        `;

        const initialParams = [
            projectId, accountId, startDate,
            projectId, accountId, startDate,
            projectId, accountId, startDate, // Transf IN

            projectId, accountId, startDate,
            projectId, accountId, startDate,
            projectId, accountId, startDate,
            projectId, accountId, startDate  // Transf OUT
        ];

        const [initialResult] = await db.query(sqlInitial, initialParams);
        const initialBalance = parseFloat(initialResult[0].balance || 0);

        // --- 2. TRANSACTIONS (Within Range) ---
        // Correct Schema: 
        // - tipo_entrada (id, label, parent_id)
        // - tipo_saida (id, label, parent_id)
        // - tipo_producao_revenda (id, label, parent_id)

        const sqlTransactions = `
            SELECT * FROM (
                -- ENTRADAS
                SELECT 
                    e.data_real_recebimento AS data,
                    CONCAT('ENTRADA', 
                        CASE WHEN tp.id IS NOT NULL THEN CONCAT(' / ', tp.label) ELSE '' END,
                        CASE WHEN tc.id IS NOT NULL THEN CONCAT(' / ', tc.label) ELSE '' END
                    ) AS tipo_formatado,
                    'ENTRADA' as tipo_base,
                    e.descricao,
                    e.valor,
                    'IN' as direction
                FROM entradas e
                LEFT JOIN tipo_entrada tc ON e.tipo_entrada_id = tc.id
                LEFT JOIN tipo_entrada tp ON tc.parent_id = tp.id
                WHERE e.project_id = ? AND e.account_id = ? AND e.data_real_recebimento BETWEEN ? AND ? AND e.active = 1

                UNION ALL

                -- APORTES
                SELECT 
                    data_real AS data,
                    'APORTE' AS tipo_formatado,
                    'APORTE' as tipo_base,
                    descricao,
                    valor,
                    'IN' as direction
                FROM aportes 
                WHERE project_id = ? AND account_id = ? AND data_real BETWEEN ? AND ? AND active = 1

                UNION ALL

                -- TRANSFERÊNCIAS (ENTRADA)
                SELECT 
                    t.data_real AS data,
                    'TRANSFERÊNCIA (ENTRADA)' AS tipo_formatado,
                    'TRANSFERÊNCIA' as tipo_base,
                    t.descricao,
                    t.valor,
                    'IN' as direction
                FROM transferencias t
                WHERE t.project_id = ? AND t.destination_account_id = ? AND t.data_real BETWEEN ? AND ? AND t.active = 1

                UNION ALL
                
                -- SAÍDAS
                SELECT 
                    d.data_real_pagamento AS data,
                    CONCAT('SAÍDA', 
                        CASE WHEN tp.id IS NOT NULL THEN CONCAT(' / ', tp.label) ELSE '' END,
                        CASE WHEN tc.id IS NOT NULL THEN CONCAT(' / ', tc.label) ELSE '' END
                    ) AS tipo_formatado,
                    'SAÍDA' as tipo_base,
                    d.descricao,
                    d.valor,
                    'OUT' as direction
                FROM saidas d
                LEFT JOIN tipo_saida tc ON d.tipo_saida_id = tc.id
                LEFT JOIN tipo_saida tp ON tc.parent_id = tp.id
                WHERE d.project_id = ? AND d.account_id = ? AND d.data_real_pagamento BETWEEN ? AND ? AND d.active = 1
                
                UNION ALL
                
                -- PRODUÇÃO/REVENDA
                SELECT 
                    p.data_fato AS data,
                    CONCAT('PRODUÇÃO', 
                        CASE WHEN tp.id IS NOT NULL THEN CONCAT(' / ', tp.label) ELSE '' END,
                        CASE WHEN tc.id IS NOT NULL THEN CONCAT(' / ', tc.label) ELSE '' END
                    ) AS tipo_formatado,
                    'PRODUÇÃO' as tipo_base,
                    p.descricao,
                    p.valor,
                    'OUT' as direction
                FROM producao_revenda p
                LEFT JOIN tipo_producao_revenda tc ON p.tipo_id = tc.id
                LEFT JOIN tipo_producao_revenda tp ON tc.parent_id = tp.id
                WHERE p.project_id = ? AND p.account_id = ? AND p.data_fato BETWEEN ? AND ? AND p.active = 1
                
                UNION ALL
                
                -- RETIRADAS
                SELECT 
                    data_real AS data,
                    'RETIRADA' AS tipo_formatado,
                    'RETIRADA' as tipo_base,
                    descricao,
                    valor,
                    'OUT' as direction
                FROM retiradas 
                WHERE project_id = ? AND account_id = ? AND data_real BETWEEN ? AND ? AND active = 1

                UNION ALL

                -- TRANSFERÊNCIAS (SAÍDA)
                SELECT 
                    t.data_real AS data,
                    'TRANSFERÊNCIA (SAÍDA)' AS tipo_formatado,
                    'TRANSFERÊNCIA' as tipo_base,
                    t.descricao,
                    t.valor,
                    'OUT' as direction
                FROM transferencias t
                WHERE t.project_id = ? AND t.source_account_id = ? AND t.data_real BETWEEN ? AND ? AND t.active = 1

            ) AS unified_transactions
            ORDER BY data ASC, tipo_base ASC
        `;

        const transParams = [
            projectId, accountId, startDate, endDate, // Entrada
            projectId, accountId, startDate, endDate, // Aporte
            projectId, accountId, startDate, endDate, // Transf IN
            projectId, accountId, startDate, endDate, // Saida
            projectId, accountId, startDate, endDate, // Producao
            projectId, accountId, startDate, endDate, // Retirada
            projectId, accountId, startDate, endDate  // Transf OUT
        ];

        const [transactions] = await db.query(sqlTransactions, transParams);

        res.json({
            initialBalance,
            transactions
        });

    } catch (error) {
        console.error('Error fetching extrato:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

