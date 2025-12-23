
const db = require('./config/database');

async function inspectLastEntries() {
    try {
        const connection = await db.getConnection();

        console.log('Listing last 5 entries...');
        const [rows] = await connection.query(`
            SELECT 
                id, 
                descricao, 
                valor,
                data_real_recebimento,
                DATE_FORMAT(data_real_recebimento, '%Y-%m-%d') as fmt_real
            FROM entradas 
            ORDER BY id DESC
            LIMIT 5
        `);

        console.log('Found rows:', rows.length);
        rows.forEach(r => {
            console.log(r);
        });

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

inspectLastEntries();
