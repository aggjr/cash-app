require('dotenv').config();
const db = require('./config/database');

async function run() {
    try {
        console.log('🔄 Migrating Cost Centers (Centros de Custo)...');

        // 1. Create centros_custo table
        console.log('Creating centros_custo table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS centros_custo (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ Created centros_custo');

        // 2. Add columns to transaction tables
        const tables = ['entradas', 'saidas', 'producao_revenda'];

        for (const table of tables) {
            console.log(`Checking ${table}...`);
            const [columns] = await db.query(`SHOW COLUMNS FROM ${table} LIKE 'centro_custo_id'`);

            if (columns.length === 0) {
                console.log(`  Adding centro_custo_id to ${table}...`);
                await db.query(`
                    ALTER TABLE ${table} 
                    ADD COLUMN centro_custo_id INT NULL,
                    ADD CONSTRAINT fk_${table}_centro_custo 
                    FOREIGN KEY (centro_custo_id) REFERENCES centros_custo(id)
                `);
                console.log(`  ✓ Added column to ${table}`);
            } else {
                console.log(`  ✓ Column already exists in ${table}`);
            }
        }

        console.log('\n✅ Cost Center migration completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

run();
