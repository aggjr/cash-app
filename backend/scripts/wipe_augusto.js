const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.resolve(__dirname, '../.env');
let envConfig = {};
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) process.env[key.trim()] = value.trim();
    });
} catch (e) {
    console.log('Could not load .env, assuming env vars are set or using defaults');
}

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'cash_db',
    port: process.env.DB_PORT || 3306
};

async function run() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to DB.');

        const [rows] = await connection.execute("SELECT id, name FROM users WHERE name LIKE '%Augusto%'");
        console.log('Users found:', rows);

        if (rows.length > 0) {
            const userId = rows[0].id;
            console.log(`Targeting User ID: ${userId} for wipe.`);

            // Now call the wipe
            const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');

            // Mock vector service if needed or ensure it constructs correctly
            /* 
               VectorSearchService constructor loads process.env. 
               We loaded it above manually.
            */

            await IvaGlobalKnowledge.resetAllForUser(userId);
            console.log('WIPE COMPLETE via Script.');
        } else {
            console.log('User Augusto not found.');
        }

        await connection.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
