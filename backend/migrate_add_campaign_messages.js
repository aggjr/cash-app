const db = require('./config/database');

async function migrate() {
    try {
        console.log('Adding message fields to campanhas table...');
        const connection = await db.getConnection();

        // Add columns if they don't exist
        // Using "IF NOT EXISTS" via SHOW COLUMNS check is safer or just try/catch

        const queries = [
            "ALTER TABLE campanhas ADD COLUMN email_subject VARCHAR(255) NULL",
            "ALTER TABLE campanhas ADD COLUMN email_body TEXT NULL",
            "ALTER TABLE campanhas ADD COLUMN whatsapp_text TEXT NULL"
        ];

        for (const query of queries) {
            try {
                await connection.query(query);
                console.log('Executed:', query);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log('Column already exists, skipping.');
                } else {
                    throw err;
                }
            }
        }

        connection.release();
        console.log('Migration completed.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
