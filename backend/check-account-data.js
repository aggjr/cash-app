const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkAccountData() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('=== CHECKING ACCOUNT DATA ===\n');

        // Get all accounts
        const [accounts] = await connection.query('SELECT id, name, initial_balance, company_id FROM contas WHERE active = 1');
        console.log('Active Accounts:');
        accounts.forEach(acc => {
            console.log(`  ID: ${acc.id}, Name: ${acc.name}, Initial Balance: ${acc.initial_balance}, Company: ${acc.company_id}`);
        });
        console.log('');

        // For each account, check transactions before a specific date
        const testDate = '2025-11-08'; // November 8, 2025

        for (const acc of accounts) {
            console.log(`--- Account: ${acc.name} (ID: ${acc.id}) ---`);
            console.log(`Opening Balance: ${acc.initial_balance || 0}`);

            // Check aportes before test date
            const [aportes] = await connection.query(
                'SELECT data_real, valor, descricao FROM aportes WHERE account_id = ? AND data_real < ? AND active = 1 ORDER BY data_real',
                [acc.id, testDate]
            );
            if (aportes.length > 0) {
                console.log(`Aportes before ${testDate}:`);
                aportes.forEach(a => console.log(`  ${a.data_real}: ${a.valor} - ${a.descricao}`));
            }

            // Check entradas before test date
            const [entradas] = await connection.query(
                'SELECT data_real_recebimento, valor, descricao FROM entradas WHERE account_id = ? AND data_real_recebimento < ? AND active = 1 ORDER BY data_real_recebimento',
                [acc.id, testDate]
            );
            if (entradas.length > 0) {
                console.log(`Entradas before ${testDate}:`);
                entradas.forEach(e => console.log(`  ${e.data_real_recebimento}: ${e.valor} - ${e.descricao}`));
            }

            // Check saidas before test date
            const [saidas] = await connection.query(
                'SELECT data_real_pagamento, valor, descricao FROM saidas WHERE account_id = ? AND data_real_pagamento < ? AND active = 1 ORDER BY data_real_pagamento',
                [acc.id, testDate]
            );
            if (saidas.length > 0) {
                console.log(`Saidas before ${testDate}:`);
                saidas.forEach(s => console.log(`  ${s.data_real_pagamento}: ${s.valor} - ${s.descricao}`));
            }

            // Calculate expected initial balance
            const totalAportes = aportes.reduce((sum, a) => sum + parseFloat(a.valor || 0), 0);
            const totalEntradas = entradas.reduce((sum, e) => sum + parseFloat(e.valor || 0), 0);
            const totalSaidas = saidas.reduce((sum, s) => sum + parseFloat(s.valor || 0), 0);
            const expectedInitial = parseFloat(acc.initial_balance || 0) + totalAportes + totalEntradas - totalSaidas;

            console.log(`Expected Initial Balance for ${testDate}: ${expectedInitial}`);
            console.log(`  = Opening (${acc.initial_balance || 0}) + Aportes (${totalAportes}) + Entradas (${totalEntradas}) - Saidas (${totalSaidas})`);
            console.log('');
        }

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await connection.end();
    }
}

checkAccountData();
