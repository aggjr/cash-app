const db = require('./config/database');

async function migrate() {
    try {
        console.log('Adding description column to empresas table...');
        await db.query("ALTER TABLE empresas ADD COLUMN description TEXT AFTER cnpj");
        console.log('Column added successfully.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists.');
        } else {
            console.error('Migration failed:', e);
        }
    }
    process.exit();
}

migrate();
