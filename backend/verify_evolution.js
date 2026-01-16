// using global fetch


async function testIntegration() {
    const baseUrl = 'http://localhost:3001/api';

    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@cash.com', password: 'admin123' })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('Login successful. Token obtained.');

        // 2. Check Status
        console.log('\nChecking WhatsApp Status...');
        const statusRes = await fetch(`${baseUrl}/integration/whatsapp/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!statusRes.ok) {
            console.error('Status check failed:', await statusRes.text());
        } else {
            console.log('Status Response:', await statusRes.json());
        }

        // 3. Send Test Message (Optional, uncomment to test)
        console.log('\nSending Test Message...');
        const sendRes = await fetch(`${baseUrl}/integration/whatsapp/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: '553194477070',
                message: 'Teste de integração CASH -> Evolution API realizado com sucesso! 🚀'
            })
        });

        if (!sendRes.ok) {
            console.error('Send message failed:', await sendRes.text());
        } else {
            console.log('Send Message Response:', await sendRes.json());
        }

    } catch (error) {
        console.error('Test error:', error);
    }
}

testIntegration();
