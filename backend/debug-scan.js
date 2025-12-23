
const db = require('./config/database');

async function debugScan() {
    try {
        const connection = await db.getConnection();

        console.log('Searching for ANY entry with value 10000...');
        const [rows] = await connection.query(`
            SELECT 
                id, 
                descricao, 
                valor,
                data_real_recebimento,
                DATE_FORMAT(data_real_recebimento, '%Y-%m-%d') as fmt
            FROM entradas 
            WHERE valor = 10000 
            ORDER BY id DESC
            LIMIT 10
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

debugScan();
