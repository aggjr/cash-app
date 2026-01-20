import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function run() {
    try {
        console.log('Connecting to DB...');
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('\n--- DISTINCT VALUES (data_real_recebimento) ---');
        const [rows] = await pool.query(`SELECT DISTINCT data_real_recebimento, CAST(data_real_recebimento AS CHAR) as as_char FROM entradas ORDER BY data_real_recebimento LIMIT 20`);
        console.log(rows);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
