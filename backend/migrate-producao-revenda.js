const db = require('./config/database');
const fs = require('fs');
const path = require('path');

async function migrate() {
    let connection;
    try {
        const sqlPath = path.join(__dirname, '../database/add-producao-revenda-table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying migration:', sqlPath);

        connection = await db.getConnection();
        await connection.beginTransaction();

        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

        for (const statement of statements) {
            if (statement.trim()) {
                await connection.query(statement);
            }
        }

        await connection.commit();
        console.log('Migration produced successfuly.');
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
