const VectorSearchService = require('./VectorSearchService');

/**
 * IVA User Preferences Service
 * Manages ALL user preferences in Qdrant (USER layer)
 * 
 * LAW: KNOWLEDGE USED ONLY BY IVA = ONLY QDRANT
 */
class IvaUserPreferences {
    /**
     * Get user's preferred name
     */
    static async getPreferredName(userId) {
        console.log(`[IVA Preferences] Getting preferred name for user ${userId}`);
        const pointId = `user_${userId}_preferred_name`;

        try {
            // Use retrieve (ID lookup) instead of search to guarantee we get the single specific record
            const results = await VectorSearchService.retrieve(pointId);

            if (results && results.length > 0) {
                // retrieve returns array of points. Payload has 'value'
                const preferredName = results[0].payload.value;
                console.log(`[IVA Preferences] Preferred name (ID lookup): ${preferredName}`);
                return preferredName;
            } else {
                console.log(`[IVA Preferences] No preferred name found for ID: ${pointId}`);
                return null;
            }
        } catch (err) {
            console.error(`[IVA Preferences] Error getting preferred name:`, err.message);
            return null;
        }
    }

    /**
     * Set user's preferred name
     */
    static async setPreferredName(userId, name) {
        console.log(`[IVA Preferences] Setting preferred name for user ${userId}: "${name}"`);

        try {
            await VectorSearchService.upsertKnowledge(
                `user_${userId}_preferred_name`,
                `Usuário prefere ser chamado de ${name}`,
                {
                    category: 'user_preference',
                    layer: 'USER',
                    user_id: userId,
                    preference_type: 'preferred_name',
                    value: name,
                    updated_at: new Date().toISOString()
                }
            );
            console.log(`[IVA Preferences] [OK] Preferred name saved to Qdrant`);

            // --- SELF-HEALING: Purge conflicting rules associated with old names
            await this.purgeConflictingRules(userId, name);

            return true;
        } catch (err) {
            console.error(`[IVA Preferences] ❌ Error saving preferred name:`, err.message);
            return false;
        }
    }

    /**
     * Purge conflicting name rules from USER scope
     */
    static async purgeConflictingRules(userId, newName) {
        console.log(`[IVA Preferences] 🧹 Purging conflicting name rules for user ${userId}...`);
        try {
            // 1. Fetch all custom_rules for this user
            const results = await VectorSearchService.scroll({
                layer: 'USER',
                category: 'custom_rules',
                user_id: userId
            }, 50); // Limit 50 should be enough for name rules

            // 2. Filter for name-related rules
            // Match: "meu nome", "chame de", "guto", "augusto" (if different from new name)
            const keywordRegex = /(meu nome|chame de|trate como|sou o|apelido)/i;
            const newNameParts = newName.toLowerCase().split(' ');

            const pointsToDelete = results.points.filter(p => {
                const text = (p.payload.description || p.payload.text || '').toLowerCase();

                // Matches "my name is..." pattern
                const isNameRule = keywordRegex.test(text);

                // If it's a name rule, check if it contradicts the NEW name
                if (isNameRule) {
                    const matchesNewName = newNameParts.some(part => text.includes(part));
                    // If rule doesn't mention the new name, it's likely OLD/Legacy/Conflicting -> DELETE
                    // E.g. New="Augusto", Rule="Sou Guto" -> Delete
                    // E.g. New="Augusto", Rule="Sou Augusto" -> Keep (or delete to avoid dupes? Let's delete to be safe)
                    return true; // Aggressive cleanup: Delete ALL name rules, rely on 'preferred_name' preference only.
                }
                return false;
            });

            if (pointsToDelete.length > 0) {
                console.log(`[IVA Preferences] Found ${pointsToDelete.length} conflicting name rules. Deleting...`);
                for (const point of pointsToDelete) {
                    await VectorSearchService.deletePointByUuid(point.id);
                    console.log(`[IVA Preferences] 🗑️ Deleted rule: "${point.payload.description}"`);
                }
            } else {
                console.log(`[IVA Preferences] No conflicting name rules found.`);
            }

        } catch (err) {
            console.error(`[IVA Preferences] Error purging conflicts:`, err.message);
        }
    }

    /**
     * Get user's last IVA access timestamp
     */
    static async getLastAccess(userId) {
        try {
            const results = await VectorSearchService.search(
                `último acesso iva usuário ${userId}`,
                {
                    category: 'user_preference',
                    layer: 'USER',
                    user_id: userId,
                    preference_type: 'last_iva_access'
                },
                1
            );

            return results[0]?.value || null;
        } catch (err) {
            console.error(`[IVA Preferences] Error getting last access:`, err.message);
            return null;
        }
    }

    /**
     * Update user's last IVA access timestamp
     */
    static async updateLastAccess(userId) {
        const now = new Date().toISOString();

        try {
            await VectorSearchService.upsertKnowledge(
                `user_${userId}_last_iva_access`,
                `Último acesso à IVA em ${now}`,
                {
                    category: 'user_preference',
                    layer: 'USER',
                    user_id: userId,
                    preference_type: 'last_iva_access',
                    value: now,
                    updated_at: now
                }
            );
            return now;
        } catch (err) {
            console.error(`[IVA Preferences] Error updating last access:`, err.message);
            return null;
        }
    }

    /**
     * Get voice settings
     */
    static async getVoiceSettings(userId) {
        console.log(`[IVA Preferences] Getting voice settings for user ${userId}`);

        try {
            const results = await VectorSearchService.search(
                `configurações de voz usuário ${userId}`,
                {
                    category: 'user_preference',
                    layer: 'USER',
                    user_id: userId,
                    preference_type: 'voice'
                },
                1
            );

            const settings = results[0]?.value || {
                enabled: false,
                rate: 75,
                premium: 2,
                male: 0
            };

            console.log(`[IVA Preferences] Voice settings:`, settings);
            return settings;
        } catch (err) {
            console.error(`[IVA Preferences] Error getting voice settings:`, err.message);
            return { enabled: false, rate: 75, premium: 2, male: 0 };
        }
    }

    /**
     * Set voice settings
     */
    static async setVoiceSettings(userId, settings) {
        console.log(`[IVA Preferences] Setting voice settings for user ${userId}`);

        try {
            await VectorSearchService.upsertKnowledge(
                `user_${userId}_voice_settings`,
                `Configurações de voz: ${settings.enabled ? 'habilitada' : 'desabilitada'}, velocidade ${settings.rate}`,
                {
                    category: 'user_preference',
                    layer: 'USER',
                    user_id: userId,
                    preference_type: 'voice',
                    value: settings,
                    updated_at: new Date().toISOString()
                }
            );
            console.log(`[IVA Preferences] ✅ Voice settings saved to Qdrant`);
            return true;
        } catch (err) {
            console.error(`[IVA Preferences] ❌ Error saving voice settings:`, err.message);
            return false;
        }
    }

    /**
     * Check if IVA was introduced to user
     */
    static async wasIntroduced(userId) {
        console.log(`[IVA Preferences] Checking introduction status for user ${userId}`);

        try {
            const results = await VectorSearchService.search(
                `iva apresentada usuário ${userId}`,
                {
                    category: 'user_preference',
                    layer: 'USER',
                    user_id: userId,
                    preference_type: 'introduction'
                },
                1
            );

            const introduced = results[0]?.value || false;
            console.log(`[IVA Preferences] Introduction status: ${introduced}`);
            return introduced;
        } catch (err) {
            console.error(`[IVA Preferences] Error checking introduction:`, err.message);
            return false;
        }
    }

    /**
     * Mark IVA as introduced
     */
    static async markIntroduced(userId) {
        console.log(`[IVA Preferences] Marking IVA as introduced for user ${userId}`);

        try {
            await VectorSearchService.upsertKnowledge(
                `user_${userId}_introduction`,
                `IVA foi apresentada ao usuário`,
                {
                    category: 'user_preference',
                    layer: 'USER',
                    user_id: userId,
                    preference_type: 'introduction',
                    value: true,
                    updated_at: new Date().toISOString()
                }
            );
            console.log(`[IVA Preferences] ✅ Introduction status saved to Qdrant`);
            return true;
        } catch (err) {
            console.error(`[IVA Preferences] ❌ Error saving introduction status:`, err.message);
            return false;
        }
    }

    /**
     * Get all preferences for a user
     */
    static async getAllPreferences(userId) {
        console.log(`[IVA Preferences] Getting all preferences for user ${userId}`);

        try {
            const [preferredName, voiceSettings, introduced] = await Promise.all([
                this.getPreferredName(userId),
                this.getVoiceSettings(userId),
                this.wasIntroduced(userId)
            ]);

            return {
                preferredName,
                voiceSettings,
                introduced
            };
        } catch (err) {
            console.error(`[IVA Preferences] Error getting all preferences:`, err.message);
            return {
                preferredName: null,
                voiceSettings: { enabled: false, rate: 75, premium: 2, male: 0 },
                introduced: false
            };
        }
    }
}

module.exports = IvaUserPreferences;
