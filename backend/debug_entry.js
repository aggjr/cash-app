const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Manual .env parser
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '.env');
        if (!fs.existsSync(envPath)) return;
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, ...values] = line.split('=');
            if (key && values.length > 0) {
                const val = values.join('=').trim().replace(/^["']|["']$/g, ''); // Remove quotes
                if (!process.env[key.trim()]) {
                    process.env[key.trim()] = val;
                }
            }
        });
    } catch (e) {
        console.error('Error loading .env', e);
    }
}

loadEnv();

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'cash_db',
    port: process.env.DB_PORT || 3306
};

async function findGhostEntry() {
    let connection;
    try {
        console.log('🔌 Connecting to DB:', dbConfig.host, dbConfig.database);
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected.');

        console.log('🔍 Searching for entries with value 44000...');

        // 1. Search in ENTRADAS
        const [entradas] = await connection.query(`
            SELECT 
                id, 
                descricao, 
                valor, 
                data_prevista_recebimento, 
                data_real_recebimento, 
                data_atraso,
                active, 
                project_id, 
                company_id, 
                tipo_entrada_id,
                created_at,
                installment_group_id,
                installment_number 
            FROM entradas 
            WHERE valor = 44000
        `);

        if (entradas.length > 0) {
            console.log('\n✅ Found in ENTRADAS:');
            console.table(entradas);
        } else {
            console.log('\n❌ Not found in ENTRADAS.');
        }

        // 2. Search in SAIDAS
        const [saidas] = await connection.query(`
            SELECT 
                id, 
                descricao, 
                valor, 
                active, 
                project_id,
                data_prevista_pagamento
            FROM saidas 
            WHERE valor = 44000
        `);

        if (saidas.length > 0) {
            console.log('\n⚠️ Found in SAIDAS:');
            console.table(saidas);
        }

        // 3. Search in APORTES
        const [aportes] = await connection.query(`SELECT id, valor, active, data_fato FROM aportes WHERE valor = 44000`);
        if (aportes.length > 0) {
            console.log('\nFound in APORTES:');
            console.table(aportes);
        }

        // 4. Search in RETIRADAS
        const [retiradas] = await connection.query(`SELECT id, valor, active, data_prevista FROM retiradas WHERE valor = 44000`);
        if (retiradas.length > 0) {
            console.log('\nFound in RETIRADAS:');
            console.table(retiradas);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
}

findGhostEntry();
