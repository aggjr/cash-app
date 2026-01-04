const db = require('./config/database');

/**
 * Migration: Make company_id required in accounts table
 * - Updates orphan accounts to use first company from project
 * - Makes company_id NOT NULL
 * - Adds foreign key constraint with ON DELETE RESTRICT
 */
async function migrateAccountCompanyRequired() {
    const connection = await db.pool.getConnection();

    try {
        console.log('[Migration] Starting: Make company_id required in accounts...');

        // Step 1: Check if column exists and get constraint info
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'contas'
            AND COLUMN_NAME = 'company_id'
        `);

        if (columns.length === 0) {
            console.log('[Migration] Column company_id does not exist! Adding it...');
            await connection.query(`
                ALTER TABLE contas
                ADD COLUMN company_id INT NULL
                AFTER account_number
            `);
        }

        // Step 2: Update orphan accounts (accounts without company_id)
        console.log('[Migration] Updating accounts without company_id...');
        const [orphanAccounts] = await connection.query(`
            SELECT c.id, c.project_id, c.name
            FROM contas c
            WHERE c.company_id IS NULL
        `);

        if (orphanAccounts.length > 0) {
            console.log(`[Migration] Found ${orphanAccounts.length} orphan account(s)`);

            for (const account of orphanAccounts) {
                // Get first company from the same project
                const [companies] = await connection.query(`
                    SELECT id FROM empresas 
                    WHERE project_id = ? 
                    ORDER BY id ASC 
                    LIMIT 1
                `, [account.project_id]);

                if (companies.length > 0) {
                    await connection.query(`
                        UPDATE contas 
                        SET company_id = ? 
                        WHERE id = ?
                    `, [companies[0].id, account.id]);
                    console.log(`[Migration]   ✓ Updated account "${account.name}" (ID ${account.id}) → company ${companies[0].id}`);
                } else {
                    console.warn(`[Migration]   ⚠ No company found for project ${account.project_id}, account ${account.id}`);
                }
            }
        } else {
            console.log('[Migration] No orphan accounts found.');
        }

        // Step 3: Make company_id NOT NULL (if it isn't already)
        const isNullable = columns.length > 0 ? columns[0].IS_NULLABLE === 'YES' : true;

        if (isNullable) {
            console.log('[Migration] Making company_id NOT NULL...');
            await connection.query(`
                ALTER TABLE contas
                MODIFY COLUMN company_id INT NOT NULL
            `);
            console.log('[Migration]   ✓ Column company_id is now NOT NULL');
        } else {
            console.log('[Migration] Column company_id is already NOT NULL');
        }

        // Step 4: Add foreign key constraint if not exists
        const [constraints] = await connection.query(`
            SELECT CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'contas'
            AND COLUMN_NAME = 'company_id'
            AND REFERENCED_TABLE_NAME = 'empresas'
        `);

        if (constraints.length === 0) {
            console.log('[Migration] Adding foreign key constraint...');

            // First, drop the old FK if it exists (might be without proper constraint)
            try {
                const [existingFKs] = await connection.query(`
                    SELECT CONSTRAINT_NAME
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'contas'
                    AND COLUMN_NAME = 'company_id'
                `);

                for (const fk of existingFKs) {
                    await connection.query(`ALTER TABLE contas DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
                    console.log(`[Migration]   Dropped old FK: ${fk.CONSTRAINT_NAME}`);
                }
            } catch (err) {
                // Ignore if no FK exists
            }

            await connection.query(`
                ALTER TABLE contas
                ADD CONSTRAINT fk_contas_company
                FOREIGN KEY (company_id) REFERENCES empresas(id)
                ON DELETE RESTRICT
                ON UPDATE CASCADE
            `);
            console.log('[Migration]   ✓ Foreign key constraint added (ON DELETE RESTRICT)');
        } else {
            console.log('[Migration] Foreign key constraint already exists');
        }

        console.log('[Migration] ✅ Migration completed successfully!');

    } catch (error) {
        console.error('[Migration] ❌ Error:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = migrateAccountCompanyRequired;
