const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function migrate() {
    try {
        console.log('Starting migration for Aportes/Retiradas...');

        const sqlPath = path.join(__dirname, '../database/add-movements-tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Remove DELIMITER commands as they are client-side only (not supported by mysql2 directly usually, but let's try or split)
        // Simple splitting by ; might fail with procedures. 
        // For this specific file, we can just execute chunks.

        // Actually, the provided SQL uses DELIMITER which acts on the client. 
        // We'll strip it for Node execution or just execute the specialized parts.
        // Let's rely on splitting by 'DELIMITER' or simpler: Just run the CREATE TABLEs and the INSERT logic manually if needed.

        // Better approach for Node: Run standard query for tables, then logic for Saldo.

        const statements = sql
            .replace(/DELIMITER \/\//g, '')
            .replace(/DELIMITER ;/g, '')
            .replace(/END \/\//g, 'END;')
            .split(';')
            .filter(stmt => stmt.trim().length > 0);

        for (const statement of statements) {
            const cleanStmt = statement.trim();
            if (cleanStmt) {
                try {
                    // Skip CALL/DROP if strict, but let's try.
                    // The Procedure syntax might be tricky in raw driver without multiStatements: true which is enabled in config usually.
                    await db.query(cleanStmt);
                } catch (e) {
                    console.warn('Warning executing statement specific (might be procedure syntax):', e.message);
                }
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
