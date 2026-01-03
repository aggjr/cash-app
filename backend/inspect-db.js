const db = require('./config/database');

async function inspect() {
    try {
        const [rows] = await db.query("SHOW COLUMNS FROM retiradas");
        console.log('Columns in retiradas:', rows.map(r => r.Field));
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

inspect();
