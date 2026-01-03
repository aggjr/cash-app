
// Native fetch is available in Node 18+
const API_URL = 'http://localhost:3001/api';

async function runTest() {
    try {
        const email = 'agomes@foccusgestao.com.br';
        const password = '123';
        const projectId = 4;

        console.log('1. Attempting Login...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, projectId })
        });

        if (!loginRes.ok) {
            console.error('Login Failed:', loginRes.status, await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        const token = loginData.token;
        const companyId = 1; // Assume exists
        const accountId = 1; // Assume exists

        console.log(`Login Success. Token: ${token.substring(0, 10)}... Project: ${projectId}`);

        // 2. Create Loan
        // Use realistic values to trigger Fee logic
        const loanData = {
            projectId: projectId,
            companyId: companyId,
            accountId: accountId,
            description: "Empresa Teste IOF AI",
            nominalValue: 50000.00,
            netValue: 49500.00, // 500 Fee (1%)
            totalValue: 60000.00,
            interestRate: 2.0,
            contractDate: new Date().toISOString().split('T')[0],
            firstDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            installments: 12,
            registerEntry: true
        };

        console.log('Sending Loan Data:', JSON.stringify(loanData, null, 2));

        const res = await fetch(`${API_URL}/loans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(loanData)
        });

        const json = await res.json();
        console.log('Loan Creation Response:', res.status, json);

        if (res.ok) {
            console.log('✅ Loan Created Successfully.');
            console.log('Loan ID:', json.loanId);
        } else {
            console.error('❌ Failed to Create Loan:', json);
        }

    } catch (e) {
        console.error('Test Exception:', e);
    }
}

runTest();
