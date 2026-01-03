const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Creating retiradas table...');
        // Note: Copy-paste error in log message above, but code relates to transferencias below. fixing log.
        console.log('Creating transferencias table...');

        const query = `
            CREATE TABLE IF NOT EXISTS transferencias (
                id INT PRIMARY KEY AUTO_INCREMENT,
                data_fato DATE NOT NULL,
                data_real DATE NULL,
                valor DECIMAL(15, 2) NOT NULL,
                descricao TEXT NULL,
                
                source_account_id INT NOT NULL,
                destination_account_id INT NOT NULL,
                project_id INT NOT NULL,
                
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                CONSTRAINT fk_transf_source FOREIGN KEY (source_account_id) REFERENCES contas(id),
                CONSTRAINT fk_transf_dest FOREIGN KEY (destination_account_id) REFERENCES contas(id),
                CONSTRAINT fk_transf_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                
                INDEX idx_transf_project (project_id),
                INDEX idx_transf_dates (data_fato)
            );
        `;

        await connection.query(query);
        console.log('Table transferencias created or already exists.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
