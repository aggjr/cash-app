async function testAccountsApi() {
    try {
        console.log('Testing /api/accounts endpoint...');
        const response = await fetch('http://127.0.0.1:3001/api/accounts');

        console.log(`Response status: ${response.status}`);
        if (response.status === 404) {
            console.error('Error: Endpoint not found (404). Server might not have picked up the new route.');
        } else if (response.status === 401) {
            console.log('Success: Endpoint exists (got 401 Unauthorized as expected).');
        } else {
            const data = await response.json();
            console.log('Response data:', data);
        }
    } catch (error) {
        console.error('Error connecting to server:', error.message);
    }
}

testAccountsApi();
