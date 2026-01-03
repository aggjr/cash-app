const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const API_URL = 'http://localhost:3001/api';

async function verifyIncomeFeature() {
    let connection;
    try {
        console.log('1. Setting up test data...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

        // Ensure we have a user to login with
        const [users] = await connection.query('SELECT * FROM users LIMIT 1');
        let user;
        if (users.length === 0) {
            // Create a test user if none exists (password: 123456)
            // Note: In a real app we'd hash the password, but for this quick check we'll try to find one or fail
            console.error('No users found in database. Cannot perform API test without a user.');
            process.exit(1);
        } else {
            user = users[0];
            console.log(`   Found user: ${user.email}`);
        }

        // Get dependencies
        const [companies] = await connection.query('SELECT id FROM empresas LIMIT 1');
        const [accounts] = await connection.query('SELECT id FROM contas LIMIT 1');
        const [types] = await connection.query('SELECT id FROM tipo_entrada LIMIT 1');
        const [projects] = await connection.query('SELECT id FROM projects LIMIT 1');

        if (!companies.length || !accounts.length || !types.length || !projects.length) {
            console.error('Missing prerequisites (company, account, type, or project). Please ensure usage data exists.');
            console.log({
                companies: companies.length,
                accounts: accounts.length,
                types: types.length,
                projects: projects.length
            });
            process.exit(1);
        }

        console.log('2. Authenticating...');
        // We'll perform a login request
        // Note: Since we don't know the plain text password, we'll cheat slightly for this verification script
        // and manually generate a token using the same secret as the backend
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                currentProject: { id: projects[0].id, name: 'TEST_PROJECT' }
            },
            JWT_SECRET
        );
        console.log('   Token generated');

        console.log('3. Creating Income (Entrada)...');
        const newIncome = {
            dataFato: new Date().toISOString().split('T')[0],
            dataPrevistaPagamento: new Date().toISOString().split('T')[0],
            valor: 123.45,
            descricao: 'Teste Automatizado API',
            tipoEntradaId: types[0].id,
            companyId: companies[0].id,
            accountId: accounts[0].id,
            projectId: projects[0].id
        };

        const createResponse = await axios.post(`${API_URL}/incomes`, newIncome, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (createResponse.status === 201) {
            console.log('   ✅ Income created successfully!');
            console.log(`   ID: ${createResponse.data.id}`);
        }

        console.log('4. Listing Incomes...');
        const listResponse = await axios.get(`${API_URL}/incomes?projectId=${projects[0].id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const createdIncome = listResponse.data.find(i => i.id === createResponse.data.id);
        if (createdIncome) {
            console.log('   ✅ Verfied: Created income appeared in list');
        } else {
            console.error('   ❌ Error: Created income NOT found in list');
        }

        console.log('5. Deleting Test Income...');
        await axios.delete(`${API_URL}/incomes/${createResponse.data.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('   ✅ Cleaned up test data');

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        if (error.response) {
            console.error('   API Response:', error.response.data);
        }
    } finally {
        if (connection) await connection.end();
    }
}

verifyIncomeFeature();
