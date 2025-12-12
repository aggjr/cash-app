
require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

async function runDebug() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        console.log('Connected to DB');

        const projectId = '1'; // Assuming ID 1 for test
        const startDate = '2025-07-01';
        const endDate = '2025-12-31';

        console.log(`Debug Fechamento for Project ${projectId}, Range: ${startDate} to ${endDate}`);

        // 1. Check Initial Balance
        const sqlBalance = `
            SELECT 
                account_id,
                SUM(val) as balance
            FROM (
                SELECT account_id, valor AS val FROM entradas WHERE project_id = ? AND data_real_recebimento < ? AND active = 1 AND data_real_recebimento IS NOT NULL
                UNION ALL
                SELECT account_id, valor AS val FROM aportes WHERE project_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL
                UNION ALL
                SELECT account_id, -valor AS val FROM saidas WHERE project_id = ? AND data_real_pagamento < ? AND active = 1 AND data_real_pagamento IS NOT NULL
                UNION ALL
                SELECT account_id, -valor AS val FROM producao_revenda WHERE project_id = ? AND data_real_pagamento < ? AND active = 1 AND data_real_pagamento IS NOT NULL
                UNION ALL
                SELECT account_id, -valor AS val FROM retiradas WHERE project_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL
                UNION ALL
                SELECT source_account_id AS account_id, -valor AS val FROM transferencias WHERE project_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL
                UNION ALL
                SELECT destination_account_id AS account_id, valor AS val FROM transferencias WHERE project_id = ? AND data_real < ? AND active = 1 AND data_real IS NOT NULL
            ) as historic
            GROUP BY account_id
        `;
        const balanceParams = [projectId, startDate, projectId, startDate, projectId, startDate, projectId, startDate, projectId, startDate, projectId, startDate, projectId, startDate];
        const [initialBalances] = await conn.query(sqlBalance, balanceParams);
        console.log('--- Initial Balances ---');
        console.table(initialBalances);


        // 2. Check Movements
        const sqlPeriod = `
             SELECT 
                account_id,
                DATE_FORMAT(dt, '%Y-%m') as month_key,
                SUM(val) as monthly_delta
            FROM (
                SELECT account_id, data_real_recebimento as dt, valor AS val FROM entradas WHERE project_id = ? AND data_real_recebimento BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT account_id, data_real as dt, valor AS val FROM aportes WHERE project_id = ? AND data_real BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT destination_account_id AS account_id, data_real as dt, valor AS val FROM transferencias WHERE project_id = ? AND data_real BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT account_id, data_real_pagamento as dt, -valor AS val FROM saidas WHERE project_id = ? AND data_real_pagamento BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT account_id, data_real_pagamento as dt, -valor AS val FROM producao_revenda WHERE project_id = ? AND data_real_pagamento BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT account_id, data_real as dt, -valor AS val FROM retiradas WHERE project_id = ? AND data_real BETWEEN ? AND ? AND active = 1
                UNION ALL
                SELECT source_account_id AS account_id, data_real as dt, -valor AS val FROM transferencias WHERE project_id = ? AND data_real BETWEEN ? AND ? AND active = 1
            ) as period_movements
            GROUP BY account_id, month_key
        `; // Simplified for debug, ensure columns match controller
        const periodParams = [projectId, startDate, endDate, projectId, startDate, endDate, projectId, startDate, endDate, projectId, startDate, endDate, projectId, startDate, endDate, projectId, startDate, endDate, projectId, startDate, endDate];

        const [movements] = await conn.query(sqlPeriod, periodParams);
        console.log('--- Movements ---');
        console.table(movements);

        await conn.end();

    } catch (e) {
        console.error(e);
    }
}

runDebug();
