
require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

async function checkTables() {
    let conn;
    try {
        conn = await mysql.createConnection(dbConfig);
        console.log('Connected.');

        const checks = [
            { table: 'entradas', col: 'data_real_recebimento' },
            { table: 'saidas', col: 'data_real_pagamento' },
            { table: 'producao_revenda', col: 'data_real_pagamento' },
            { table: 'aportes', col: 'data_real' },
            { table: 'retiradas', col: 'data_real' },
            { table: 'transferencias', col: 'data_real' }
        ];

        for (const c of checks) {
            try {
                const [rows] = await conn.query(`SELECT count(*) as count FROM ${c.table} WHERE ${c.col} IS NOT NULL`);
                console.log(`${c.table} (${c.col}): OK, Rows: ${rows[0].count}`);
            } catch (e) {
                console.error(`ERROR in ${c.table} with ${c.col}: ${e.message}`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.end();
    }
}

checkTables();
