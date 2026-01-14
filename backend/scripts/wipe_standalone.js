const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Load ENV manually
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env not found at:', envPath);
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/"/g, '').replace(/'/g, ''); // Simple cleanup
        if (key && !key.startsWith('#')) {
            env[key] = value;
        }
    }
});

const QDRANT_URL = env.QDRANT_URL || 'https://iva-bd.gutoapps.site';
const QDRANT_API_KEY = env.QDRANT_API_KEY; // Undefined is fine if not required
const COLLECTION_NAME = 'iva_knowledge';

console.log('Target Qdrant:', QDRANT_URL);
if (QDRANT_API_KEY) console.log('API Key: Present');
else console.log('API Key: None (implied public/internal)');

// 2. Helper for HTTPS request
function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, QDRANT_URL);
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {})
            }
        };

        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body ? JSON.parse(body) : {});
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

// 3. Main Wipe Logic
(async () => {
    console.log('⚠️ DELETING COLLECTION...');
    try {
        // Delete
        try {
            await request('DELETE', `/collections/${COLLECTION_NAME}`);
            console.log('✅ Collection deleted.');
        } catch (e) {
            console.log('ℹ️ Collection delete skipped (maybe didn not exist):', e.message);
        }

        // Recreate
        console.log('🏗️ Recreating collection...');
        await request('PUT', `/collections/${COLLECTION_NAME}`, {
            vectors: {
                size: 1536,
                distance: 'Cosine'
            }
        });
        console.log('✅ SUCESSO! Banco de dados recriado do zero.');

    } catch (e) {
        console.error('❌ FATAL ERROR:', e.message);
    }
})();
