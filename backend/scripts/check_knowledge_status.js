const fs = require('fs');
const path = require('path');

// Manually load .env
try {
    const envPath = path.resolve(__dirname, '../.env');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
} catch (e) {
    console.error('Error loading .env manually:', e);
}

const vectorService = require('../services/VectorSearchService');

async function checkKnowledge() {
    console.log('Checking IVA Knowledge State...');

    try {
        const userRules = await vectorService.scroll({ layer: 'USER' }, 100);

        console.log('\n--- KNOWLEDGE REPORT ---');
        console.log(`\n[USER SCOPE] (Personal Rules): ${userRules.points ? userRules.points.length : 0} items found`);

        if (userRules.points && userRules.points.length > 0) {
            userRules.points.forEach(p => {
                console.log(` - [${p.payload.category}] ${p.payload.description || p.payload.text?.substring(0, 50)}...`);
            });
        } else {
            console.log(' - No personal knowledge found (Clean Slate).');
        }

        console.log('\n------------------------');

    } catch (error) {
        console.error('Error checking knowledge:', error);
    }
}

checkKnowledge();
