/**
 * Script to delete "Guto" preference from Qdrant
 * Run this on the server after the backend has been updated
 */

const IvaUserPreferences = require('../services/IvaUserPreferences');

(async () => {
    console.log('🧹 Cleaning up stuck "Guto" preference from Qdrant...\n');

    try {
        // Get user ID - replace with actual user ID
        const userId = process.argv[2];

        if (!userId) {
            console.error('❌ Error: Please provide user ID as argument');
            console.log('Usage: node scripts/cleanup_guto_preference.js <user_id>');
            process.exit(1);
        }

        console.log(`👤 User ID: ${userId}\n`);

        // Method 1: Save a new preferred name (this should trigger cleanup of old "Guto" rules)
        console.log('📝 Method 1: Overwriting with new preferred name...');
        const result = await IvaUserPreferences.savePreferredName(userId, 'Sr. Augusto');
        console.log('✅ Preferred name saved:', result);

        // Method 2: List all user preferences to verify
        console.log('\n📋 Listing all user preferences...');
        const prefs = await IvaUserPreferences.listUserPreferences(userId);
        console.log('User preferences:', JSON.stringify(prefs, null, 2));

        // Method 3: Get the current preferred name
        console.log('\n🔍 Getting current preferred name...');
        const preferredName = await IvaUserPreferences.getPreferredName(userId);
        console.log('Current preferred name:', preferredName);

        console.log('\n✅ Cleanup complete!');
        console.log('\n💡 Next steps:');
        console.log('1. Restart the backend to reload the updated prompt');
        console.log('2. Clear the IVA chat and start a new conversation');
        console.log('3. Verify IVA uses "Sr. Augusto" in the greeting');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
})();
