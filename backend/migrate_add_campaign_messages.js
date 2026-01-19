const db = require('./config/database');

async function migrate() {
    try {
        console.log('Migrating campaign message fields...');
        const connection = await db.getConnection();

        // 1. Ensure columns exist (ADD)
        // We use TEXT initially or LONGTEXT directly here.
        const addQueries = [
            "ALTER TABLE campanhas ADD COLUMN email_subject VARCHAR(255) NULL",
            "ALTER TABLE campanhas ADD COLUMN email_body LONGTEXT NULL",
            "ALTER TABLE campanhas ADD COLUMN whatsapp_text LONGTEXT NULL"
        ];

        for (const query of addQueries) {
            try {
                await connection.query(query);
                console.log('Executed ADD:', query);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // console.log('Column already exists, skipping ADD.');
                } else {
                    console.error('Error executing ADD:', query, err.message);
                }
            }
        }

        // 2. Ensure columns are LONGTEXT (MODIFY)
        // This fixes the "Data too long" error if the column previously existed as TEXT
        const modifyQueries = [
            "ALTER TABLE campanhas MODIFY COLUMN email_body LONGTEXT NULL",
            "ALTER TABLE campanhas MODIFY COLUMN whatsapp_text LONGTEXT NULL"
        ];

        for (const query of modifyQueries) {
            try {
                await connection.query(query);
                console.log('Executed MODIFY:', query);
            } catch (err) {
                console.error('Error executing MODIFY:', query, err.message);
            }
        }

        connection.release();
        console.log('Migration completed.');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

module.exports = migrate;

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}
