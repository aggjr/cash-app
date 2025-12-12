require('dotenv').config();
const db = require('./config/database');

async function run() {
    const tables = ['tipo_entrada', 'tipo_saida', 'tipo_producao_revenda'];

    for (const table of tables) {
        try {
            console.log(`Checking ${table}...`);
            await db.query(`ALTER TABLE ${table} ADD COLUMN active BOOLEAN DEFAULT TRUE`);
            console.log(`Added active column to ${table}`);
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log(`Column active already exists in ${table}`);
            } else {
                console.error(`Error altering ${table}:`, error.message);
            }
        }
    }
    process.exit();
}

run();
