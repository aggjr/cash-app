const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspectSchema() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

        console.log('Fetching schema for table: entradas');
        const [columns] = await connection.query('DESCRIBE entradas');

        console.log('\nColumn Definitions:');
        columns.forEach(col => {
            if (col.Field === 'valor') {
                console.log(`\n>>> CHECKING VALOR COLUMN <<<`);
                console.log(`Field: ${col.Field}`);
                console.log(`Type: ${col.Type}`);
                console.log(`Null: ${col.Null}`);
                console.log(`Default: ${col.Default}`);
                console.log(`>>> END CHECK <<<\n`);
            } else {
                console.log(`${col.Field}: ${col.Type}`);
            }
        });

    } catch (error) {
        console.error('Error inspecting schema:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

inspectSchema();
