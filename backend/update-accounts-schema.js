require('dotenv').config();
const db = require('./config/database');

async function run() {
    try {
        console.log('Starting Schema Update...');

        // Add account_type
        try {
            await db.query(`ALTER TABLE contas ADD COLUMN account_type VARCHAR(50) DEFAULT 'outros'`);
            console.log('Added account_type column');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('account_type column already exists');
            } else {
                throw e;
            }
        }

        // Add initial_balance
        try {
            await db.query(`ALTER TABLE contas ADD COLUMN initial_balance DECIMAL(15,2) DEFAULT 0`);
            console.log('Added initial_balance column');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('initial_balance column already exists');
            } else {
                throw e;
            }
        }

        // Add current_balance
        try {
            await db.query(`ALTER TABLE contas ADD COLUMN current_balance DECIMAL(15,2) DEFAULT 0`);
            console.log('Added current_balance column');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('current_balance column already exists');
            } else {
                throw e;
            }
        }

        console.log('Schema update completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Schema update failed:', error);
        process.exit(1);
    }
}

run();
