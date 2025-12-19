const db = require('./config/database');

async function addComprovanteToTransferencias() {
    try {
        console.log('🔧 Adding comprovante_url column to transferencias table...');

        // Check if column already exists
        const [columns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'transferencias' 
            AND COLUMN_NAME = 'comprovante_url'
        `);

        if (columns.length > 0) {
            console.log('✅ Column comprovante_url already exists in transferencias table');
            return;
        }

        // Add column
        await db.query(`
            ALTER TABLE transferencias 
            ADD COLUMN comprovante_url VARCHAR(500) NULL AFTER descricao
        `);

        console.log('✅ Successfully added comprovante_url column to transferencias table');

    } catch (error) {
        console.error('❌ Error adding comprovante_url column:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

addComprovanteToTransferencias();
