const db = require('./config/database');

async function fixEmpresasSchema() {
    console.log('🔧 Fixing empresas table schema...');

    try {
        const connection = await db.getConnection();

        // Check if description column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'cash'}'
            AND TABLE_NAME = 'empresas'
            AND COLUMN_NAME = 'description'
        `);

        if (columns.length === 0) {
            console.log('⚠️  Adding description column to empresas...');
            await connection.query(`
                ALTER TABLE empresas 
                ADD COLUMN description TEXT AFTER cnpj
            `);
            console.log('✅ Description column added');
        } else {
            console.log('✅ Description column already exists');
        }

        connection.release();
        console.log('✅ Empresas schema fix completed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error fixing empresas schema:', error);
        process.exit(1);
    }
}

fixEmpresasSchema();
