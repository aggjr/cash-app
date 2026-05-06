const db = require('./config/database');
async function run() {
    try {
        const [cols] = await db.query('SHOW COLUMNS FROM producao_revenda');
        console.log(cols.map(c => c.Field));
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
