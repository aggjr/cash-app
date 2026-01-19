const db = require('./config/database');

async function migrate() {
    try {
        console.log('Adding message fields to campanhas table...');
        const connection = await db.getConnection();

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
                    // console.log('Column already exists, skipping.');
                } else {
                    console.error('Error executing query:', query, err.message);
                }
            }
        }

        connection.release();
        console.log('Migration completed.');
    } catch (error) {
        console.error('Migration failed:', error);
        // Do not exit process, just log error
    }
}

module.exports = migrate;

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}
