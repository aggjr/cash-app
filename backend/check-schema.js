require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

async function checkSchema() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        console.log('Connected to DB');

        const tables = ['entradas', 'saidas', 'producao_revenda', 'tipo_entrada', 'tipo_saida', 'tipo_producao_revenda', 'aportes', 'transferencias', 'retiradas'];

        for (const table of tables) {
            console.log(`\n--- ${table} ---`);
            const [columns] = await conn.query(`DESCRIBE ${table}`);
            columns.forEach(col => {
                console.log(`${col.Field} (${col.Type})`);
            });
        }
        await conn.end();
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
