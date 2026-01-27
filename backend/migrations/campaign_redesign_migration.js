const db = require('../config/database');

/**
 * Script de migração automática para aplicar todas as alterações do redesign de campanhas
 * Pode ser executado via endpoint POST /marketing/campanhas/apply-redesign-migration
 */

async function applyRedesignMigration() {
    const results = {
        success: true,
        steps: [],
        errors: []
    };

    try {
        console.log('🚀 Iniciando migração automática do redesign de campanhas...');

        // Step 1: Add dispatch_interval_seconds column
        try {
            console.log('📊 Step 1: Verificando coluna dispatch_interval_seconds...');

            const [columns] = await db.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'campanhas' 
                  AND COLUMN_NAME = 'dispatch_interval_seconds'
            `);

            if (columns.length === 0) {
                await db.query(`
                    ALTER TABLE campanhas 
                    ADD COLUMN dispatch_interval_seconds INT DEFAULT 120 
                    AFTER status
                `);
                results.steps.push('✅ Coluna dispatch_interval_seconds adicionada');
                console.log('✅ Coluna dispatch_interval_seconds adicionada');
            } else {
                results.steps.push('ℹ️ Coluna dispatch_interval_seconds já existe');
                console.log('ℹ️ Coluna dispatch_interval_seconds já existe');
            }
        } catch (error) {
            results.errors.push(`Erro ao adicionar coluna: ${error.message}`);
            console.error('❌ Erro ao adicionar coluna:', error);
        }

        // Step 2: Verify status_email and status_whatsapp columns
        try {
            console.log('📊 Step 2: Verificando colunas de status...');

            const [emailCol] = await db.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'leads_campanhas' 
                  AND COLUMN_NAME = 'status_email'
            `);

            const [whatsappCol] = await db.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'leads_campanhas' 
                  AND COLUMN_NAME = 'status_whatsapp'
            `);

            if (emailCol.length === 0) {
                await db.query(`
                    ALTER TABLE leads_campanhas 
                    ADD COLUMN status_email VARCHAR(50) DEFAULT 'pendente' 
                    AFTER status
                `);
                results.steps.push('✅ Coluna status_email adicionada');
            } else {
                results.steps.push('ℹ️ Coluna status_email já existe');
            }

            if (whatsappCol.length === 0) {
                await db.query(`
                    ALTER TABLE leads_campanhas 
                    ADD COLUMN status_whatsapp VARCHAR(50) DEFAULT 'pendente' 
                    AFTER status_email
                `);
                results.steps.push('✅ Coluna status_whatsapp adicionada');
            } else {
                results.steps.push('ℹ️ Coluna status_whatsapp já existe');
            }

            console.log('✅ Colunas de status verificadas');
        } catch (error) {
            results.errors.push(`Erro ao verificar colunas de status: ${error.message}`);
            console.error('❌ Erro ao verificar colunas de status:', error);
        }

        // Step 3: Update existing campaigns with default interval
        try {
            console.log('📊 Step 3: Atualizando campanhas existentes...');

            const [updateResult] = await db.query(`
                UPDATE campanhas 
                SET dispatch_interval_seconds = 120 
                WHERE dispatch_interval_seconds IS NULL
            `);

            if (updateResult.affectedRows > 0) {
                results.steps.push(`✅ ${updateResult.affectedRows} campanhas atualizadas com intervalo padrão`);
                console.log(`✅ ${updateResult.affectedRows} campanhas atualizadas`);
            } else {
                results.steps.push('ℹ️ Nenhuma campanha precisou ser atualizada');
            }
        } catch (error) {
            results.errors.push(`Erro ao atualizar campanhas: ${error.message}`);
            console.error('❌ Erro ao atualizar campanhas:', error);
        }

        console.log('✅ Migração concluída com sucesso!');
        results.steps.push('🎉 Migração concluída!');

    } catch (error) {
        results.success = false;
        results.errors.push(`Erro geral: ${error.message}`);
        console.error('❌ Erro na migração:', error);
    }

    return results;
}

module.exports = { applyRedesignMigration };
