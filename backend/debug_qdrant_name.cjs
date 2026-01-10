const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const QdrantKnowledgeService = require('./services/QdrantKnowledgeService');
const VectorSearchService = require('./services/VectorSearchService');

// Mock user context
const userId = 3; // From screenshot context
const userName = 'Augusto Gonçalves';

async function debugUserRules() {
    console.log(`Checking Qdrant rules for User ${userId}...`);

    try {
        // 1. Check all USER scope custom rules
        console.log('\n--- Learned Rules (USER Scope) ---');
        const userRules = await QdrantKnowledgeService.getLearnedRules('USER', { userId: userId });

        if (userRules.length === 0) {
            console.log('(None)');
        } else {
            userRules.forEach((rule, i) => {
                console.log(`${i + 1}. ${rule}`);
            });
        }

        // 2. Check Preferred Name directly (Validation)
        console.log('\n--- Preferred Name Record ---');
        const pointId = `user_${userId}_preferred_name`;
        const res = await VectorSearchService.retrieve(pointId);

        if (res && res.length > 0) {
            console.log('Stored Value:', res[0].payload.value);
        } else {
            console.log('NOT FOUND!');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

// Initialize Qdrant connection if needed (assuming service handles it)
debugUserRules();
