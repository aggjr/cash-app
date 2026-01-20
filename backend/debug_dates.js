const path = require('path');
// Try loading .env from current dir (backend) and parent (root)
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = require('./config/database');

async function debug() {
    try {
        console.log('DB Config Host:', process.env.DB_HOST);
        console.log('DB Config DB:', process.env.DB_NAME);

        // Check specific "problematic" column
        const [rows] = await db.query(`
            SELECT id, data_real_recebimento, CAST(data_real_recebimento as CHAR) as str_val 
            FROM entradas 
            WHERE data_real_recebimento IS NULL 
               OR data_real_recebimento = '0000-00-00' 
               OR data_real_recebimento = ''
            LIMIT 10
        `);
        console.log('Records matching IS NULL / 0000-00-00 / Empty String:', rows);

        // Check raw values of recent records to see what "Empty" looks like if not caught above
        const [rows2] = await db.query(`
            SELECT id, data_real_recebimento, CAST(data_real_recebimento as CHAR) as str_val
            FROM entradas
            ORDER BY id DESC
            LIMIT 20
        `);
        console.log('Recent 20 Records (Raw Data):', rows2);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debug();
