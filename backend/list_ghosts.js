require('dotenv').config();
const QdrantKnowledgeService = require('./services/QdrantKnowledgeService');

(async () => {
    console.log('🔍 Listing all Qdrant prompts...');
    try {
        const prompts = await QdrantKnowledgeService.listPrompts();
        console.log('Found prompts:', JSON.stringify(prompts, null, 2));

        const canonical = ['system', 'module', 'company', 'department', 'role', 'user'];
        const ghosts = prompts.filter(p => !canonical.includes(p));

        console.log('\n👻 Ghost Prompts detected:', ghosts);

        // Peek at content
        for (const ghost of ghosts) {
            const content = await QdrantKnowledgeService.getPrompt(ghost);
            console.log(`\n--- CONTENT OF [${ghost}] ---`);
            console.log(content.substring(0, 200) + '...');
        }

    } catch (e) {
        console.error('Error:', e);
    }
})();
