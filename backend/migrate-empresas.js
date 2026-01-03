const db = require('./config/database');

async function migrateEmpresas() {
    try {
        console.log('=== Starting Empresas Migration ===\n');

        // Check if empresas table exists
        console.log('1. Checking if empresas table exists...');
        const [tables] = await db.query("SHOW TABLES LIKE 'empresas'");

        if (tables.length === 0) {
            console.log('   Creating empresas table...');
            await db.query(`
                CREATE TABLE empresas (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    name VARCHAR(255) NOT NULL,
                    cnpj VARCHAR(18) UNIQUE NOT NULL,
                    description TEXT,
                    active BOOLEAN DEFAULT TRUE,
                    project_id INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    INDEX idx_project_id (project_id),
                    INDEX idx_cnpj (cnpj),
                    INDEX idx_active (active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('   ✓ empresas table created successfully');
        } else {
            console.log('   ✓ empresas table already exists');
        }

        // Check if company_id column exists in contas
        console.log('\n2. Checking if company_id column exists in contas...');
        const [columns] = await db.query("SHOW COLUMNS FROM contas LIKE 'company_id'");

        if (columns.length === 0) {
            console.log('   Adding company_id column to contas...');
            await db.query('ALTER TABLE contas ADD COLUMN company_id INT NULL AFTER project_id');
            console.log('   ✓ company_id column added');

            console.log('   Adding foreign key constraint...');
            await db.query(`
                ALTER TABLE contas
                ADD CONSTRAINT fk_contas_company 
                    FOREIGN KEY (company_id) REFERENCES empresas(id) 
                    ON DELETE RESTRICT
            `);
            console.log('   ✓ Foreign key constraint added');

            console.log('   Adding index...');
            await db.query('ALTER TABLE contas ADD INDEX idx_company_id (company_id)');
            console.log('   ✓ Index added');
        } else {
            console.log('   ✓ company_id column already exists');
        }

        // Insert sample company
        console.log('\n3. Inserting sample company...');
        const [existing] = await db.query("SELECT id FROM empresas WHERE cnpj = '18.079.490/0001-05'");

        if (existing.length === 0) {
            const [result] = await db.query(`
                INSERT INTO empresas (name, cnpj, description, project_id) 
                VALUES ('Gestão de Foco', '18.079.490/0001-05', 'Empresa principal do grupo', 1)
            `);
            console.log(`   ✓ Sample company created with ID: ${result.insertId}`);

            // Update existing accounts
            console.log('\n4. Updating existing accounts to link to sample company...');
            const [updateResult] = await db.query(`
                UPDATE contas 
                SET company_id = ? 
                WHERE company_id IS NULL AND project_id = 1
            `, [result.insertId]);
            console.log(`   ✓ Updated ${updateResult.affectedRows} accounts`);
        } else {
            console.log(`   ✓ Sample company already exists with ID: ${existing[0].id}`);

            // Update accounts that don't have a company
            const [updateResult] = await db.query(`
                UPDATE contas 
                SET company_id = ? 
                WHERE company_id IS NULL AND project_id = 1
            `, [existing[0].id]);
            if (updateResult.affectedRows > 0) {
                console.log(`   ✓ Updated ${updateResult.affectedRows} accounts`);
            }
        }

        // Verify migration
        console.log('\n=== Verification ===');
        const [empresas] = await db.query('SELECT * FROM empresas');
        console.log(`Total companies: ${empresas.length}`);

        const [contas] = await db.query('SELECT id, name, company_id FROM contas');
        console.log(`Total accounts: ${contas.length}`);
        console.log(`Accounts with company: ${contas.filter(c => c.company_id).length}`);

        console.log('\n✓ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

migrateEmpresas();
