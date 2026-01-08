/**
 * Migration: Drop IVA Knowledge Columns from MySQL
 * 
 * LAW: QUALQUER CONHECIMENTO DA IVA = SÓ QDRANT
 * 
 * This migration removes ALL IVA-specific columns from users table
 * After data has been migrated to Qdrant
 */

const db = require('../config/database');

async function dropIvaColumns() {
    console.log('\n🗑️ Dropping IVA Knowledge Columns from MySQL\n');
    console.log('LAW: QUALQUER CONHECIMENTO DA IVA = SÓ QDRANT\n');

    try {
        // List of columns to drop
        const columnsToDrop = [
            'preferred_name',
            'iva_preferences',
            'iva_introduced',
            'iva_voice_enabled',
            'iva_voice_rate',
            'iva_voice_premium',
            'iva_voice_male',
            'iva_screen_familiarity',
            'last_iva_access'
        ];

        console.log(`📋 Columns to drop: ${columnsToDrop.length}\n`);

        for (const column of columnsToDrop) {
            try {
                // Check if column exists
                const [columns] = await db.query(`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'users' 
                      AND COLUMN_NAME = ?
                `, [column]);

                if (columns.length > 0) {
                    await db.query(`ALTER TABLE users DROP COLUMN ${column}`);
                    console.log(`✅ Dropped: ${column}`);
                } else {
                    console.log(`⏭️  Skipped: ${column} (doesn't exist)`);
                }
            } catch (err) {
                console.error(`❌ Error dropping ${column}:`, err.message);
            }
        }

        // Also drop from projects table
        try {
            const [columns] = await db.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'projects' 
                  AND COLUMN_NAME = 'iva_context'
            `);

            if (columns.length > 0) {
                await db.query(`ALTER TABLE projects DROP COLUMN iva_context`);
                console.log(`✅ Dropped: projects.iva_context`);
            }
        } catch (err) {
            console.error(`❌ Error dropping projects.iva_context:`, err.message);
        }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`✅ Migration Complete!`);
        console.log(`📊 All IVA knowledge columns removed from MySQL`);
        console.log(`🎯 IVA knowledge now lives ONLY in Qdrant`);
        console.log(`${'='.repeat(50)}\n`);

    } catch (err) {
        console.error('\n❌ CRITICAL ERROR:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }

    process.exit(0);
}

// Run migration
dropIvaColumns();
