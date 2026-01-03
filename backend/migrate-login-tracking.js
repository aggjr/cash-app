const db = require('./config/database');
const fs = require('fs');
const path = require('path');

async function migrate() {
    let connection;
    try {
        const sqlPath = path.join(__dirname, '../database/add-login-tracking.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying migration:', sqlPath);

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Split by semicolon to handle multiple statements if any, though simple exec might work for some drivers
        // For mysql2 query(), multiple statements need 'multipleStatements: true' in config or separate calls.
        // We'll split manually to be safe.
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

        for (const statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.substring(0, 50) + '...');
                await connection.query(statement);
            }
        }

        await connection.commit();
        console.log('Migration applied successfully.');
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
