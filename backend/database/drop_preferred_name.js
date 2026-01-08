/**
 * Drop preferred_name from MySQL
 * 
 * LAW: QUALQUER CONHECIMENTO DA IVA = SÓ QDRANT
 * 
 * This removes preferred_name from users table.
 * Data is now stored exclusively in Qdrant.
 */

const db = require('../config/database');

async function dropPreferredName() {
    console.log('\n🗑️  Dropping preferred_name from MySQL\n');
    console.log('LAW: Knowledge only in Qdrant!\n');

    try {
        // Check if column exists
        const [columns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'preferred_name'
        `);

        if (columns.length === 0) {
            console.log('✅ Column preferred_name already removed');
            process.exit(0);
        }

        // Drop column
        await db.query('ALTER TABLE users DROP COLUMN preferred_name');
        console.log('✅ Dropped column: users.preferred_name');

        console.log('\n' + '='.repeat(50));
        console.log('✅ MySQL cleanup complete!');
        console.log('🎯 preferred_name now lives ONLY in Qdrant');
        console.log('='.repeat(50) + '\n');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }

    process.exit(0);
}

// Run if called directly
if (require.main === module) {
    dropPreferredName();
}

module.exports = { dropPreferredName };
