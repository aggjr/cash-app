const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const API_URL = 'http://localhost:3001/api';

async function verifyBalanceUpdate() {
    let connection;
    try {
        console.log('1. Setting up test data...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

        const [users] = await connection.query('SELECT * FROM users LIMIT 1');
        const [projects] = await connection.query('SELECT id FROM projects LIMIT 1');
        const [companies] = await connection.query('SELECT id FROM empresas LIMIT 1');
        const [types] = await connection.query('SELECT id FROM tipo_entrada LIMIT 1');

        if (!users.length || !projects.length || !companies.length || !types.length) {
            console.error('Missing prerequisites.');
            process.exit(1);
        }

        const user = users[0];
        const projectId = projects[0].id;

        // Generate Token
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
        const token = jwt.sign(
            { id: user.id, email: user.email, currentProject: { id: projectId, name: 'TEST_PROJECT' } },
            JWT_SECRET
        );

        // 2. Create Test Account
        console.log('2. Creating Test Account...');
        const accountData = {
            name: 'TEST_BALANCE_ACCOUNT_' + Date.now(),
            description: 'Test Account',
            projectId: projectId,
            accountType: 'banco',
            initialBalance: 0,
            companyId: companies[0].id
        };

        const createAccountRes = await axios.post(`${API_URL}/accounts`, accountData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const accountId = createAccountRes.data.id;
        console.log(`   Account Created ID: ${accountId}, Balance: ${createAccountRes.data.current_balance}`);

        // Helper to check balance
        const checkBalance = async (expected) => {
            const [rows] = await connection.query('SELECT current_balance FROM contas WHERE id = ?', [accountId]);
            const balance = parseFloat(rows[0].current_balance);
            if (balance === expected) {
                console.log(`   ✅ Balance Verified: ${balance}`);
            } else {
                console.error(`   ❌ Balance Mismatch! Expected ${expected}, got ${balance}`);
                throw new Error('Balance mismatch');
            }
        };

        // 3. Create Income (Value: 100)
        console.log('3. Creating Income (100.00)...');
        const incomeData = {
            dataFato: new Date().toISOString().split('T')[0],
            dataPrevistaPagamento: new Date().toISOString().split('T')[0],
            valor: 100.00,
            descricao: 'Test Income',
            tipoEntradaId: types[0].id,
            companyId: companies[0].id,
            accountId: accountId,
            projectId: projectId
        };

        const createIncomeRes = await axios.post(`${API_URL}/incomes`, incomeData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const incomeId = createIncomeRes.data.id;

        await checkBalance(100.00);

        // 4. Update Income (Value: 150)
        console.log('4. Updating Income (150.00)...');
        await axios.put(`${API_URL}/incomes/${incomeId}`, {
            valor: 150.00,
            // Must provide other required fields or update logic to handle partials better? 
            // My update logic handles partials.
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        await checkBalance(150.00);

        // 5. Delete Income
        console.log('5. Deleting Income...');
        await axios.delete(`${API_URL}/incomes/${incomeId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        await checkBalance(0.00);

        // Cleanup
        console.log('6. Cleaning up...');
        await connection.query('DELETE FROM contas WHERE id = ?', [accountId]);
        // Income is soft deleted, but we can hard delete for test cleanup
        await connection.query('DELETE FROM entradas WHERE id = ?', [incomeId]);

        console.log('✅ All balance tests passed!');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        if (error.response) console.error(error.response.data);
    } finally {
        if (connection) await connection.end();
    }
}

verifyBalanceUpdate();
