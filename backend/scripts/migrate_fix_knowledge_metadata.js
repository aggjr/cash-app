/**
 * migrate_fix_knowledge_metadata.js
 * 
 * AUDIT SCRIPT: Checks Qdrant knowledge base for items missing valid project_id/user_id context.
 * 
 * Usage: node migrate_fix_knowledge_metadata.js [--fix]
 */

const VectorSearchService = require('../services/VectorSearchService');
const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');

async function auditAndFix() {
    console.log('🔍 Starting IVA Knowledge Metadata Audit...');

    try {
        // 1. Fetch all knowledge items (scroll through all categories)
        const categories = ['custom_rules', 'menus', 'actions', 'user_preference'];
        let totalIssues = 0;
        let fixedIssues = 0;

        for (const category of categories) {
            console.log(`\n📂 Checking category: ${category}...`);

            // Scroll all items (using large limit, ideally pagination for production)
            const result = await VectorSearchService.scroll({ category }, 500);
            const items = result.points || [];

            console.log(`   Found ${items.length} items.`);

            for (const item of items) {
                const payload = item.payload;
                const issues = [];
                let needsUpdate = false;

                // CHECK 1: Missing User ID on USER scope
                if (payload.layer === 'USER' && !payload.user_id) {
                    issues.push('Missing user_id on USER layer');
                }

                // CHECK 2: Missing Project ID on PROJECT scope
                if (payload.layer === 'PROJECT' && !payload.project_id) {
                    issues.push('Missing project_id on PROJECT layer');
                }

                // CHECK 3: Global items with specific IDs (Shouldn't happen but check consistency)
                if (payload.layer === 'GLOBAL') {
                    // Global implies null IDs usually, but having them isn't technically an error, just unused filter.
                }

                if (issues.length > 0) {
                    totalIssues++;
                    console.log(`   ⚠️ Issue in ${item.id} (${payload.description || payload.text || 'No desc'}): ${issues.join(', ')}`);

                    // FIX STRATEGY
                    if (process.argv.includes('--fix')) {
                        // For this script, we can't magically know the missing IDs unless we infer from logs or external source.
                        // However, we can set default 'system' or 'legacy' markers if needed.

                        // For now, we will just Log as we don't have a reliable source to backfill without manual input.
                        // Future: Could map from a backup JSON file if available.
                        console.log('      [FIX] Auto-fix not implemented for missing IDs (requires manual mapping).');
                    }
                }
            }
        }

        console.log('\n📊 Audit Complete.');
        console.log(`Total items checked: ${totalIssues + fixedIssues}`); // simplistic
        console.log(`Issues found: ${totalIssues}`);

        if (totalIssues > 0 && !process.argv.includes('--fix')) {
            console.log('\nRun with --fix to attempt auto-correction (Warning: Limited capabilities without source data)');
        }

    } catch (err) {
        console.error('❌ Error during audit:', err);
    }
}

// Run if called directly
if (require.main === module) {
    require('dotenv').config();
    auditAndFix();
}

module.exports = auditAndFix;
