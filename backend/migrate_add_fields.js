const db = require('./config/database');

async function migrate() {
    try {
        console.log('Starting migration...');
        const connection = await db.getConnection();

        // Add data_atraso column if not exists
        try {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN data_atraso DATE NULL AFTER data_prevista_recebimento
            `);
            console.log('✓ Added column: data_atraso');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('→ Column data_atraso already exists');
            else throw e;
        }

        // Add comprovante_url column if not exists
        try {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN comprovante_url VARCHAR(500) NULL
            `);
            console.log('✓ Added column: comprovante_url');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('→ Column comprovante_url already exists');
            else throw e;
        }

        connection.release();
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
