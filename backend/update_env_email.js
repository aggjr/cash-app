const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let content = '';

if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
}

const lines = content.split('\n');
const newLines = lines.filter(line => {
    const key = line.split('=')[0].trim();
    return !['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM'].includes(key);
});

// Add new config
newLines.push('EMAIL_HOST=smtp.gmail.com');
newLines.push('EMAIL_PORT=587');
newLines.push('EMAIL_USER=agomes@foccusgestao.com.br');
newLines.push('EMAIL_PASS=dataCompl16^');
newLines.push('EMAIL_FROM="CASH System" <agomes@foccusgestao.com.br>');

fs.writeFileSync(envPath, newLines.join('\n'));
console.log('.env updated successfully');
