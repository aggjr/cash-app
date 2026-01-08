/**
 * Migration Script: Export IVA Data from MySQL to Qdrant
 * 
 * This script migrates ALL IVA-specific data from MySQL to Qdrant
 * Following the LAW: KNOWLEDGE USED ONLY BY IVA = ONLY QDRANT
 */

const db = require('../config/database');
const IvaUserPreferences = require('../services/IvaUserPreferences');

async function migrateIvaDataToQdrant() {
    console.log('\n🚀 Starting IVA Data Migration: MySQL → Qdrant\n');

    try {
        // Get all users with IVA data
        const [users] = await db.query(`
            SELECT 
                id, 
                name,
                preferred_name, 
                iva_preferences, 
                iva_introduced, 
                iva_voice_enabled, 
                iva_voice_rate,
                iva_voice_premium,
                iva_voice_male
            FROM users
            WHERE preferred_name IS NOT NULL 
               OR iva_introduced = 1 
               OR iva_voice_enabled IS NOT NULL
        `);

        console.log(`📊 Found ${users.length} users with IVA data\n`);

        let migrated = 0;
        let errors = 0;

        for (const user of users) {
            console.log(`\n👤 Migrating user ${user.id} (${user.name})...`);

            try {
                // Migrate preferred name
                if (user.preferred_name) {
                    await IvaUserPreferences.setPreferredName(user.id, user.preferred_name);
                    console.log(`  ✅ Preferred name: "${user.preferred_name}"`);
                }

                // Migrate introduction status
                if (user.iva_introduced) {
                    await IvaUserPreferences.markIntroduced(user.id);
                    console.log(`  ✅ Introduction status: true`);
                }

                // Migrate voice settings
                if (user.iva_voice_enabled !== null) {
                    const voiceSettings = {
                        enabled: user.iva_voice_enabled === 1,
                        rate: user.iva_voice_rate || 75,
                        premium: user.iva_voice_premium || 2,
                        male: user.iva_voice_male || 0
                    };
                    await IvaUserPreferences.setVoiceSettings(user.id, voiceSettings);
                    console.log(`  ✅ Voice settings:`, voiceSettings);
                }

                migrated++;
            } catch (err) {
                console.error(`  ❌ Error migrating user ${user.id}:`, err.message);
                errors++;
            }
        }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`🎉 Migration Complete!`);
        console.log(`✅ Migrated: ${migrated} users`);
        console.log(`❌ Errors: ${errors} users`);
        console.log(`${'='.repeat(50)}\n`);

        if (errors === 0) {
            console.log('✅ All data migrated successfully!');
            console.log('📝 Next step: Remove MySQL columns with migration script');
        } else {
            console.log('⚠️ Some errors occurred. Review logs before removing MySQL columns.');
        }

    } catch (err) {
        console.error('\n❌ CRITICAL ERROR:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }

    process.exit(0);
}

// Run migration
migrateIvaDataToQdrant();
