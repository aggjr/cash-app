const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function debugExtrato() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Test parameters - adjust these based on the screenshot
        const projectId = 1; // Adjust based on your project
        const accountId = 1; // Adjust based on your account
        const startDate = '2025-11-08'; // 08/11/2025
        const endDate = '2026-01-31'; // 31/01/2026

        console.log('=== TESTING EXTRATO QUERIES ===');
        console.log('Project ID:', projectId);
        console.log('Account ID:', accountId);
        console.log('Start Date:', startDate);
        console.log('End Date:', endDate);
        console.log('');

        // --- Test Initial Balance Query ---
        console.log('--- INITIAL BALANCE QUERY ---');
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
                -- Account Opening Balance
                SELECT initial_balance AS val FROM contas
                WHERE id = ? AND project_id = ?

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

            accountId, projectId, // Account Opening Balance

            projectId, accountId, startDate,
            projectId, accountId, startDate,
            projectId, accountId, startDate,
            projectId, accountId, startDate  // Transf OUT
        ];

        const [initialResult] = await connection.query(sqlInitial, initialParams);
        console.log('Initial Balance Result:', initialResult[0]);
        console.log('');

        // --- Test breakdown of initial balance ---
        console.log('--- INITIAL BALANCE BREAKDOWN ---');

        // Entradas before start date
        const [entradas] = await connection.query(
            'SELECT COUNT(*) as count, SUM(valor) as total FROM entradas WHERE project_id = ? AND account_id = ? AND data_real_recebimento < ? AND active = 1 AND data_real_recebimento IS NOT NULL',
            [projectId, accountId, startDate]
        );
        console.log('Entradas before start date:', entradas[0]);

        // Aportes before start date
        const [aportes] = await connection.query(
            'SELECT COUNT(*) as count, SUM(valor) as total FROM aportes WHERE project_id = ? AND account_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL',
            [projectId, accountId, startDate]
        );
        console.log('Aportes before start date:', aportes[0]);

        // Saidas before start date
        const [saidas] = await connection.query(
            'SELECT COUNT(*) as count, SUM(valor) as total FROM saidas WHERE project_id = ? AND account_id = ? AND data_real_pagamento < ? AND active = 1 AND data_real_pagamento IS NOT NULL',
            [projectId, accountId, startDate]
        );
        console.log('Saidas before start date:', saidas[0]);

        // Account opening balance
        const [conta] = await connection.query(
            'SELECT initial_balance FROM contas WHERE id = ? AND project_id = ?',
            [accountId, projectId]
        );
        console.log('Account opening balance:', conta[0]);
        console.log('');

        // --- Test Transactions Query ---
        console.log('--- TRANSACTIONS IN PERIOD ---');
        const sqlTransactions = `
            SELECT * FROM (
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

            ) AS unified_transactions
            ORDER BY data ASC, tipo_base ASC
        `;

        const transParams = [
            projectId, accountId, startDate, endDate, // Aporte
            projectId, accountId, startDate, endDate  // Entrada
        ];

        const [transactions] = await connection.query(sqlTransactions, transParams);
        console.log('Transactions count:', transactions.length);
        transactions.forEach((tx, idx) => {
            console.log(`  ${idx + 1}. ${tx.data} - ${tx.tipo_formatado} - ${tx.valor} (${tx.direction})`);
        });

    } catch (error) {
        console.error('DEBUG ERROR:', error);
    } finally {
        await connection.end();
    }
}

debugExtrato();
