import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';
let TOKEN = '';
let PROJECT_ID = '';
let ACCOUNT_ID = '';
let COMPANY_ID = '';
let RETIRADA_ID = '';

async function login() {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'password123' })
    });
    const data = await res.json();
    TOKEN = data.token;
    PROJECT_ID = data.user.last_project_id;
    if (!PROJECT_ID) throw new Error('No project ID found for test user');
    console.log('Login successful. Token acquired.');
}

async function getAccountBalance(id) {
    const res = await fetch(`${BASE_URL}/accounts?projectId=${PROJECT_ID}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    const acc = data.find(a => a.id === id);
    return parseFloat(acc.current_balance);
}

async function createRetirada(amount) {
    const res = await fetch(`${BASE_URL}/retiradas`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
            dataFato: new Date().toISOString().split('T')[0],
            dataPrevista: new Date().toISOString().split('T')[0],
            valor: amount,
            descricao: 'Test Retirada',
            companyId: COMPANY_ID,
            accountId: ACCOUNT_ID,
            projectId: PROJECT_ID
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create retirada');
    return data.id;
}

// ... rest of logic identical, just ESM wrapper ...
async function updateRetirada(id, newAmount) {
    const res = await fetch(`${BASE_URL}/retiradas/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
            valor: newAmount,
            projectId: PROJECT_ID
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update retirada');
}

async function deleteRetirada(id) {
    const res = await fetch(`${BASE_URL}/retiradas/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete retirada');
    }
}

async function runTest() {
    try {
        await login();

        const accRes = await fetch(`${BASE_URL}/accounts?projectId=${PROJECT_ID}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        const accounts = await accRes.json();
        if (accounts.length === 0) throw new Error('No accounts found');
        ACCOUNT_ID = accounts[0].id;

        const compRes = await fetch(`${BASE_URL}/companies?projectId=${PROJECT_ID}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        const companies = await compRes.json();
        if (companies.length === 0) throw new Error('No companies found');
        COMPANY_ID = companies[0].id;

        console.log(`Using Account: ${ACCOUNT_ID}, Company: ${COMPANY_ID}`);

        const initialBalance = await getAccountBalance(ACCOUNT_ID);
        console.log(`Initial Balance: ${initialBalance}`);

        console.log('Creating Retirada of 100.00...');
        RETIRADA_ID = await createRetirada(100);

        const balanceAfterCreate = await getAccountBalance(ACCOUNT_ID);
        console.log(`Balance after Create: ${balanceAfterCreate}`);

        if (Math.abs(balanceAfterCreate - (initialBalance - 100)) > 0.01) {
            throw new Error(`Balance mismatch! Expected ${initialBalance - 100}, got ${balanceAfterCreate}`);
        }
        console.log('✅ Create Retirada Logic Verified');

        console.log('Updating Retirada to 200.00...');
        await updateRetirada(RETIRADA_ID, 200);

        const balanceAfterUpdate = await getAccountBalance(ACCOUNT_ID);
        console.log(`Balance after Update: ${balanceAfterUpdate}`);

        if (Math.abs(balanceAfterUpdate - (initialBalance - 200)) > 0.01) {
            throw new Error(`Balance mismatch! Expected ${initialBalance - 200}, got ${balanceAfterUpdate}`);
        }
        console.log('✅ Update Retirada Logic Verified');

        console.log('Deleting Retirada...');
        await deleteRetirada(RETIRADA_ID);

        const balanceAfterDelete = await getAccountBalance(ACCOUNT_ID);
        console.log(`Balance after Delete: ${balanceAfterDelete}`);

        if (Math.abs(balanceAfterDelete - initialBalance) > 0.01) {
            throw new Error(`Balance mismatch! Expected ${initialBalance}, got ${balanceAfterDelete}`);
        }
        console.log('✅ Delete Retirada Logic Verified');

        console.log('🎉 ALL TESTS PASSED');

    } catch (err) {
        console.error('❌ Test Failed:', err);
    }
}
runTest();
