import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';
let TOKEN = '';
let PROJECT_ID = '';
let ACCOUNT_A = '';
let ACCOUNT_B = '';

const login = async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'password123' })
    });
    const data = await res.json();
    TOKEN = data.token;
    console.log('Login:', res.ok);

    // Get Project
    const projRes = await fetch(`${BASE_URL}/projects`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    const projData = await projRes.json();
    PROJECT_ID = projData[0].id;
    console.log('Project ID:', PROJECT_ID);
};

const getAccounts = async () => {
    const res = await fetch(`${BASE_URL}/accounts?projectId=${PROJECT_ID}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    const accounts = await res.json();
    if (accounts.length < 2) throw new Error('Need at least 2 accounts');
    ACCOUNT_A = accounts[0];
    ACCOUNT_B = accounts[1];
    console.log(`Account A: ${ACCOUNT_A.name} (${ACCOUNT_A.current_balance})`);
    console.log(`Account B: ${ACCOUNT_B.name} (${ACCOUNT_B.current_balance})`);
    return { a: parseFloat(ACCOUNT_A.current_balance), b: parseFloat(ACCOUNT_B.current_balance) };
};

const runTest = async () => {
    await login();
    const initial = await getAccounts();
    const AMOUNT = 100.00;

    console.log('Creating Transfer of 100 from A to B...');
    const res = await fetch(`${BASE_URL}/transferencias`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            dataFato: new Date().toISOString().split('T')[0],
            valor: AMOUNT,
            descricao: 'Test Transfer',
            sourceAccountId: ACCOUNT_A.id,
            destinationAccountId: ACCOUNT_B.id,
            projectId: PROJECT_ID
        })
    });
    const created = await res.json();
    console.log('Created ID:', created.id);

    // Verify Balances
    const afterCreate = await getAccounts();
    const diffA = afterCreate.a - initial.a;
    const diffB = afterCreate.b - initial.b;
    console.log(`Diff A: ${diffA} (Expected -100)`);
    console.log(`Diff B: ${diffB} (Expected +100)`);
    if (Math.abs(diffA + 100) > 0.01 || Math.abs(diffB - 100) > 0.01) console.error('BALANCE ERROR ON CREATE');
    else console.log('BALANCE CORRECT ON CREATE');

    console.log('Deleting Transfer...');
    await fetch(`${BASE_URL}/transferencias/${created.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${TOKEN}` } });

    // Verify Balances Revert
    const afterDelete = await getAccounts();
    const diffA2 = afterDelete.a - initial.a;
    const diffB2 = afterDelete.b - initial.b;
    console.log(`Diff A Final: ${diffA2} (Expected 0)`);
    console.log(`Diff B Final: ${diffB2} (Expected 0)`);
    if (Math.abs(diffA2) > 0.01 || Math.abs(diffB2) > 0.01) console.error('BALANCE ERROR ON DELETE');
    else console.log('BALANCE REVERTED CORRECTLY');
};

runTest().catch(console.error);
