const db = require('./config/database');

async function inspect() {
    try {
        console.log('--- Table: entradas ---');
        const [entradasCols] = await db.query("DESCRIBE entradas");
        console.log(entradasCols.map(c => `${c.Field} (${c.Type})`).join(', '));

        console.log('\n--- Table: saidas ---');
        const [saidasCols] = await db.query("DESCRIBE saidas");
        console.log(saidasCols.map(c => `${c.Field} (${c.Type})`).join(', '));

        console.log('\n--- Table: producao_revenda ---');
        const [prodCols] = await db.query("DESCRIBE producao_revenda");
        console.log(prodCols.map(c => `${c.Field} (${c.Type})`).join(', '));
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

inspect();
