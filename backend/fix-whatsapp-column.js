const db = require('./config/database');

async function fixWhatsAppTextColumn() {
    try {
        console.log('🔧 Verificando coluna whatsapp_text...');

        // Check current column type
        const [columns] = await db.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'cash'
            AND TABLE_NAME = 'campanhas'
            AND COLUMN_NAME IN ('whatsapp_text', 'email_body')
        `);

        console.log('📊 Colunas atuais:');
        columns.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (max: ${col.CHARACTER_MAXIMUM_LENGTH || 'N/A'})`);
        });

        // Fix whatsapp_text to LONGTEXT (supports up to 4GB)
        console.log('\\n🔧 Alterando whatsapp_text para LONGTEXT...');
        await db.query(`
            ALTER TABLE campanhas 
            MODIFY COLUMN whatsapp_text LONGTEXT
        `);
        console.log('✅ whatsapp_text alterado para LONGTEXT');

        // Fix email_body to LONGTEXT as well
        console.log('\\n🔧 Alterando email_body para LONGTEXT...');
        await db.query(`
            ALTER TABLE campanhas 
            MODIFY COLUMN email_body LONGTEXT
        `);
        console.log('✅ email_body alterado para LONGTEXT');

        // Verify changes
        const [newColumns] = await db.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'cash'
            AND TABLE_NAME = 'campanhas'
            AND COLUMN_NAME IN ('whatsapp_text', 'email_body')
        `);

        console.log('\\n✅ Colunas após alteração:');
        newColumns.forEach(col => {
            console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE}`);
        });

        console.log('\\n✅ Migração concluída!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

fixWhatsAppTextColumn();
