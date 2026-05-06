const db = require('./config/database');

async function migrate() {
    let connection;
    try {
        connection = await db.getConnection();
        try {
            await connection.query(`ALTER TABLE producao_revenda ADD COLUMN boleto_url VARCHAR(255) DEFAULT NULL;`);
            console.log('Column boleto_url added successfully.');
        } catch (e) {
            console.log('boleto_url might already exist: ' + e.message);
        }
        
        try {
            await connection.query(`ALTER TABLE producao_revenda ADD COLUMN comprovante_url VARCHAR(255) DEFAULT NULL;`);
            console.log('Column comprovante_url added successfully.');
        } catch (e) {
            console.log('comprovante_url might already exist: ' + e.message);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

migrate();
