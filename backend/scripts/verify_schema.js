const db = require('../config/database');

async function checkSchema() {
    try {
        const [rows] = await db.query('DESCRIBE campanhas');

        const newColumns = ['email_subject', 'email_body', 'whatsapp_text'];
        const foundColumns = rows.filter(r => newColumns.includes(r.Field)).map(r => r.Field);

        console.log('Columns found:', foundColumns);

        if (foundColumns.length === 3) {
            console.log('SUCCESS: All new columns present.');
        } else {
            console.log('FAILURE: Missing columns. Found:', foundColumns);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error connecting or verifying:', error);
        process.exit(1);
    }
}

checkSchema();
