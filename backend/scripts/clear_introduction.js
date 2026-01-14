const VectorSearchService = require('../services/VectorSearchService');

/**
 * Clear hardcoded introduction from Qdrant
 * This allows the LLM to generate dynamic greetings instead of using the hardcoded one
 */
async function clearIntroduction() {
    console.log('🧹 Clearing hardcoded introduction from Qdrant...\n');

    try {
        // Search for introduction entries
        const results = await VectorSearchService.scroll({
            category: 'introduction'
        }, 10);

        if (!results || !results.points || results.points.length === 0) {
            console.log('ℹ️  No introduction entries found in Qdrant.');
            console.log('✅ Nothing to clear!\n');
            return;
        }

        console.log(`📋 Found ${results.points.length} introduction entry(ies):\n`);

        // Delete each introduction entry
        for (const point of results.points) {
            console.log(`   - Deleting: ${point.payload.text?.substring(0, 50)}...`);
            await VectorSearchService.deletePointByUuid(point.id);
        }

        console.log(`\n✅ Successfully cleared ${results.points.length} introduction entry(ies)!`);
        console.log('🎉 The LLM will now generate dynamic greetings based on context.\n');

    } catch (err) {
        console.error('❌ Error clearing introduction:', err.message);
        console.error(err);
        process.exit(1);
    }
}

// Run the script
clearIntroduction()
    .then(() => {
        console.log('✨ Script completed successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('💥 Script failed:', err);
        process.exit(1);
    });
