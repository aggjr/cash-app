const fs = require('fs').promises;
const path = require('path');
const VectorSearchService = require('./services/VectorSearchService');

// Configuration
const PROMPTS_DIR = path.join(__dirname, 'prompts');
const PROMPT_FILES = ['system.txt', 'department.txt', 'user.txt'];

async function migratePrompts() {
    console.log('🚀 Starting Prompts to Qdrant Migration...');

    try {
        // Ensure collection exists
        await VectorSearchService.ensureCollection();

        for (const filename of PROMPT_FILES) {
            const level = filename.replace('.txt', '');
            const filePath = path.join(PROMPTS_DIR, filename);
            const qdrantId = `prompt_${level}`; // Fixed ID for core prompts

            console.log(`\n📄 Processing "${level}" prompt...`);

            try {
                // Check if file exists
                await fs.access(filePath);

                // Read content
                const content = await fs.readFile(filePath, 'utf-8');
                if (!content.trim()) {
                    console.log(`⚠️  File ${filename} is empty, skipping.`);
                    continue;
                }

                console.log(`   Read ${content.length} chars. Uploading to Qdrant...`);

                // Upsert to Qdrant
                // We use specific ID to make it easily retrievable/updatable
                const point = {
                    id: qdrantId,
                    payload: {
                        category: 'core_prompt',
                        layer: 'GLOBAL',
                        type: level,
                        content: content,
                        text: `Prompt do sistema nível ${level}`, // For searchability if needed
                        updated_at: new Date().toISOString()
                    },
                    vector: await VectorSearchService.getEmbedding(`Prompt ${level}`) // Simple vector, mostly retrieved by ID
                };

                await VectorSearchService.client.upsert(VectorSearchService.collectionName, {
                    wait: true,
                    points: [point]
                });

                console.log(`✅ ${level} prompt migrated successfully!`);

            } catch (err) {
                if (err.code === 'ENOENT') {
                    console.log(`ℹ️  File ${filename} not found, skipping.`);
                } else {
                    console.error(`❌ Error processing ${filename}:`, err.message);
                }
            }
        }

        console.log('\n🎉 Migration completed!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

migratePrompts();
