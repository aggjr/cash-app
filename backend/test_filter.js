const mysql = require('mysql2/promise');

async function debug() {
    try {
        const pool = mysql.createPool({
            host: '127.0.0.1',
            user: 'root',
            password: 'Dani160779!',
            database: 'cash_db',
            dateStrings: true
        });

        console.log('Testing Filter Logic...');

        // Emulate the controller logic
        const sql = `
            SELECT id, data_real_recebimento 
            FROM entradas e
            WHERE (e.data_real_recebimento IS NULL OR e.data_real_recebimento = '0000-00-00' OR e.data_real_recebimento = '')
            LIMIT 10
        `;

        console.log('SQL:', sql);

        const [rows] = await pool.query(sql);
        console.log('Rows found:', rows.length);
        console.log('Data:', rows);

        if (rows.length === 0) {
            console.log('No matches! Checking distinct values in column...');
            const [distinct] = await pool.query(`SELECT DISTINCT data_real_recebimento FROM entradas ORDER BY data_real_recebimento ASC LIMIT 10`);
            console.log('Distinct values:', distinct);
        }

        await pool.end();
    } catch (e) {
        console.error(e);
    }
}

debug();
