const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Fallback if .env is in root
if (!process.env.DB_USER) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}
const db = require('./config/database');

async function checkColumns() {
    try {
        console.log('Checking columns in entries table...');
        const [rows] = await db.query('DESCRIBE entradas');
        console.log('Columns found:', rows.map(r => r.Field));
        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
}

checkColumns();
