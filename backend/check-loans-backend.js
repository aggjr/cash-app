const http = require('http');

// Config
const API_HOST = '127.0.0.1';
const API_PORT = 3001;
const EMAIL = `debug.loans.${Date.now()}@example.com`;
const PASSWORD = 'password123';

// Helper for requests
function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            port: API_PORT,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    try {
        console.log('1. Registering/Logging in...');
        // Try register
        const regRes = await request('POST', '/auth/register', { name: 'Debug', email: EMAIL, password: PASSWORD, projectName: 'DebugProj' });
        console.log('Register Status:', regRes.status);
        if (regRes.status !== 201 && regRes.status !== 200) {
            console.log('Register Body:', JSON.stringify(regRes.body));
        }

        // Login
        const projRes = await request('POST', '/auth/projects-by-email', { email: EMAIL });
        if (!projRes.body.projects || projRes.body.projects.length === 0) {
            console.error('No projects found. Register failed?');
            return;
        }
        const projectId = projRes.body.projects[0].id;

        const loginRes = await request('POST', '/auth/login', { email: EMAIL, password: PASSWORD, projectId });
        const token = loginRes.body.token;
        console.log('   Logged in. Token:', token ? 'OK' : 'MISSING');

        console.log('\n2. Testing GET /loans/installments (Valid)');
        const listRes = await request('GET', `/loans/installments?projectId=${projectId}&page=1&limit=10`, null, token);
        console.log(`   Status: ${listRes.status}`);
        console.log(`   Data length: ${listRes.body.data?.length}`);

        console.log('\n3. Testing POST /loans (Invalid Payload - Expect 400 or 500)');
        const createRes = await request('POST', '/loans', {}, token);
        console.log(`   Status: ${createRes.status}`); // Should be 400 or similar
        console.log(`   Error: ${JSON.stringify(createRes.body)}`);

    } catch (e) {
        console.error('Fatal:', e);
    }
}

run();
