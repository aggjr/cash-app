const db = require('./config/database');

const tableExists = async (connection, table) => {
    const [rows] = await connection.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table]
    );
    return rows.length > 0;
};

const columnExists = async (connection, table, column) => {
    const [rows] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return rows.length > 0;
};

/**
 * Suppliers ("fornecedores").
 *
 * A product (a node of tipo_producao_revenda) has one main supplier and any number of
 * secondary ones, kept in produto_fornecedores. The supplier that actually sold the
 * item is decided at purchase time, so producao_revenda carries its own fornecedor_id
 * and that is what the lists and reports read.
 */
async function migrateAddFornecedores() {
    let connection;
    try {
        connection = await db.pool.getConnection();

        if (!(await tableExists(connection, 'fornecedores'))) {
            console.log('🔄 Creating fornecedores table...');
            await connection.query(`
                CREATE TABLE fornecedores (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    cnpj VARCHAR(20) DEFAULT NULL,
                    contato VARCHAR(255) DEFAULT NULL,
                    telefone VARCHAR(50) DEFAULT NULL,
                    email VARCHAR(255) DEFAULT NULL,
                    observacoes TEXT,
                    project_id INT NOT NULL,
                    active TINYINT(1) DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_fornecedores_project (project_id),
                    CONSTRAINT fk_fornecedores_project FOREIGN KEY (project_id) REFERENCES projects(id)
                )
            `);
            console.log('✅ fornecedores table created.');
        } else {
            console.log('✅ fornecedores table already exists, skipping.');
        }

        if (!(await tableExists(connection, 'produto_fornecedores'))) {
            console.log('🔄 Creating produto_fornecedores table...');
            await connection.query(`
                CREATE TABLE produto_fornecedores (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tipo_id INT NOT NULL,
                    fornecedor_id INT NOT NULL,
                    principal TINYINT(1) NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_produto_fornecedor (tipo_id, fornecedor_id),
                    INDEX idx_produto_fornecedores_fornecedor (fornecedor_id),
                    CONSTRAINT fk_produto_fornecedores_tipo
                        FOREIGN KEY (tipo_id) REFERENCES tipo_producao_revenda(id) ON DELETE CASCADE,
                    CONSTRAINT fk_produto_fornecedores_fornecedor
                        FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE CASCADE
                )
            `);
            console.log('✅ produto_fornecedores table created.');
        } else {
            console.log('✅ produto_fornecedores table already exists, skipping.');
        }

        if (!(await columnExists(connection, 'producao_revenda', 'fornecedor_id'))) {
            console.log('🔄 Adding fornecedor_id column to producao_revenda...');
            await connection.query('ALTER TABLE producao_revenda ADD COLUMN fornecedor_id INT DEFAULT NULL');
            await connection.query(`
                ALTER TABLE producao_revenda
                ADD CONSTRAINT fk_producao_revenda_fornecedor
                FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL
            `);
            console.log('✅ fornecedor_id column added to producao_revenda.');
        } else {
            console.log('✅ fornecedor_id column already exists on producao_revenda, skipping.');
        }

    } catch (error) {
        console.error('❌ Migration failed (fornecedores):', error);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateAddFornecedores;
