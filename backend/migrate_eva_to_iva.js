const db = require('./config/database');

async function migrateEvaToIva() {
    console.log('🔄 Starting EVA → IVA database migration...');

    try {
        // Rename columns in users table
        const columns = [
            'eva_introduced',
            'eva_voice_enabled',
            'eva_voice_rate',
            'eva_voice_male',
            'eva_voice_premium'
        ];

        for (const oldCol of columns) {
            const newCol = oldCol.replace('eva_', 'iva_');

            // Check if old column exists
            const [cols] = await db.query(
                `SHOW COLUMNS FROM users LIKE '${oldCol}'`
            );

            if (cols.length > 0) {
                console.log(`  Renaming column: ${oldCol} → ${newCol} `);

                // Get column definition
                const columnDef = cols[0];
                let type = columnDef.Type;
                let nullable = columnDef.Null === 'YES' ? 'NULL' : 'NOT NULL';
                let defaultVal = columnDef.Default !== null ? `DEFAULT ${columnDef.Default} ` : '';

                // Rename column
                await db.query(
                    `ALTER TABLE users CHANGE COLUMN ${oldCol} ${newCol} ${type} ${nullable} ${defaultVal} `
                );

                console.log(`  ✅ ${oldCol} → ${newCol} `);
            } else {
                console.log(`  ⏭️  Column ${oldCol} not found(may already be renamed)`);
            }
        }

        // Check for eva_tracking table
        const [tables] = await db.query(
            `SHOW TABLES LIKE 'eva_tracking'`
        );

        if (tables.length > 0) {
            console.log('  Renaming table: eva_tracking → iva_tracking');
            await db.query('RENAME TABLE eva_tracking TO iva_tracking');
            console.log('  ✅ eva_tracking → iva_tracking');
        } else {
            console.log('  ⏭️  Table eva_tracking not found (may already be renamed)');
        }

        // Check for eva_context table
        const [contextTables] = await db.query(
            `SHOW TABLES LIKE 'eva_context'`
        );

        if (contextTables.length > 0) {
            console.log('  Renaming table: eva_context → iva_context');
            await db.query('RENAME TABLE eva_context TO iva_context');
            console.log('  ✅ eva_context → iva_context');
        } else {
            console.log('  ⏭️  Table eva_context not found (may already be renamed)');
        }

        console.log('✅ EVA → IVA database migration completed successfully!');
        return true;

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migration
if (require.main === module) {
    migrateEvaToIva()
        .then(() => {
            console.log('Migration script finished.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = migrateEvaToIva;
