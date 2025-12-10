// Migration script to create despesas table
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateDespesas() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

        console.log('✓ Connected to database');

        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS despesas (
                id INT PRIMARY KEY AUTO_INCREMENT,
                
                -- Date fields
                data_fato DATE NOT NULL COMMENT 'Date when the expense event occurred',
                data_prevista_pagamento DATE NOT NULL COMMENT 'Expected payment date',
                data_real_pagamento DATE NULL COMMENT 'Actual payment date (null if not yet paid)',
                
                -- Amount and description
                valor DECIMAL(15, 2) NOT NULL COMMENT 'Expense amount',
                descricao TEXT NULL COMMENT 'Optional description',
                
                -- Foreign keys
                tipo_despesa_id INT NOT NULL COMMENT 'Reference to expense type',
                company_id INT NOT NULL COMMENT 'Reference to company',
                account_id INT NOT NULL COMMENT 'Reference to account where money will be paid from',
                project_id INT NOT NULL COMMENT 'Reference to project',
                
                -- Status and timestamps
                active BOOLEAN DEFAULT TRUE COMMENT 'Soft delete flag',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                -- Foreign key constraints
                CONSTRAINT fk_despesas_tipo_despesa 
                    FOREIGN KEY (tipo_despesa_id) REFERENCES tipo_despesa(id)
                    ON DELETE RESTRICT,
                
                CONSTRAINT fk_despesas_company 
                    FOREIGN KEY (company_id) REFERENCES empresas(id)
                    ON DELETE RESTRICT,
                
                CONSTRAINT fk_despesas_account 
                    FOREIGN KEY (account_id) REFERENCES contas(id)
                    ON DELETE RESTRICT,
                
                CONSTRAINT fk_despesas_project 
                    FOREIGN KEY (project_id) REFERENCES projects(id)
                    ON DELETE CASCADE,
                
                -- Indexes for better query performance
                INDEX idx_despesas_data_fato (data_fato),
                INDEX idx_despesas_data_prevista (data_prevista_pagamento),
                INDEX idx_despesas_data_real (data_real_pagamento),
                INDEX idx_despesas_tipo (tipo_despesa_id),
                INDEX idx_despesas_company (company_id),
                INDEX idx_despesas_account (account_id),
                INDEX idx_despesas_project (project_id),
                INDEX idx_despesas_active (active)
            )
        `;

        await connection.execute(createTableSQL);
        console.log('✓ Table "despesas" created successfully');

        // Check if table exists and show structure
        const [tables] = await connection.execute("SHOW TABLES LIKE 'despesas'");
        if (tables.length > 0) {
            console.log('✓ Verified: Table "despesas" exists');
            const [columns] = await connection.execute('DESCRIBE despesas');
            console.log('\nTable Structure:');
            console.table(columns);
        }

    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n✓ Database connection closed');
        }
    }
}

migrateDespesas();
