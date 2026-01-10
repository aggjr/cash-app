require('dotenv').config();
const QdrantKnowledgeService = require('./services/QdrantKnowledgeService.js');

(async () => {
    console.log('🔍 Starting Ghost Prompts Migration...');
    try {
        const prompts = await QdrantKnowledgeService.listPrompts();
        console.log('Found full list:', prompts);

        const canonical = ['system', 'module', 'company', 'department', 'role', 'user'];
        const ghosts = prompts.filter(p => !canonical.includes(p));

        if (ghosts.length === 0) {
            console.log('✅ No ghost prompts found.');
            return;
        }

        console.log(`👻 Found ${ghosts.length} ghosts:`, ghosts);

        for (const ghost of ghosts) {
            console.log(`\nProcessing ghost: ${ghost}...`);
            const content = await QdrantKnowledgeService.getPrompt(ghost);

            let target = null;
            if (ghost.startsWith('role_') || ghost.includes('cargo')) target = 'role';
            else if (ghost.startsWith('department_') || ghost.includes('depto')) target = 'department';
            else {
                console.log(`⚠️ Unknown category for ${ghost}, skipping automated move (will just delete).`);
            }

            if (target && content && content.length > 5) {
                console.log(`➡️ Moving content to [${target}]...`);
                // 1. Get current target content
                const currentTarget = await QdrantKnowledgeService.getPrompt(target);

                // 2. Append
                const newContent = `${currentTarget}\n\n[MIGRATED FROM ${ghost.toUpperCase()}]:\n${content}`;

                // 3. Save target
                await QdrantKnowledgeService.savePrompt(target, newContent);
                console.log('✅ Content appended.');
            }

            // 4. Delete ghost point
            // QdrantKnowledgeService doesn't have deletePrompt, but VectorSearchService has deleteKnowledge
            // Point ID is `prompt_${ghost}`
            // wait, QdrantKnowledgeService.getPrompt uses `prompt_${type}`.
            // So we delete `prompt_${ghost}`.

            const VectorSearchService = require('./services/VectorSearchService.js');
            await VectorSearchService.deleteKnowledge(`prompt_${ghost}`);
            console.log('🗑️ Ghost deleted.');
        }

        console.log('\n🎉 Migration Complete!');

    } catch (e) {
        console.error('❌ Error:', e);
    }
})();
