const db = require('./config/database');

async function diagnosticDate() {
    try {
        const connection = await db.getConnection();

        console.log('=== MYSQL TIMEZONE DIAGNOSTIC ===\n');

        // 1. Check MySQL timezone
        const [tz] = await connection.query("SELECT @@global.time_zone, @@session.time_zone");
        console.log('MySQL Timezone:', tz[0]);

        // 2. Find an entrada with data_real = 14/12
        console.log('\n=== SEARCHING FOR 14/12 ENTRY ===');
        const [entries] = await connection.query(`
            SELECT 
                id,
                data_real_recebimento,
                SUBSTRING(data_real_recebimento, 1, 10) as substring_date,
                DATE(data_real_recebimento) as date_only,
                CAST(DATE(data_real_recebimento) AS CHAR) as cast_date
            FROM entradas 
            WHERE data_real_recebimento LIKE '2025-12-14%'
            OR data_real_recebimento LIKE '2025-12-13%'
            ORDER BY id DESC
            LIMIT 5
        `);

        console.log(`Found ${entries.length} entries:`);
        entries.forEach(e => {
            console.log('\n--- Entry ID:', e.id);
            console.log('Raw JS Object:', e.data_real_recebimento);
            console.log('SQL SUBSTRING:', e.substring_date);
            console.log('SQL DATE():', e.date_only);
            console.log('SQL CAST DATE:', e.cast_date);
        });

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

diagnosticDate();
