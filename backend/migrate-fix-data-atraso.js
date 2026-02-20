const db = require('./config/database');

/**
 * Migração: Corrigir dados de data_atraso nas tabelas financeiras
 *
 * Regras aplicadas:
 *  1. Apagar data_atraso quando ela for <= data_prevista (não houve atraso real)
 *  2. Preencher data_atraso com data_real quando data_real > data_prevista e data_atraso está nula
 */
async function migrateFixDataAtraso() {
    let connection;
    try {
        connection = await db.getConnection();
        console.log('🚀 Iniciando migração: Fix data_atraso...');

        // ─── ENTRADAS ────────────────────────────────────────────────────────────

        // 1a. Limpar data_atraso inválida em entradas (data_atraso <= data_prevista_recebimento)
        try {
            const [r1] = await connection.query(`
                UPDATE entradas
                SET data_atraso = NULL
                WHERE data_atraso IS NOT NULL
                  AND data_prevista_recebimento IS NOT NULL
                  AND data_atraso <= data_prevista_recebimento
            `);
            console.log(`✅ entradas: ${r1.affectedRows} registro(s) com data_atraso inválida zerado(s)`);
        } catch (e) {
            console.warn('⚠️ Erro ao limpar data_atraso em entradas:', e.message);
        }

        // 1b. Preencher data_atraso para entradas com atraso real não registrado
        try {
            const [r2] = await connection.query(`
                UPDATE entradas
                SET data_atraso = data_real_recebimento
                WHERE data_atraso IS NULL
                  AND data_real_recebimento IS NOT NULL
                  AND data_prevista_recebimento IS NOT NULL
                  AND data_real_recebimento > data_prevista_recebimento
            `);
            console.log(`✅ entradas: ${r2.affectedRows} registro(s) com data_atraso preenchida automaticamente`);
        } catch (e) {
            console.warn('⚠️ Erro ao preencher data_atraso em entradas:', e.message);
        }

        // ─── SAIDAS ──────────────────────────────────────────────────────────────

        // 2a. Limpar data_atraso inválida em saidas (data_atraso <= data_prevista_pagamento)
        try {
            const [r3] = await connection.query(`
                UPDATE saidas
                SET data_atraso = NULL
                WHERE data_atraso IS NOT NULL
                  AND data_prevista_pagamento IS NOT NULL
                  AND data_atraso <= data_prevista_pagamento
            `);
            console.log(`✅ saidas: ${r3.affectedRows} registro(s) com data_atraso inválida zerado(s)`);
        } catch (e) {
            console.warn('⚠️ Erro ao limpar data_atraso em saidas:', e.message);
        }

        // 2b. Preencher data_atraso para saidas com atraso real não registrado
        try {
            const [r4] = await connection.query(`
                UPDATE saidas
                SET data_atraso = data_real_pagamento
                WHERE data_atraso IS NULL
                  AND data_real_pagamento IS NOT NULL
                  AND data_prevista_pagamento IS NOT NULL
                  AND data_real_pagamento > data_prevista_pagamento
            `);
            console.log(`✅ saidas: ${r4.affectedRows} registro(s) com data_atraso preenchida automaticamente`);
        } catch (e) {
            console.warn('⚠️ Erro ao preencher data_atraso em saidas:', e.message);
        }

        // ─── PRODUCAO_REVENDA ─────────────────────────────────────────────────────

        // 3a. Limpar data_prevista_atraso inválida em producao_revenda
        try {
            const [r5] = await connection.query(`
                UPDATE producao_revenda
                SET data_prevista_atraso = NULL
                WHERE data_prevista_atraso IS NOT NULL
                  AND data_prevista_pagamento IS NOT NULL
                  AND data_prevista_atraso <= data_prevista_pagamento
            `);
            console.log(`✅ producao_revenda: ${r5.affectedRows} registro(s) com data_prevista_atraso inválida zerado(s)`);
        } catch (e) {
            console.warn('⚠️ Erro ao limpar data_prevista_atraso em producao_revenda:', e.message);
        }

        // 3b. Preencher data_prevista_atraso para producao_revenda com atraso real não registrado
        try {
            const [r6] = await connection.query(`
                UPDATE producao_revenda
                SET data_prevista_atraso = data_real_pagamento
                WHERE data_prevista_atraso IS NULL
                  AND data_real_pagamento IS NOT NULL
                  AND data_prevista_pagamento IS NOT NULL
                  AND data_real_pagamento > data_prevista_pagamento
            `);
            console.log(`✅ producao_revenda: ${r6.affectedRows} registro(s) com data_prevista_atraso preenchida automaticamente`);
        } catch (e) {
            console.warn('⚠️ Erro ao preencher data_prevista_atraso em producao_revenda:', e.message);
        }

        console.log('✅ Migração Fix data_atraso concluída.');

    } catch (error) {
        console.error('❌ Migração Fix data_atraso falhou:', error);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = migrateFixDataAtraso;
