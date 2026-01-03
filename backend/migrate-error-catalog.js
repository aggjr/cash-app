const db = require('./config/database');

async function migrate() {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        console.log('Creating error_catalog table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS error_catalog (
                code VARCHAR(20) PRIMARY KEY,
                http_status INT NOT NULL,
                message TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        console.log('Seeding error codes...');
        const errors = [
            // Auth Errors
            ['AUTH-001', 401, 'Acesso negado. Token não fornecido.', 'Missing token'],
            ['AUTH-002', 401, 'Token inválido ou expirado.', 'Invalid token'],
            ['AUTH-003', 400, 'Credenciais inválidas.', 'Login failed'],
            ['AUTH-004', 403, 'Você não tem permissão para realizar esta ação.', 'Forbidden'],

            // Validation Errors
            ['VAL-001', 400, 'Dados inválidos.', 'Generic validation error'],
            ['VAL-002', 400, 'Campos obrigatórios ausentes.', 'Missing required fields'],
            ['VAL-003', 400, 'Formato de e-mail inválido.', 'Invalid email'],
            ['VAL-004', 400, 'A senha deve ter no mínimo 8 caracteres.', 'Password too short'],
            ['VAL-005', 400, 'CNPJ inválido.', 'Invalid CNPJ'],

            // Resource Errors
            ['RES-001', 404, 'Recurso não encontrado.', 'Not found'],
            ['RES-002', 409, 'Este registro já existe.', 'Duplicate entry'],
            ['RES-003', 400, 'Não é possível excluir este registro pois existem dependências.', 'Constraint violation'],

            // Server Errors
            ['SYS-001', 500, 'Erro interno do servidor.', 'Internal server error'],
            ['DB-001', 500, 'Erro de conexão com o banco de dados.', 'Database connection error']
        ];

        for (const err of errors) {
            await connection.query(`
                INSERT INTO error_catalog (code, http_status, message, description)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE http_status = VALUES(http_status), message = VALUES(message), description = VALUES(description)
            `, err);
        }

        await connection.commit();
        console.log('Migration completed successfully.');
        process.exit(0);

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

migrate();
