const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' }); // Adjust path to env if needed

async function fixPhoneNumbers() {
    console.log('Starting phone number fix...');

    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'cash_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const [rows] = await pool.query('SELECT id, telefone FROM leads WHERE telefone IS NOT NULL AND telefone != ""');
        console.log(`Found ${rows.length} leads with phone numbers.`);

        let updatedCount = 0;

        for (const lead of rows) {
            let originalPhone = lead.telefone;
            // Sanitize: remove non-digits
            let cleanPhone = originalPhone.replace(/\D/g, '');

            // Logic: if 10 or 11 digits, prepend 55
            if (cleanPhone.length === 10 || cleanPhone.length === 11) {
                const newPhone = '55' + cleanPhone;

                // Only update if it changed (e.g. was already sanitized but missing 55)
                // If original was "31999998888", clean is same, new is "5531..."
                // If original was "(31) 99999-8888", clean is "31999998888", new is "5531..."

                console.log(`Updating Lead ${lead.id}: ${originalPhone} -> ${newPhone}`);
                await pool.query('UPDATE leads SET telefone = ? WHERE id = ?', [newPhone, lead.id]);
                updatedCount++;
            } else if (cleanPhone !== originalPhone) {
                // Also update if just formatting changed but no 55 added (e.g. already had 55 but had dashes)
                // Wait, user asked specifically to ADD 55.
                // But better to sanitize everything to plain numbers too?
                // Standard: "Standardize WhatsApp Numbers".
                // Let's sanitize everything.
                if (cleanPhone.length > 0) {
                    console.log(`Sanitizing Lead ${lead.id}: ${originalPhone} -> ${cleanPhone}`);
                    await pool.query('UPDATE leads SET telefone = ? WHERE id = ?', [cleanPhone, lead.id]);
                    updatedCount++;
                }
            }
        }

        console.log(`Finished! Updated ${updatedCount} leads.`);

    } catch (error) {
        console.error('Error fixing phone numbers:', error);
    } finally {
        await pool.end();
    }
}

fixPhoneNumbers();
