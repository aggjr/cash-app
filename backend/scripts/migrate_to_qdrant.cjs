require('dotenv').config();
const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const vectorService = require('../services/VectorSearchService');

async function migrate() {
    console.log('🚀 Starting Migration to Qdrant...');

    try {
        // 1. Migrate from MySQL (iva_knowledge_layers)
        console.log('\n--- Migrating iva_knowledge_layers ---');
        const [layers] = await db.query('SELECT * FROM iva_knowledge_layers WHERE active = TRUE');
        console.log(`Found ${layers.length} active knowledge items.`);

        for (const item of layers) {
            const textToEmbed = `${item.knowledge_key}: ${JSON.stringify(item.knowledge_value)}`;
            const metadata = {
                source: 'mysql_layers',
                original_id: item.id,
                layer_type: item.layer_type,
                knowledge_type: item.knowledge_type,
                user_id: item.user_id,
                company_id: item.company_id,
                module_code: item.module_code
            };

            // Usar um ID UUID ou string única para o Qdrant
            const qdrantId = `layer_${item.id}`;
            await vectorService.upsertKnowledge(qdrantId, textToEmbed, metadata);
            process.stdout.write('.');
        }

        // 2. Migrate from JSON (iva_global_knowledge.json)
        console.log('\n\n--- Migrating iva_global_knowledge.json ---');
        const jsonPath = path.join(__dirname, '../data/iva_global_knowledge.json');
        try {
            const jsonData = await fs.readFile(jsonPath, 'utf8');
            const knowledge = JSON.parse(jsonData);

            let count = 0;
            const categories = ['menus', 'actions', 'custom_rules'];

            for (const category of categories) {
                const items = knowledge.knowledge[category] || [];
                for (const [index, item] of items.entries()) {
                    let textToEmbed = '';
                    if (category === 'menus') {
                        textToEmbed = `Menu/Tela ${item.screen_id}: ${item.keywords.primary?.join(', ')}. Objetivo: ${item.purpose || ''}`;
                    } else if (category === 'actions') {
                        textToEmbed = `Ação [${item.screen_id}] ${item.action_type}: ${item.keywords.primary?.join(', ')}. Descrição: ${item.description || ''}`;
                    } else if (category === 'custom_rules') {
                        textToEmbed = `Regra Aprendida: ${item.description}`;
                    }

                    const metadata = {
                        source: 'json_global',
                        category: category,
                        screen_id: item.screen_id,
                        action_id: item.action_id
                    };

                    const qdrantId = `global_${category}_${index}`;
                    await vectorService.upsertKnowledge(qdrantId, textToEmbed, metadata);
                    count++;
                    process.stdout.write('.');
                }
            }
            console.log(`\nMigrated ${count} items from JSON.`);
        } catch (err) {
            console.warn('Could not read JSON global knowledge, skipping:', err.message);
        }

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
