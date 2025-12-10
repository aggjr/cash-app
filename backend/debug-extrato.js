const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function debug() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('--- CHECKING TABLES SCHEMA ---');
        const tables = ['entradas', 'tipo_entrada', 'tipo_despesa', 'tipo_producao_revenda'];
        for (const t of tables) {
            try {
                const [desc] = await connection.query(`DESCRIBE ${t}`);
                console.log(`Table ${t} exists. Columns:`, desc.map(c => c.Field).join(', '));
            } catch (e) {
                console.error(`Table ${t} MISSING or Error:`, e.message);
            }
        }
    } catch (error) {
        console.error('DEBUG ERROR:', error);
    } finally {
        await connection.end();
    }
}

debug();
