// run_migration.js
// Script standalone para executar a migração do redesign de campanhas
// Execute: node run_migration.js

const mysql = require('mysql2/promise');

async function runMigration() {
    let connection;

    try {
        // Conectar ao banco de dados
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'cash'
        });

        console.log('✅ Conectado ao banco de dados');
        console.log('🚀 Iniciando migração do redesign de campanhas...\n');

        // Step 1: Add dispatch_interval_seconds column
        console.log('📊 Step 1: Verificando coluna dispatch_interval_seconds...');

        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'campanhas' 
              AND COLUMN_NAME = 'dispatch_interval_seconds'
        `);

        if (columns.length === 0) {
            await connection.query(`
                ALTER TABLE campanhas 
                ADD COLUMN dispatch_interval_seconds INT DEFAULT 120 
                AFTER status
            `);
            console.log('✅ Coluna dispatch_interval_seconds adicionada');
        } else {
            console.log('ℹ️  Coluna dispatch_interval_seconds já existe');
        }

        // Step 2: Verify status_email and status_whatsapp columns
        console.log('\n📊 Step 2: Verificando colunas de status...');

        const [emailCol] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'leads_campanhas' 
              AND COLUMN_NAME = 'status_email'
        `);

        const [whatsappCol] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'leads_campanhas' 
              AND COLUMN_NAME = 'status_whatsapp'
        `);

        if (emailCol.length === 0) {
            await connection.query(`
                ALTER TABLE leads_campanhas 
                ADD COLUMN status_email VARCHAR(50) DEFAULT 'pendente' 
                AFTER status
            `);
            console.log('✅ Coluna status_email adicionada');
        } else {
            console.log('ℹ️  Coluna status_email já existe');
        }

        if (whatsappCol.length === 0) {
            await connection.query(`
                ALTER TABLE leads_campanhas 
                ADD COLUMN status_whatsapp VARCHAR(50) DEFAULT 'pendente' 
                AFTER status_email
            `);
            console.log('✅ Coluna status_whatsapp adicionada');
        } else {
            console.log('ℹ️  Coluna status_whatsapp já existe');
        }

        // Step 3: Update existing campaigns with default interval
        console.log('\n📊 Step 3: Atualizando campanhas existentes...');

        const [updateResult] = await connection.query(`
            UPDATE campanhas 
            SET dispatch_interval_seconds = 120 
            WHERE dispatch_interval_seconds IS NULL
        `);

        if (updateResult.affectedRows > 0) {
            console.log(`✅ ${updateResult.affectedRows} campanhas atualizadas com intervalo padrão`);
        } else {
            console.log('ℹ️  Nenhuma campanha precisou ser atualizada');
        }

        console.log('\n🎉 Migração concluída com sucesso!');

    } catch (error) {
        console.error('\n❌ Erro na migração:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n✅ Conexão com banco de dados fechada');
        }
    }
}

// Executar migração
runMigration();
