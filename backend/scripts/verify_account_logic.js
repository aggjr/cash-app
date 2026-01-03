const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
const PROJECT_ID = 1;
const TIPO_ENTRADA_ID = 1;
const COMPANY_ID = 1;

async function runTests() {
    try {
        console.log('--- Starting Verification ---');

        // 0. Login
        console.log('Authenticating...');
        let token;
        try {
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                email: 'admin@cash.com',
                password: 'password'
            });
            token = loginRes.data.token;
            console.log('Login successful.');
            // Set default headers
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } catch (e) {
            // Try another password?
            try {
                const loginRes2 = await axios.post(`${API_URL}/auth/login`, { email: 'admin@cash.com', password: '123456' });
                token = loginRes2.data.token;
                console.log('Login successful (2nd try).');
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            } catch (e2) {
                console.error('Login Failed. Cannot verify.');
                console.error(e2.response ? e2.response.data : e2.message);
                return;
            }
        }

        // 0. Get Valid Account
        console.log('Fetching accounts...');
        let accountRes;
        try {
            accountRes = await axios.get(`${API_URL}/accounts?projectId=${PROJECT_ID}`);
        } catch (e) {
            console.error('Failed to fetch accounts. Is the server running?');
            console.error(e.message);
            return;
        }

        if (!accountRes.data || accountRes.data.length === 0) {
            console.error('No accounts found for Project ID 1.');
            return;
        }

        const account = accountRes.data[0];
        const ACCOUNT_ID = account.id;
        console.log(`Using Account: ID=${ACCOUNT_ID}, Name=${account.name}`);

        let initialBalance = parseFloat(account.current_balance);
        console.log(`Initial Balance: ${initialBalance}`);

        // 1. Create PREDICTED Income (No Account, No Real Date)
        console.log('\n1. Creating FORECAST Income (No Account)...');
        const forecastData = {
            dataFato: '2024-01-01',
            dataPrevistaRecebimento: '2024-01-10',
            valor: 100.00,
            descricao: 'Test Forecast Auto',
            tipoEntradaId: TIPO_ENTRADA_ID,
            companyId: COMPANY_ID,
            projectId: PROJECT_ID,
            accountId: null,
            dataRealRecebimento: null
        };

        let forecastId;
        try {
            const res1 = await axios.post(`${API_URL}/incomes`, forecastData);
            forecastId = res1.data.id;
            console.log(`Forecast Income Created. ID: ${forecastId}`);
        } catch (e) {
            console.error('Failed to create income:', e.response ? e.response.data : e.message);
            return;
        }

        // Verify Balance did NOT change
        await verifyBalance(ACCOUNT_ID, initialBalance, 'Balance Unchanged');

        // 2. Update Forecast to REALIZED (Add Account and Real Date)
        console.log('\n2. Updating Forecast to REALIZED (Adding Account)...');
        const realizedData = {
            ...forecastData,
            dataRealRecebimento: '2024-01-05',
            accountId: ACCOUNT_ID,
            active: 1
        };
        await axios.put(`${API_URL}/incomes/${forecastId}`, realizedData);
        console.log('Income Updated to Realized.');

        // Verify Balance INCREASED
        await verifyBalance(ACCOUNT_ID, initialBalance + 100.00, 'Balance Increased (+100)');

        // 3. Revert back to FORECAST (Remove Account)
        console.log('\n3. Reverting back to FORECAST (Removing Account)...');
        const revertData = {
            ...forecastData,
            active: 1
        };
        await axios.put(`${API_URL}/incomes/${forecastId}`, revertData);
        console.log('Income Reverted to Forecast.');

        // Verify Balance REVERTED
        await verifyBalance(ACCOUNT_ID, initialBalance, 'Balance Reverted');

        // 4. Test Soft Delete Reversal
        console.log('\n4. Testing Soft Delete Reversal...');
        // Make Realized again
        await axios.put(`${API_URL}/incomes/${forecastId}`, realizedData);
        await verifyBalance(ACCOUNT_ID, initialBalance + 100.00, 'Balance Re-Increased');

        // Delete (active=0)
        const deleteData = { ...realizedData, active: 0 };
        await axios.put(`${API_URL}/incomes/${forecastId}`, deleteData);
        console.log('Income Soft Deleted.');

        // Verify Reverted
        await verifyBalance(ACCOUNT_ID, initialBalance, 'Balance Correct after Delete');

        // Final cleanup
        // await axios.delete(`${API_URL}/incomes/${forecastId}`);

        console.log('\n--- Verification SUCCESS ---');

    } catch (error) {
        console.error('Test Failed:', error.message);
        if (error.response) console.error('Response data:', error.response.data);
    }
}

async function verifyBalance(accountId, expected, label) {
    const res = await axios.get(`${API_URL}/accounts?projectId=${PROJECT_ID}`);
    const acc = res.data.find(a => a.id === accountId);
    const actual = parseFloat(acc.current_balance);
    const diff = Math.abs(actual - expected);

    if (diff < 0.01) {
        console.log(`✅ ${label}: ${actual} (Match)`);
    } else {
        console.error(`❌ ${label} FAILED: Expected ${expected}, Got ${actual}`);
        throw new Error('Balance mismatch');
    }
}

runTests();
