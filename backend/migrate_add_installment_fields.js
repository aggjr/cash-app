const db = require('./config/database');

async function addInstallmentFields() {
    let connection;
    try {
        connection = await db.getConnection();

        console.log('🔍 Verificando campos de parcelamento...');

        // Verifica se os campos já existem
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'entradas' 
            AND COLUMN_NAME IN ('installment_group_id', 'installment_number', 'installment_total', 'installment_interval', 'installment_custom_days')
        `);

        if (columns.length === 5) {
            console.log('✅ Todos os campos de parcelamento já existem');
            return;
        }

        console.log('📝 Adicionando campos de parcelamento à tabela entradas...');

        // installment_group_id - UUID para agrupar parcelas
        if (!columns.find(c => c.COLUMN_NAME === 'installment_group_id')) {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN installment_group_id VARCHAR(36) DEFAULT NULL
                AFTER forma_pagamento
            `);
            console.log('✅ Campo installment_group_id adicionado');
        }

        // installment_number - número da parcela (1, 2, 3...)
        if (!columns.find(c => c.COLUMN_NAME === 'installment_number')) {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN installment_number INT DEFAULT NULL
                AFTER installment_group_id
            `);
            console.log('✅ Campo installment_number adicionado');
        }

        // installment_total - total de parcelas
        if (!columns.find(c => c.COLUMN_NAME === 'installment_total')) {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN installment_total INT DEFAULT NULL
                AFTER installment_number
            `);
            console.log('✅ Campo installment_total adicionado');
        }

        // installment_interval - tipo de intervalo (semanal, mensal, etc)
        if (!columns.find(c => c.COLUMN_NAME === 'installment_interval')) {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN installment_interval VARCHAR(20) DEFAULT NULL
                AFTER installment_total
            `);
            console.log('✅ Campo installment_interval adicionado');
        }

        // installment_custom_days - dias customizados (se interval = personalizado)
        if (!columns.find(c => c.COLUMN_NAME === 'installment_custom_days')) {
            await connection.query(`
                ALTER TABLE entradas 
                ADD COLUMN installment_custom_days INT DEFAULT NULL
                AFTER installment_interval
            `);
            console.log('✅ Campo installment_custom_days adicionado');
        }

        // Criar índice para melhor performance nas consultas por grupo
        await connection.query(`
            CREATE INDEX idx_installment_group ON entradas(installment_group_id)
        `).catch(() => {
            console.log('⚠️ Índice idx_installment_group já existe ou erro ao criar');
        });

        console.log('✅ Migração concluída com sucesso!');

        // Verifica o resultado
        const [result] = await connection.query(`
            SHOW COLUMNS FROM entradas WHERE Field LIKE 'installment%'
        `);

        console.log('📊 Campos de parcelamento:', result.map(r => r.Field));

    } catch (error) {
        console.error('❌ Erro ao adicionar campos de parcelamento:', error.message);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// Executa se for chamado diretamente
if (require.main === module) {
    addInstallmentFields()
        .then(() => {
            console.log('✅ Migração concluída!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Erro na migração:', error);
            process.exit(1);
        });
}

module.exports = addInstallmentFields;
