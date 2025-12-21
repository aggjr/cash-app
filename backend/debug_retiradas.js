const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const db = require('./config/database');

async function runDebug() {
    try {
        console.log("Checking Database Timezone...");
        const [tz] = await db.execute("SELECT @@global.time_zone, @@session.time_zone;");
        console.log("Timezones:", tz);

        console.log("\n--- Checking Retiradas Raw Data ---");
        // Get all retiradas to see raw dates
        const [retiradas] = await db.execute(`
            SELECT id, valor, data_fato, data_prevista, data_real, active 
            FROM retiradas 
            ORDER BY id DESC LIMIT 5
        `);
        console.log(JSON.stringify(retiradas, null, 2));

        console.log("\n--- Simulating Previsão Query for Retiradas ---");
        // Simulate effectiveDateSql logic
        // COALESCE(data_real, data_prevista)
        const dateExpr = "COALESCE(data_real, data_prevista)";
        const startDate = '2025-12-10';
        const endDate = '2025-12-31';

        const [items] = await db.execute(`
            SELECT 
                id, 
                valor, 
                ${dateExpr} as raw_date_val,
                DATE_FORMAT(${dateExpr}, '%Y-%m-%d') as formatted_date_key
            FROM retiradas
            WHERE active = 1
            AND ${dateExpr} >= ? AND ${dateExpr} <= ?
        `, [startDate, endDate]);

        console.log("Previsão Query Results:");
        console.log(JSON.stringify(items, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit();
    }
}

runDebug();
