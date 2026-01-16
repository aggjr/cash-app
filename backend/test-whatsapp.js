const fetch = require('node-fetch'); // Assuming node environment might need this or just global fetch

async function testWhatsapp() {
    try {
        console.log('Testing WhatsApp Integration...');

        // 1. Check Status
        console.log('\nChecking Connection Status...');
        const statusResponse = await fetch('http://127.0.0.1:3001/api/integration/whatsapp/status', {
            headers: { 'Authorization': 'Bearer YOUR_JWT_TOKEN' } // Note: Auth is enabled, so this might fail 401 if I don't have a token.
        });

        if (statusResponse.status === 401) {
            console.log('Got 401 Unauthorized. This expects a token. For testing, I should temporarily disable auth or get a token?');
            console.log('For now, assuming the route exists is enough proof of server update, but we want to test functionally.');
            return;
        }

        const statusData = await statusResponse.json();
        console.log('Status Response:', statusData);

        // 2. Send Message
        // console.log('\nSending Test Message...');
        // const sendResponse = await fetch('http://127.0.0.1:3001/api/integration/whatsapp/send', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //         phone: '553194477070',
        //         message: 'Teste automático de integração CASH -> Evolution API 🚀'
        //     })
        // });
        // const sendData = await sendResponse.json();
        // console.log('Send Response:', sendData);

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Just checking if the endpoint responds 401 proves it's mounted.
// To actually test functionality, I need a token.
// I can temporarily bypass auth in the route file for testing or ask the user.
// Or I can use the existing `test-login.js` to get a token?
