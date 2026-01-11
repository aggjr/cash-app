
const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Manually Load Configuration
let QDRANT_URL = 'https://iva-bd.gutoapps.site';
let QDRANT_KEY = '';

try {
    const envPath = path.resolve(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, ...val] = line.split('=');
            if (key) {
                const value = val.join('=').trim().replace(/^["']|["']$/g, '');
                if (key.trim() === 'QDRANT_URL') QDRANT_URL = value;
                if (key.trim() === 'QDRANT_API_KEY') QDRANT_KEY = value;
            }
        });
        console.log('✅ Config loaded.');
    } else {
        console.warn('⚠️ .env not found, using defaults.');
    }
} catch (e) {
    console.error('⚠️ Config load error:', e.message);
}

const parsedUrl = new URL(QDRANT_URL);
const COLLECTION_NAME = 'iva_knowledge';
const VECTOR_SIZE = 1536; // Matching OpenAI text-embedding-3-small

function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'api-key': QDRANT_KEY
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve(body);
                    }
                } else {
                    reject(new Error(`API Error (${res.statusCode}): ${body}`));
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function resetDB() {
    console.log(`\n🚨 RESETTING QDRANT COLLECTION: ${COLLECTION_NAME}`);
    console.log(`Target: ${QDRANT_URL}\n`);

    try {
        // 1. Delete Collection
        console.log('1️⃣  Deleting existing collection...');
        try {
            await request('DELETE', `/collections/${COLLECTION_NAME}`);
            console.log('   ✅ Collection deleted.');
        } catch (e) {
            console.warn('   ⚠️ Could not delete (maybe it didn\'t exist):', e.message);
        }

        // Wait a moment
        await new Promise(r => setTimeout(r, 2000));

        // 2. Create Collection
        console.log('2️⃣  Creating new collection...');
        const createPayload = {
            vectors: {
                size: VECTOR_SIZE,
                distance: 'Cosine'
            }
        };
        await request('PUT', `/collections/${COLLECTION_NAME}`, createPayload);
        console.log('   ✅ Collection created successfully.');

        console.log('\n✨ DATABASE RESET COMPLETE. READY FOR NEW DATA.');

    } catch (error) {
        console.error('\n❌ FATAL ERROR DURING RESET:', error.message);
    }
}

resetDB();
