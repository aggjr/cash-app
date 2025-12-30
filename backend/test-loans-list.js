// Using native fetch
// Using native fetch if Node 18+
require('dotenv').config();

const API_URL = 'http://127.0.0.1:3001/api';

async function testLoans() {
    try {
        console.log('--- Step 1: Login ---');
        // Register temp user to ensure auth works
        const email = 'debug.loans@example.com';
        const password = 'password123';

        await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Debug User', email, password, projectName: 'Debug Project' })
        });

        // Get Project ID
        const projRes = await fetch(`${API_URL}/auth/projects-by-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const projData = await projRes.json();
        const projectId = projData.projects[0].id;
        console.log('Project ID:', projectId);

        // Login
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, projectId })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        console.log('\n--- Step 2: GET /api/loans (No params) ---');
        const resLoans = await fetch(`${API_URL}/loans`, { headers });
        console.log(`Status: ${resLoans.status} ${resLoans.statusText}`);
        if (resLoans.status !== 404) {
            const txt = await resLoans.text();
            console.log('Body:', txt.substring(0, 200));
        }

        console.log('\n--- Step 3: GET /api/loans/installments (No params) ---');
        const resInstNoParam = await fetch(`${API_URL}/loans/installments`, { headers });
        console.log(`Status: ${resInstNoParam.status} ${resInstNoParam.statusText}`);
        const bodyInstNoParam = await resInstNoParam.json();
        console.log('Body:', bodyInstNoParam);

        console.log(`\n--- Step 4: GET /api/loans/installments?projectId=${projectId} ---`);
        const resInst = await fetch(`${API_URL}/loans/installments?projectId=${projectId}`, { headers });
        console.log(`Status: ${resInst.status} ${resInst.statusText}`);
        const bodyInst = await resInst.json();
        console.log('Result Count:', bodyInst.data ? bodyInst.data.length : 'N/A');

    } catch (e) {
        console.error(e);
    }
}

testLoans();
