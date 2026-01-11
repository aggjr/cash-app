const QdrantKnowledgeService = require('../services/QdrantKnowledgeService');
const VectorSearchService = require('../services/VectorSearchService');
require('dotenv').config();

const resetPrompts = async () => {
    console.log('[RESET] Starting cleanup of heavy knowledge manuals...');

    // Explicitly delete the heavy prompts provided by the old seeder
    const targets = ['module', 'company', 'department', 'role'];

    for (const type of targets) {
        const id = `prompt_${type}`;
        console.log(`[RESET] Deleting ${id}...`);
        try {
            await VectorSearchService.deleteKnowledge(id);
            console.log(`[RESET] ✅ Deleted ${id}`);
        } catch (error) {
            console.error(`[RESET] ❌ Failed to delete ${id}:`, error.message);
        }
    }

    // Checking final state
    console.log('[RESET] Verifying deletion...');
    for (const type of targets) {
        const content = await QdrantKnowledgeService.getPrompt(type);
        if (!content) {
            console.log(`[RESET] ✅ Prompt ${type} is efficiently GONE.`);
        } else {
            console.log(`[RESET] ⚠️ Prompt ${type} still exists (length: ${content.length}).`);
        }
    }

    console.log('[RESET] Cleanup complete. Iva is now lighter.');
};

resetPrompts();
