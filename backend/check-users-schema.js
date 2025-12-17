const db = require('./config/database');

async function checkSchema() {
    try {
        const [rows] = await db.query('DESCRIBE users');
        console.log(rows);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkSchema();
