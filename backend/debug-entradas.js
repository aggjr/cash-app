const db = require('./config/database');

async function debugEntradas() {
    try {
        console.log('Querying entradas...');
        const [rows] = await db.query('SELECT id, valor, descricao, active, tipo_entrada_id FROM entradas ORDER BY id DESC LIMIT 10');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

debugEntradas();
