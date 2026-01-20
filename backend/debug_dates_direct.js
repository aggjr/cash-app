const mysql = require('mysql2/promise');

async function debug() {
    try {
        const pool = mysql.createPool({
            host: '127.0.0.1',
            user: 'root',
            password: 'Dani160779!',
            database: 'cash_db',
            // CRITICAL: dateStrings true matches config/database.js
            dateStrings: true
        });

        console.log('Searching for empty dates...');

        // 1. Check for literal strings
        const [rows] = await pool.query(`
            SELECT id, data_real_recebimento, CAST(data_real_recebimento as CHAR) as str_val 
            FROM entradas 
            WHERE data_real_recebimento IS NULL 
               OR data_real_recebimento = '0000-00-00' 
               OR data_real_recebimento = ''
               OR data_real_recebimento = '0'
            LIMIT 10
        `);
        console.log('Matches found using IS NULL / 0000-00-00 / Empty String:', rows);

        // 2. Check strict raw values for recent entries
        const [rows2] = await pool.query(`
            SELECT id, data_real_recebimento, CAST(data_real_recebimento as CHAR) as str_val
            FROM entradas
            ORDER BY id DESC
            LIMIT 20
        `);
        console.log('Recent 20 (raw):', rows2);

        await pool.end();
    } catch (e) {
        console.error(e);
    }
}

debug();
