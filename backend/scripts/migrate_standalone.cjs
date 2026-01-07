require('dotenv').config();
const mysql = require('mysql2/promise');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// Configurações
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const QDRANT_URL = process.env.QDRANT_URL || 'https://iva-bd.gutoapps.site';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = 'iva_knowledge';

const qdrantUrl = new URL(QDRANT_URL);

/**
 * Helper para chamadas HTTPS Genéricas (OpenAI ou Qdrant)
 */
async function apiRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
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

/**
 * Gerar Embedding via OpenAI (HTTPS Nativo)
 */
async function generateEmbedding(text) {
    const options = {
        hostname: 'api.openai.com',
        path: '/v1/embeddings',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        }
    };
    const response = await apiRequest(options, {
        model: 'text-embedding-3-small',
        input: text
    });
    return response.data[0].embedding;
}

/**
 * Upsert no Qdrant (HTTPS Nativo)
 */
async function upsertQdrant(points) {
    const options = {
        hostname: qdrantUrl.hostname,
        port: qdrantUrl.port || 443,
        path: `/collections/${COLLECTION_NAME}/points`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
    };
    if (QDRANT_API_KEY) options.headers['api-key'] = QDRANT_API_KEY;

    return apiRequest(options, { wait: true, points });
}

async function migrate() {
    console.log('🚀 Final Standalone Migration to Qdrant...');

    let connection;
    try {
        // 0. Ensure Collection
        console.log('Checking Qdrant collection...');
        const checkOptions = {
            hostname: qdrantUrl.hostname,
            port: qdrantUrl.port || 443,
            path: `/collections/${COLLECTION_NAME}`,
            method: 'GET',
            headers: {}
        };
        if (QDRANT_API_KEY) checkOptions.headers['api-key'] = QDRANT_API_KEY;

        try {
            await apiRequest(checkOptions);
        } catch (e) {
            console.log('Creating collection...');
            const createOptions = { ...checkOptions, method: 'PUT', path: `/collections/${COLLECTION_NAME}` };
            await apiRequest(createOptions, {
                vectors: { size: 1536, distance: 'Cosine' }
            });
        }

        // 1. MySQL Migration
        console.log('\n--- Migrating MySQL ---');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        const tablesToTry = ['iva_knowledge_layers', 'iva_discovered_knowledge'];
        for (const tableName of tablesToTry) {
            try {
                console.log(`Checking table ${tableName}...`);
                const [rows] = await connection.query(`SELECT * FROM ${tableName}`);
                console.log(`Found ${rows.length} items in ${tableName}.`);

                for (const item of rows) {
                    try {
                        let textToEmbed = '';
                        let metadata = {};

                        if (tableName === 'iva_knowledge_layers') {
                            textToEmbed = `${item.knowledge_key}: ${JSON.stringify(item.knowledge_value)}`;
                            metadata = {
                                source: 'mysql_layers',
                                original_id: item.id,
                                layer_type: item.layer_type,
                                knowledge_type: item.knowledge_type,
                                user_id: item.user_id,
                                company_id: item.company_id
                            };
                        } else if (tableName === 'iva_discovered_knowledge') {
                            textToEmbed = JSON.stringify(item.discovered_data);
                            metadata = {
                                source: 'mysql_discovered',
                                original_id: item.id,
                                knowledge_type: item.knowledge_type,
                                project_id: item.project_id,
                                user_id: item.user_id
                            };
                        }

                        const vector = await generateEmbedding(textToEmbed);
                        await upsertQdrant([{
                            id: `${tableName}_${item.id}`,
                            vector,
                            payload: { ...metadata, text: textToEmbed, updated_at: new Date().toISOString() }
                        }]);
                        process.stdout.write('.');
                    } catch (err) {
                        console.error(`\nError migrating ${tableName} item ${item.id}:`, err.message);
                    }
                }
            } catch (err) {
                console.log(`Table ${tableName} not found or inaccessible.`);
            }
        }

        // 2. JSON Migration
        console.log('\n\n--- Migrating JSON global knowledge ---');
        const jsonPath = path.join(__dirname, '../data/iva_global_knowledge.json');
        try {
            const jsonData = await fs.readFile(jsonPath, 'utf8');
            const knowledge = JSON.parse(jsonData);
            const categories = ['menus', 'actions', 'custom_rules'];

            for (const category of categories) {
                const items = knowledge.knowledge[category] || [];
                for (const [index, item] of items.entries()) {
                    try {
                        let text = '';
                        if (category === 'menus') text = `Menu ${item.screen_id}: ${item.purpose || ''} Keywords: ${JSON.stringify(item.keywords)}`;
                        else if (category === 'actions') text = `Action [${item.screen_id}] ${item.action_id || item.action_type}: ${item.description || ''} Keywords: ${JSON.stringify(item.keywords)}`;
                        else if (category === 'custom_rules') text = `Rule: ${item.description}`;

                        if (!text) continue;

                        const vector = await generateEmbedding(text);
                        await upsertQdrant([{
                            id: `global_${category}_${index}`,
                            vector,
                            payload: { source: 'json_global', category, text, ...item, updated_at: new Date().toISOString() }
                        }]);
                        process.stdout.write('.');
                    } catch (err) {
                        console.error(`\nError migrating JSON ${category} ${index}:`, err.message);
                    }
                }
            }
        } catch (e) {
            console.log('\nJSON file not found or empty, skipping.');
        }

        console.log('\n\n✅ Migration Success!');
    } catch (error) {
        console.error('\n❌ Migration Fatal Error:', error.message);
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
}

migrate();
