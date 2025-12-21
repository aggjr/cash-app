const db = require('./config/database');

async function checkSchema() {
    try {
        const [rows] = await db.execute("DESCRIBE entradas");
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    }
    process.exit();
}

checkSchema();
