const db = require('./config/database');

async function migrateLoans() {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Create 'loans' table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS loans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                company_id INT NOT NULL, -- Lender (Bank/Supplier)
                description VARCHAR(255) NOT NULL,
                principal_value DECIMAL(15,2) NOT NULL, -- Valor Tomado (Entrada)
                total_value DECIMAL(15,2) NOT NULL, -- Valor Total a Pagar (Soma das Saídas)
                interest_rate DECIMAL(10,4), -- Taxa de Juros (Referência)
                contract_date DATE NOT NULL,
                number_of_installments INT NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (company_id) REFERENCES empresas(id)
            )
        `);
        console.log('Created loans table.');

        // 2. Add 'loan_id' to 'entradas' (Tracking the capital entry)
        // Check if column exists first
        const [entradasCols] = await connection.query("SHOW COLUMNS FROM entradas LIKE 'loan_id'");
        if (entradasCols.length === 0) {
            await connection.query(`
                ALTER TABLE entradas
                ADD COLUMN loan_id INT DEFAULT NULL,
                ADD FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE SET NULL
            `);
            console.log('Added loan_id to entradas.');
        }

        // 3. Add 'loan_id' to 'saidas' (Tracking the repayments)
        const [saidasCols] = await connection.query("SHOW COLUMNS FROM saidas LIKE 'loan_id'");
        if (saidasCols.length === 0) {
            await connection.query(`
                ALTER TABLE saidas
                ADD COLUMN loan_id INT DEFAULT NULL,
                ADD FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE SET NULL
            `);
            console.log('Added loan_id to saidas.');
        }

        await connection.commit();
        console.log('Migration Loans completed successfully.');

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Migration Loans failed:', error);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateLoans;
