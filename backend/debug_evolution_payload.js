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

const fileLogger = require('./utils/fileLogger'); // Use existing logger or mock it

class EvolutionApiService {
    constructor() {
        this.baseUrl = process.env.EVOLUTION_API_URL;
        this.apiKey = process.env.EVOLUTION_API_KEY;
        this.instanceName = 'Cash';
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'apikey': this.apiKey
        };
    }

    async sendMessageFixed(phone, text) {
        try {
            const cleanPhone = phone.replace(/\D/g, '');
            const number = cleanPhone.includes('@s.whatsapp.net') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
            const url = `${this.baseUrl}/message/sendText/${this.instanceName}`;

            // MODIFIED PAYLOAD
            const payload = {
                number: number,
                text: text, // Top level text
                options: {
                    delay: 1200,
                    presence: "composing",
                    linkPreview: false
                }
            };

            console.log('Sending with payload:', JSON.stringify(payload, null, 2));

            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Evolution API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('Success:', data);
            return data;
        } catch (error) {
            console.error('Error:', error.message);
        }
    }
}

async function run() {
    const service = new EvolutionApiService();
    await service.sendMessageFixed('553194477070', 'Teste de correção de payload - CASH');
}

run();
