const fs = require('fs');
const path = require('path');

// Manual .env parser
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...parts] = trimmed.split('=');
            if (key && parts.length > 0) {
                process.env[key.trim()] = parts.join('=').trim();
            }
        }
    });
}

const evolutionService = require('./services/evolutionService');

async function testDirect() {
    console.log('Testing EvolutionApiService Message Send...');
    try {
        // Phone from previous test file
        const phone = '553194477070';
        const message = 'Teste de integração CASH -> Evolution API: Verificação de envio com sucesso! 🚀';

        console.log(`Sending message to ${phone}...`);
        const result = await evolutionService.sendMessage(phone, message);
        console.log('Send Result:', JSON.stringify(result, null, 2));

    } catch (err) {
        console.error('Service Error:', err);
    }
}

testDirect();
