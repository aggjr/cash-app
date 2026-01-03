require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const BACKUP_DIR = path.join(__dirname, '..', 'database', 'backups');

// Função para pedir input
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

async function backupProduction() {
    console.log('=== BACKUP DO BANCO DE PRODUÇÃO ===');
    console.log('');
    console.log('⚠️  Este script vai conectar ao banco de PRODUÇÃO do Easypanel');
    console.log('');

    // Pedir credenciais
    const host = await askQuestion('Host de produção (IP ou domínio): ');
    const port = await askQuestion('Porta (pressione Enter para 3306): ') || '3306';
    const user = await askQuestion('Usuário do banco: ');
    const password = await askQuestion('Senha do banco: ');
    const database = await askQuestion('Nome do banco (pressione Enter para "cash"): ') || 'cash';

    console.log('');
    console.log('Conectando ao banco de produção...');

    try {
        // Conectar ao banco de produção
        const connection = await mysql.createConnection({
            host: host,
            port: parseInt(port),
            user: user,
            password: password,
            database: database
        });

        console.log('✅ Conectado com sucesso!');
        console.log('');

        // Generate timestamp
        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/T/, '_')
            .replace(/\..+/, '')
            .replace(/:/g, '-');

        // Start SQL
        let sql = `-- PRODUCTION Database Backup
-- Generated: ${now.toISOString()}
-- Database: ${database}
-- Host: ${host}
-- Baseline: v1.0.0-export-features

SET FOREIGN_KEY_CHECKS=0;

`;

        // Get all tables
        console.log('Fetching tables...');
        const [tables] = await connection.query('SHOW TABLES');
        const tableNames = tables.map(row => Object.values(row)[0]);

        console.log(`Found ${tableNames.length} tables to backup`);
        console.log('');

        // Export each table
        for (const tableName of tableNames) {
            process.stdout.write(`  ${tableName.padEnd(30)} ... `);

            const [createResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createStatement = createResult[0]['Create Table'];

            sql += `-- ============================================\n`;
            sql += `-- Table: ${tableName}\n`;
            sql += `-- ============================================\n`;
            sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            sql += createStatement + ';\n\n';

            console.log('✓');
        }

        sql += 'SET FOREIGN_KEY_CHECKS=1;\n';

        // Close connection
        await connection.end();

        // Ensure backup dir exists
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        // Write files
        const filename = `PRODUCTION_backup_${timestamp}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);

        await fs.writeFile(filepath, sql, 'utf8');

        const latestPath = path.join(BACKUP_DIR, 'PRODUCTION_latest.sql');
        await fs.writeFile(latestPath, sql, 'utf8');

        console.log('');
        console.log('✅ BACKUP DE PRODUÇÃO COMPLETO!');
        console.log('');
        console.log(`📁 Timestamped: ${filepath}`);
        console.log(`📌 Latest:      ${latestPath}`);
        console.log(`📊 Size:        ${(sql.length / 1024).toFixed(2)} KB`);
        console.log(`📋 Tables:      ${tableNames.length}`);
        console.log('');
        console.log('💡 Este backup pode ser usado para rollback se necessário');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ Backup failed:');
        console.error(error.message);
        if (error.code) console.error(`Code: ${error.code}`);
        console.error('');
        console.error('💡 Dicas:');
        console.error('  - Verifique se o host/porta está correto');
        console.error('  - Verifique se o MySQL está acessível externamente');
        console.error('  - Verifique usuário e senha');
        console.error('');
        process.exit(1);
    }
}

backupProduction();
