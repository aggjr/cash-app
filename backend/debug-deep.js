
const db = require('./config/database');

async function debugEntry() {
    try {
        const connection = await db.getConnection();

        console.log('Searching for entry...');
        // Using LIKE to be safe with partial matches
        const [rows] = await connection.query(`
            SELECT 
                id, 
                descricao, 
                valor,
                data_real_recebimento,
                CAST(data_real_recebimento AS CHAR) as cast_real,
                DATE_FORMAT(data_real_recebimento, '%Y-%m-%d %H:%i:%s') as fmt_realfull,
                data_prevista_recebimento,
                CAST(data_prevista_recebimento AS CHAR) as cast_prev
            FROM entradas 
            WHERE valor = 10000 
            AND descricao LIKE '%Consultoria / OJEAP%'
        `);

        console.log('Found rows:', rows.length);
        rows.forEach(r => {
            console.log('Row ID:', r.id);
            console.log('Description:', r.descricao);
            console.log('Raw Real Date (Obj):', r.data_real_recebimento);
            console.log('Cast Real Date:', r.cast_real);
            console.log('Fmt Real Full:', r.fmt_realfull);
            console.log('Raw Prev Date (Obj):', r.data_prevista_recebimento);
            console.log('Cast Prev Date:', r.cast_prev);
        });
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

debugEntry();
