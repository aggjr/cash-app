// Migration to DROP and recreate all base tables with correct structure
require('dotenv').config();
const db = require('./config/database');

async function run() {
    try {
        console.log('🔄 Recreating Base Tables with Correct Structure...');

        // Drop existing tables in reverse order (to avoid FK constraints)
        console.log('Dropping existing tables...');
        const tablesToDrop = [
            'despesas',
            'retiradas',
            'aportes',
            'producao_revenda',
            'entradas',
            'tipo_despesa',
            'tipo_producao_revenda',
            'tipo_entrada'
        ];

        for (const table of tablesToDrop) {
            try {
                await db.query(`DROP TABLE IF EXISTS ${table}`);
                console.log(`  ✓ Dropped ${table}`);
            } catch (error) {
                console.log(`  - Could not drop ${table}: ${error.message}`);
            }
        }

        // 1. Create tipo_entrada table (Tree Structure)
        console.log('\nCreating tipo_entrada table...');
        await db.query(`
            CREATE TABLE tipo_entrada (
                id INT AUTO_INCREMENT PRIMARY KEY,
                label VARCHAR(255) NOT NULL,
                parent_id INT NULL,
                ordem INT DEFAULT 0,
                expanded BOOLEAN DEFAULT TRUE,
                active BOOLEAN DEFAULT TRUE,
                project_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES tipo_entrada(id) ON DELETE CASCADE
            )
        `);
        console.log('  ✓ Created tipo_entrada');

        // 2. Create tipo_producao_revenda table (Tree Structure)
        console.log('Creating tipo_producao_revenda table...');
        await db.query(`
            CREATE TABLE tipo_producao_revenda (
                id INT AUTO_INCREMENT PRIMARY KEY,
                label VARCHAR(255) NOT NULL,
                parent_id INT NULL,
                ordem INT DEFAULT 0,
                expanded BOOLEAN DEFAULT TRUE,
                active BOOLEAN DEFAULT TRUE,
                project_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES tipo_producao_revenda(id) ON DELETE CASCADE
            )
        `);
        console.log('  ✓ Created tipo_producao_revenda');

        // 3. Create tipo_despesa table (Tree Structure)
        console.log('Creating tipo_despesa table...');
        await db.query(`
            CREATE TABLE tipo_despesa (
                id INT AUTO_INCREMENT PRIMARY KEY,
                label VARCHAR(255) NOT NULL,
                parent_id INT NULL,
                ordem INT DEFAULT 0,
                expanded BOOLEAN DEFAULT TRUE,
                active BOOLEAN DEFAULT TRUE,
                project_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES tipo_despesa(id) ON DELETE CASCADE
            )
        `);
        console.log('  ✓ Created tipo_despesa');

        // 4. Create entradas table
        console.log('Creating entradas table...');
        await db.query(`
            CREATE TABLE entradas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                tipo_entrada_id INT NOT NULL,
                account_id INT,
                description VARCHAR(255),
                value DECIMAL(15,2) NOT NULL,
                date DATE NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tipo_entrada_id) REFERENCES tipo_entrada(id) ON DELETE RESTRICT
            )
        `);
        console.log('  ✓ Created entradas');

        // 5. Create producao_revenda table
        console.log('Creating producao_revenda table...');
        await db.query(`
            CREATE TABLE producao_revenda (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                tipo_id INT NOT NULL,
                account_id INT,
                description VARCHAR(255),
                value DECIMAL(15,2) NOT NULL,
                date DATE NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tipo_id) REFERENCES tipo_producao_revenda(id) ON DELETE RESTRICT
            )
        `);
        console.log('  ✓ Created producao_revenda');

        // 6. Create despesas table
        console.log('Creating despesas table...');
        await db.query(`
            CREATE TABLE despesas (
                id INT PRIMARY KEY AUTO_INCREMENT,
                data_fato DATE NOT NULL,
                data_prevista_pagamento DATE NOT NULL,
                data_real_pagamento DATE NULL,
                valor DECIMAL(15, 2) NOT NULL,
                descricao TEXT NULL,
                tipo_despesa_id INT NOT NULL,
                company_id INT NOT NULL,
                account_id INT NOT NULL,
                project_id INT NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (tipo_despesa_id) REFERENCES tipo_despesa(id) ON DELETE RESTRICT
            )
        `);
        console.log('  ✓ Created despesas');

        // 7. Create aportes table
        console.log('Creating aportes table...');
        await db.query(`
            CREATE TABLE aportes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                account_id INT,
                description VARCHAR(255),
                value DECIMAL(15,2) NOT NULL,
                date DATE NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ Created aportes');

        // 8. Create retiradas table
        console.log('Creating retiradas table...');
        await db.query(`
            CREATE TABLE retiradas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                account_id INT,
                description VARCHAR(255),
                value DECIMAL(15,2) NOT NULL,
                date DATE NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ Created retiradas');

        console.log('\n✅ All base tables recreated successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

run();
