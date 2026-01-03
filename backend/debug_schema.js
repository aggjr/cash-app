const db = require('./config/database');

async function checkSchema() {
    try {
        const tables = ['saidas', 'producao_revenda', 'entradas', 'aportes', 'retiradas'];
        for (const t of tables) {
            const [rows] = await db.execute(`DESCRIBE ${t}`);
            console.log(`\n--- ${t} ---`);
            rows.forEach(r => console.log(r.Field));
        }
    } catch (err) {
        console.error(err);
    }
    process.exit();
}

checkSchema();
