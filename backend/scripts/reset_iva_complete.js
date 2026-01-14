/**
 * COMPLETE IVA KNOWLEDGE DELETION
 * 
 * This script will:
 * 1. DELETE ALL Qdrant collections (iva_knowledge, iva_user_preferences) - NO RECREATION
 * 2. Reset MySQL last_iva_access field for all users
 * 
 * WARNING: This is IRREVERSIBLE. All IVA knowledge will be lost.
 * Collections will be recreated automatically by the backend on first use.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const mysql = require('mysql2/promise');

// ============================================================================
// 1. LOAD ENVIRONMENT
// ============================================================================

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
        const value = parts.slice(1).join('=').trim().replace(/"/g, '').replace(/'/g, '');
        if (key && !key.startsWith('#')) {
            env[key] = value;
        }
    }
});

const QDRANT_URL = env.QDRANT_URL || 'https://iva-bd.gutoapps.site';
const QDRANT_API_KEY = env.QDRANT_API_KEY;

const DB_CONFIG = {
    host: env.DB_HOST || 'localhost',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD,
    database: env.DB_NAME || 'cash_db'
};

console.log('\n🔥 IVA COMPLETE KNOWLEDGE RESET');
console.log('================================\n');
console.log('Qdrant URL:', QDRANT_URL);
console.log('Database:', DB_CONFIG.database);
console.log('API Key:', QDRANT_API_KEY ? 'Present' : 'None');
console.log('\n⚠️  WARNING: This will DELETE ALL IVA knowledge for ALL users and companies!');
console.log('⚠️  This action is IRREVERSIBLE!\n');

// ============================================================================
// 2. QDRANT HELPER
// ============================================================================

function qdrantRequest(method, path, data = null) {
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

// ============================================================================
// 3. RESET FUNCTIONS
// ============================================================================

async function deleteQdrantCollection(collectionName) {
    console.log(`\n📦 Processing collection: ${collectionName}`);
    console.log('─'.repeat(60));

    try {
        // Delete existing collection completely
        console.log('🗑️  Deleting collection permanently...');
        try {
            await qdrantRequest('DELETE', `/collections/${collectionName}`);
            console.log('✅ Collection deleted permanently (no recreation)');
        } catch (e) {
            if (e.message.includes('404')) {
                console.log('ℹ️  Collection did not exist (already clean)');
            } else {
                throw e;
            }
        }

    } catch (error) {
        console.error(`❌ Error deleting ${collectionName}:`, error.message);
        throw error;
    }
}

async function resetMySQLFields() {
    console.log('\n💾 Resetting MySQL IVA fields');
    console.log('─'.repeat(60));

    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected to MySQL');

        // Reset last_iva_access for all users
        console.log('🔄 Resetting last_iva_access field...');
        const [result] = await connection.execute(
            'UPDATE users SET last_iva_access = NULL WHERE last_iva_access IS NOT NULL'
        );
        console.log(`✅ Reset ${result.affectedRows} user(s) last_iva_access field`);

        await connection.end();
        console.log('✅ MySQL reset complete');

    } catch (error) {
        console.error('❌ MySQL error:', error.message);
        if (connection) await connection.end();
        throw error;
    }
}

// ============================================================================
// 4. MAIN EXECUTION
// ============================================================================

(async () => {
    try {
        console.log('⏳ Starting complete deletion process...\n');

        // Delete Qdrant collections completely (no recreation)
        await deleteQdrantCollection('iva_knowledge');
        await deleteQdrantCollection('iva_user_preferences');

        // Reset MySQL fields
        await resetMySQLFields();

        console.log('\n' + '='.repeat(60));
        console.log('✅ SUCCESS! IVA knowledge completely wiped');
        console.log('='.repeat(60));
        console.log('\n📋 What was deleted:');
        console.log('  ✓ Qdrant collection: iva_knowledge (DELETED - no structure remains)');
        console.log('  ✓ Qdrant collection: iva_user_preferences (DELETED - no structure remains)');
        console.log('  ✓ MySQL: last_iva_access field (set to NULL for all users)');
        console.log('\n💡 Next steps:');
        console.log('  1. Restart the backend server');
        console.log('  2. Backend will recreate collections automatically on first use');
        console.log('  3. IVA will start completely fresh with no knowledge\n');

    } catch (error) {
        console.error('\n❌ FATAL ERROR during deletion:', error.message);
        console.error('\n⚠️  Deletion may be incomplete. Check logs above.');
        process.exit(1);
    }
})();
