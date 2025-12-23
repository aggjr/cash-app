require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkLocalStructure() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

        console.log('=== ESTRUTURA DO BANCO LOCAL ===\n');

        // Query 1: Tabelas e número de colunas
        const [tables] = await connection.query(`
            SELECT TABLE_NAME, COUNT(*) as NUM_COLUMNS 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            GROUP BY TABLE_NAME 
            ORDER BY TABLE_NAME
        `);

        console.log('TABELAS E NÚMERO DE COLUNAS:');
        console.log('─'.repeat(50));
        tables.forEach(row => {
            console.log(`${row.TABLE_NAME.padEnd(30)} ${row.NUM_COLUMNS} colunas`);
        });
        console.log(`\nTotal: ${tables.length} tabelas\n`);

        await connection.end();

    } catch (error) {
        console.error('Erro:', error.message);
        process.exit(1);
    }
}

checkLocalStructure();
