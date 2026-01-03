
require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

async function migrate() {
    let conn;
    try {
        conn = await mysql.createConnection(dbConfig);
        console.log('Connected.');

        // Add columns if not exist
        try {
            await conn.query(`ALTER TABLE producao_revenda ADD COLUMN data_prevista_pagamento DATE AFTER data_fato`);
            console.log('Added data_prevista_pagamento');
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.error(e.message);
        }

        try {
            await conn.query(`ALTER TABLE producao_revenda ADD COLUMN data_real_pagamento DATE AFTER data_prevista_pagamento`);
            console.log('Added data_real_pagamento');
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.error(e.message);
        }

        // Backfill
        console.log('Backfilling...');
        await conn.query(`UPDATE producao_revenda SET data_real_pagamento = data_fato WHERE data_real_pagamento IS NULL`);
        await conn.query(`UPDATE producao_revenda SET data_prevista_pagamento = data_fato WHERE data_prevista_pagamento IS NULL`);
        console.log('Backfill complete.');

    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.end();
    }
}

migrate();
