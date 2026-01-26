
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Fallback if .env is in root
if (!process.env.DB_USER) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}
const db = require('./config/database');

async function addColumnsToTable(connection, tableName) {
    console.log(`Adding installment columns to ${tableName}...`);

    // Add installment_group_id
    try {
        await connection.query(`
            ALTER TABLE ${tableName} 
            ADD COLUMN installment_group_id VARCHAR(50) DEFAULT NULL
        `);
        console.log(`Added installment_group_id column to ${tableName}`);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log(`Column installment_group_id already exists in ${tableName}`);
        } else {
            console.error(`Error adding installment_group_id: ${e.message}`);
        }
    }

    // Add installment_number
    try {
        await connection.query(`
            ALTER TABLE ${tableName} 
            ADD COLUMN installment_number INT DEFAULT NULL AFTER installment_group_id
        `);
        console.log(`Added installment_number column to ${tableName}`);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log(`Column installment_number already exists in ${tableName}`);
        } else {
            console.error(`Error adding installment_number: ${e.message}`);
        }
    }

    // Add installment_total
    try {
        await connection.query(`
            ALTER TABLE ${tableName} 
            ADD COLUMN installment_total INT DEFAULT NULL AFTER installment_number
        `);
        console.log(`Added installment_total column to ${tableName}`);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log(`Column installment_total already exists in ${tableName}`);
        } else {
            console.error(`Error adding installment_total: ${e.message}`);
        }
    }

    // Add installment_interval
    try {
        await connection.query(`
            ALTER TABLE ${tableName} 
            ADD COLUMN installment_interval VARCHAR(20) DEFAULT NULL AFTER installment_total
        `);
        console.log(`Added installment_interval column to ${tableName}`);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log(`Column installment_interval already exists in ${tableName}`);
        } else {
            console.error(`Error adding installment_interval: ${e.message}`);
        }
    }

    // Add installment_custom_days
    try {
        await connection.query(`
            ALTER TABLE ${tableName} 
            ADD COLUMN installment_custom_days INT DEFAULT NULL AFTER installment_interval
        `);
        console.log(`Added installment_custom_days column to ${tableName}`);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log(`Column installment_custom_days already exists in ${tableName}`);
        } else {
            console.error(`Error adding installment_custom_days: ${e.message}`);
        }
    }
}

async function runMigration() {
    let connection;
    try {
        console.log('Starting migration: add installment columns to producao_revenda...');
        connection = await db.getConnection();

        await addColumnsToTable(connection, 'producao_revenda');

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

runMigration();
