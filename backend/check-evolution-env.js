const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
console.log(`Checking .env at: ${envPath}`);

if (!fs.existsSync(envPath)) {
    console.log('.env file NOT FOUND');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

let hasUrl = false;
let hasKey = false;

lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') return;

    if (trimmed.startsWith('EVOLUTION_API_URL=')) {
        const val = trimmed.split('=')[1];
        if (val && val.trim().length > 0) hasUrl = true;
    }
    if (trimmed.startsWith('EVOLUTION_API_KEY=')) {
        const val = trimmed.split('=')[1];
        if (val && val.trim().length > 0) hasKey = true;
    }
});

console.log(`EVOLUTION_API_URL: ${hasUrl ? 'FOUND' : 'MISSING'}`);
console.log(`EVOLUTION_API_KEY: ${hasKey ? 'FOUND' : 'MISSING'}`);
