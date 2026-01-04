require('dotenv').config();

const API_URL = 'http://127.0.0.1:3001/api';

async function testPreferenceFlow() {
    try {
        console.log('1. Logging in...');
        let email = 'test.IVA@example.com';
        let password = 'password123';
        let projectName = 'IVA Test Project';

        // Register first to be sure
        console.log('   Registering/Ensuring user exists...');
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'IVA Test User', email, password, projectName })
        });

        // Get projects
        const projRes = await fetch(`${API_URL}/auth/projects-by-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const projData = await projRes.json();
        const projectId = projData.projects[0].id;

        // Login
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, projectId })
        });
        const loginData = await loginRes.json();

        if (!loginRes.ok) throw new Error(JSON.stringify(loginData));

        const token = loginData.token;
        const user = loginData.user;
        console.log('   Login successful.');
        console.log('   Initial preferred_name:', user.preferred_name);

        console.log('2. Updating preference to "Big Boss"...');
        const updateRes = await fetch(`${API_URL}/auth/update-preference`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ preferredName: 'Big Boss' })
        });
        const updateData = await updateRes.json();
        console.log('   Update response:', updateData.message);

        console.log('3. Logging in again to verify...');
        const loginRes2 = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, projectId })
        });
        const loginData2 = await loginRes2.json();

        const user2 = loginData2.user;
        console.log('   New preferred_name:', user2.preferred_name);

        if (user2.preferred_name === 'Big Boss') {
            console.log('SUCCESS: Preferred name updated and retrieved correctly.');
        } else {
            console.error('FAILURE: Preferred name mismatch.');
            process.exit(1);
        }

    } catch (error) {
        console.error('TEST FAILED:', error);
        process.exit(1);
    }
}

testPreferenceFlow();

