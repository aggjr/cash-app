const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

console.log('========================================');
console.log('🔧 Fixing .env file');
console.log('========================================\n');

try {
    // Read current .env file
    let envContent = fs.readFileSync(envPath, 'utf8');
    console.log('Current .env content:');
    console.log(envContent.split('\n').map(line =>
        line.includes('PASSWORD') ? line.replace(/=.+/, '=***') : line
    ).join('\n'));
    console.log('\n');

    // Replace localhost with 127.0.0.1
    const originalContent = envContent;
    envContent = envContent.replace(/DB_HOST=localhost/g, 'DB_HOST=127.0.0.1');

    if (originalContent !== envContent) {
        // Backup original
        fs.writeFileSync(envPath + '.backup', originalContent);
        console.log('✅ Created backup: .env.backup\n');

        // Write updated content
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Updated .env file:');
        console.log('   Changed: DB_HOST=localhost');
        console.log('   To:      DB_HOST=127.0.0.1\n');

        console.log('========================================');
        console.log('✅ Fix applied successfully!');
        console.log('========================================\n');
        console.log('The backend should restart automatically with nodemon.\n');
    } else {
        console.log('ℹ️  DB_HOST is already set to 127.0.0.1 or not using localhost\n');
        console.log('Checking current DB_HOST value...');
        const hostMatch = envContent.match(/DB_HOST=(.+)/);
        if (hostMatch) {
            console.log(`Current DB_HOST: ${hostMatch[1]}`);
        } else {
            console.log('DB_HOST not found in .env file');
            console.log('Adding DB_HOST=127.0.0.1...\n');
            envContent += '\nDB_HOST=127.0.0.1\n';
            fs.writeFileSync(envPath, envContent);
            console.log('✅ Added DB_HOST=127.0.0.1 to .env file\n');
        }
    }

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
