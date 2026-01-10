require('dotenv').config();
const IvaUserPreferences = require('./services/IvaUserPreferences');
const VectorSearchService = require('./services/VectorSearchService');

(async () => {
    console.log('🔍 Starting IVA Preferences Debug...');

    const testUserId = 99999;
    const testName = 'Sr. Teste Debug';

    try {
        // 1. Check collection
        console.log('1. Checking collection...');
        await VectorSearchService.ensureCollection();
        console.log('✅ Collection exists/created.');

        // 2. Write Preference
        console.log(`2. Writing preference for user ${testUserId}...`);
        const success = await IvaUserPreferences.setPreferredName(testUserId, testName);
        console.log(`Write result: ${success}`);

        if (!success) {
            console.error('❌ Write failed!');
            process.exit(1);
        }

        // 3. Wait a bit (even with wait:true)
        console.log('3. Waiting 2s...');
        await new Promise(r => setTimeout(r, 2000));

        // 4. Read Preference
        console.log(`4. Reading preference for user ${testUserId}...`);
        const name = await IvaUserPreferences.getPreferredName(testUserId);
        console.log(`Read result: "${name}"`);

        // 5. Verify
        if (name === testName) {
            console.log('✅ SUCCESS: Persistence is working correclty.');
        } else {
            console.error(`❌ FAILURE: Expected "${testName}", got "${name}"`);

            // Debug: Search generally to see if it exists with different ID
            console.log('Debug: Searching for points with user_id payload...');
            const searchResults = await VectorSearchService.scroll({
                user_id: testUserId,
                preference_type: 'preferred_name'
            });
            console.log('Scroll results:', JSON.stringify(searchResults, null, 2));
        }

    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error);
    }
})();
