const mysql = require(require.resolve('mysql2/promise', { paths: [process.cwd()] }));
require('dotenv').config();

async function run() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('--- SCHEMA ---');
        const [columns] = await pool.query(`SHOW COLUMNS FROM entradas LIKE 'data_real_recebimento'`);
        console.log(columns);

        console.log('\n--- DISTINCT VALUES ---');
        const [rows] = await pool.query(`SELECT DISTINCT data_real_recebimento, CAST(data_real_recebimento AS CHAR) as as_char FROM entradas ORDER BY data_real_recebimento LIMIT 20`);
        console.log(rows);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
