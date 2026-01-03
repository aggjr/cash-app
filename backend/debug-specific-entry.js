
const db = require('./config/database');

async function inspectSpecificEntry() {
    try {
        const connection = await db.getConnection();

        console.log('Searching for entry with value 10000...');
        const [rows] = await connection.query(`
            SELECT 
                id, 
                descricao, 
                valor,
                data_real_recebimento,
                data_prevista_recebimento,
                DATE_FORMAT(data_real_recebimento, '%Y-%m-%d') as fmt_real,
                DATE_FORMAT(data_prevista_recebimento, '%Y-%m-%d') as fmt_prev,
                CAST(data_real_recebimento AS CHAR) as cast_real,
                CAST(data_prevista_recebimento AS CHAR) as cast_prev
            FROM entradas 
            WHERE valor = 10000 
            ORDER BY id DESC
            LIMIT 5
        `);

        console.log('Found rows:', rows.length);
        rows.forEach(r => {
            console.log('--------------------------------------------------');
            console.log('ID:', r.id);
            console.log('Description:', r.descricao);
            console.log('fmt_real:', r.fmt_real);
            console.log('cast_real:', r.cast_real);
            console.log('fmt_prev:', r.fmt_prev);
            console.log('cast_prev:', r.cast_prev);

        });

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

inspectSpecificEntry();
