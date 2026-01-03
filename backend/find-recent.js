const db = require('./config/database');

async function findRecentEntries() {
    try {
        const connection = await db.getConnection();

        console.log('=== RECENT ENTRADAS ===\n');

        const [entries] = await connection.query(`
            SELECT 
                id,
                descricao,
                valor,
                data_real_recebimento,
                SUBSTRING(data_real_recebimento, 1, 10) as substring_date
            FROM entradas 
            ORDER BY id DESC
            LIMIT 10
        `);

        console.log(`Found ${entries.length} recent entries:`);
        entries.forEach(e => {
            console.log(`\nID ${e.id}: ${e.descricao || '(sem descrição)'} - R$ ${e.valor}`);
            console.log(`  Raw Object: ${e.data_real_recebimento}`);
            console.log(`  SUBSTRING: ${e.substring_date}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

findRecentEntries();
