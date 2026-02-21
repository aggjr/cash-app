const db = require('./config/database');

async function debugSchemaSaidas() {
    try {
        const [rows] = await db.query('DESCRIBE saidas');
        console.log(rows);
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
debugSchemaSaidas();
