const VectorSearchService = require('../services/VectorSearchService');

/**
 * Clean orphaned USER knowledge without projectId
 * This knowledge was saved before the projectId fix and cannot be properly retrieved
 */
async function cleanOrphanedUserKnowledge() {
    console.log('🧹 Cleaning orphaned knowledge without projectId...\n');

    try {
        // Layers that REQUIRE projectId
        const projectSpecificLayers = ['USER', 'ROLE', 'DEPT', 'COMPANY'];

        let totalOrphaned = 0;
        let totalValid = 0;

        for (const layer of projectSpecificLayers) {
            console.log(`\n📋 Checking ${layer} layer...`);

            const results = await VectorSearchService.scroll({
                layer: layer
            }, 100);

            if (!results || !results.points || results.points.length === 0) {
                console.log(`   ℹ️  No ${layer} knowledge found`);
                continue;
            }

            // Filter orphaned entries (no projectId)
            const orphaned = results.points.filter(point => {
                const hasProjectId = point.payload.projectId || point.payload.project_id;
                return !hasProjectId;
            });

            const valid = results.points.length - orphaned.length;

            console.log(`   📊 Found ${results.points.length} entries (${orphaned.length} orphaned, ${valid} valid)`);

            if (orphaned.length > 0) {
                console.log(`   🗑️  Deleting ${orphaned.length} orphaned entries...`);

                for (const point of orphaned) {
                    const text = point.payload.text?.substring(0, 50) || 'No text';
                    console.log(`      - ${text}...`);
                    await VectorSearchService.deletePointByUuid(point.id);
                }

                console.log(`   ✅ Deleted ${orphaned.length} orphaned entries`);
            }

            totalOrphaned += orphaned.length;
            totalValid += valid;
        }

        console.log(`\n📊 Summary:`);
        console.log(`   - Total orphaned (deleted): ${totalOrphaned}`);
        console.log(`   - Total valid (kept): ${totalValid}`);
        console.log(`\n✅ Cleanup completed!`);
        console.log('🎉 All project-specific knowledge now has projectId.\n');

    } catch (err) {
        console.error('❌ Error cleaning orphaned knowledge:', err.message);
        console.error(err);
        process.exit(1);
    }
}

// Run the script
cleanOrphanedUserKnowledge()
    .then(() => {
        console.log('✨ Script completed successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('💥 Script failed:', err);
        process.exit(1);
    });
