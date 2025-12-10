const axios = require('axios');

async function testAccountsApi() {
    try {
        // We need a token. Since we don't have one easily, we might need to login first or mock it if we can.
        // But wait, the backend middleware checks for a valid token.
        // I can try to login first with a known user if I have one, or just check if the route exists (401 vs 404).

        console.log('Testing /api/accounts endpoint...');
        try {
            await axios.get('http://localhost:3001/api/accounts');
        } catch (error) {
            if (error.response) {
                console.log(`Response status: ${error.response.status}`);
                if (error.response.status === 404) {
                    console.error('Error: Endpoint not found (404). Server might not have picked up the new route.');
                } else if (error.response.status === 401) {
                    console.log('Success: Endpoint exists (got 401 Unauthorized as expected).');
                } else {
                    console.log('Response data:', error.response.data);
                }
            } else {
                console.error('Error connecting to server:', error.message);
            }
        }
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

testAccountsApi();
