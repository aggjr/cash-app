const fetch = require('node-fetch');

async function debug() {
    try {
        // 1. Login to get token
        console.log('Logging in...');
        const loginResp = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'augusto@example.com', password: 'password123' }) // Assuming default or known user
        });

        // If login fails, we might need to register or use existing token if known.
        // For now, let's assume we can get a token or if we can't, we'll see 401.
        // Actually, let's just try to hit the endpoints, maybe they dont need auth or we can use a fake one if disabled?
        // No, auth is required.
        // Let's query the DB for a user to use.

        // Skipping login for a moment, let's verify if the route exists at all.
        // If 404, we know. If 401, we know route exists.

        console.log('Testing companies endpoint...');
        const compResp = await fetch('http://localhost:3001/api/companies?projectId=1', {
            headers: { 'Authorization': 'Bearer test' }
        });
        console.log(`Companies: ${compResp.status} ${compResp.statusText}`);
        if (compResp.headers.get('content-type')?.includes('application/json')) {
            console.log(await compResp.json());
        } else {
            console.log(await compResp.text());
        }

        console.log('Testing accounts endpoint...');
        const accResp = await fetch('http://localhost:3001/api/accounts?projectId=1', {
            headers: { 'Authorization': 'Bearer test' }
        });
        console.log(`Accounts: ${accResp.status} ${accResp.statusText}`);
        if (accResp.headers.get('content-type')?.includes('application/json')) {
            console.log(await accResp.json());
        } else {
            console.log(await accResp.text());
        }

    } catch (e) {
        console.error(e);
    }
}

debug();
