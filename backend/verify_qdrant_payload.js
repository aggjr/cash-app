
const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Manually Load Configuration
let QDRANT_URL = 'https://iva-bd.gutoapps.site'; // Default from code
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

// Parse URL
const parsedUrl = new URL(QDRANT_URL);
const COLLECTION_NAME = 'iva_knowledge';

// 2. Query Qdrant with Analysis
function queryQdrant() {
    console.log(`\n🔎 Auditing Qdrant Data for IDs...`);

    const postData = JSON.stringify({
        limit: 100, // Check last 100 items
        with_payload: true,
        with_vector: false
    });

    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: `/collections/${COLLECTION_NAME}/points/scroll`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': QDRANT_KEY
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const data = JSON.parse(body);
                    const points = data.result.points;

                    let hasUser = 0;
                    let hasProject = 0;
                    let total = points.length;

                    console.log(`\n📊 Analyzed ${total} recent knowledge items:\n`);

                    points.forEach((point) => {
                        const p = point.payload;
                        const uId = p.user_id;
                        const pId = p.project_id;

                        if (uId) hasUser++;
                        if (pId) hasProject++;

                        // Log items that might need attention
                        if (!pId) {
                            console.log(`[⚠️ Missing ProjectID] ID: ${point.id.substring(0, 8)}... | Layer: ${p.layer} | Text: "${(p.description || p.text || '').substring(0, 30)}..."`);
                        }
                    });

                    console.log(`\n📈 SUMMARY:`);
                    console.log(`Checking validity of IDs:`);
                    console.log(`✅ Items with User ID:    ${hasUser} / ${total}`);
                    console.log(`${hasProject === total ? '✅' : '❌'} Items with Project ID: ${hasProject} / ${total}`);

                    if (hasProject < total) {
                        console.log(`\n💡 CONCLUSION: Old data lacks Project ID (due to the previous bug). Only NEW data will have it.`);
                    }

                } catch (e) {
                    console.error('❌ Parse error:', e.message);
                    console.log('Raw body:', body.substring(0, 200));
                }
            } else {
                console.error(`❌ API Error (${res.statusCode}):`, body);
            }
        });
    });

    req.on('error', (e) => {
        console.error('❌ Request error:', e.message);
    });

    req.write(postData);
    req.end();
}

queryQdrant();
