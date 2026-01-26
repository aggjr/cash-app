const db = require('./config/database');

async function migrate() {
    try {
        console.log('Checking if initial_balance column exists in contas table...');
        const [rows] = await db.query("SHOW COLUMNS FROM contas LIKE 'initial_balance'");

        if (rows.length === 0) {
            console.log('Adding initial_balance column...');
            await db.query("ALTER TABLE contas ADD COLUMN initial_balance DECIMAL(15,2) DEFAULT 0.00 AFTER description");
            console.log('Column added successfully.');
        } else {
            console.log('Column already exists.');
        }
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
