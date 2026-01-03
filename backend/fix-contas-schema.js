const db = require('./config/database');

async function fixContasSchema() {
    console.log('🔧 Fixing contas table schema...');

    try {
        const connection = await db.getConnection();

        // Check if description column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'cash'}'
            AND TABLE_NAME = 'contas'
            AND COLUMN_NAME = 'description'
        `);

        if (columns.length === 0) {
            console.log('⚠️  Adding description column to contas...');
            await connection.query(`
                ALTER TABLE contas 
                ADD COLUMN description TEXT AFTER name
            `);
            console.log('✅ Description column added to contas');
        } else {
            console.log('✅ Description column already exists in contas');
        }

        connection.release();
        console.log('✅ Contas schema fix completed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error fixing contas schema:', error);
        process.exit(1);
    }
}

fixContasSchema();
