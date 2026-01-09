const fs = require('fs').promises;
const path = require('path');
const vectorService = require('./VectorSearchService');

/**
 * IVA Global Knowledge Manager
 * Manages global system knowledge shared across all users and projects
 */
class IvaGlobalKnowledge {
    static knowledgeCache = null;
    static lastLoad = null;
    static CACHE_TTL = 300000; // 5 minutes

    /**
     * Load global knowledge (Pure Qdrant)
     */
    static async load() {
        const now = Date.now();

        // Return cached if valid
        if (this.knowledgeCache && this.lastLoad && (now - this.lastLoad) < this.CACHE_TTL) {
            return this.knowledgeCache;
        }

        console.log('[IVA Knowledge] Loading knowledge from Qdrant (Pure Vector Mode)...');

        try {
            // Fetch relevant categories from Qdrant
            // Note: In a real vector system, we search by context. 
            // For now, to maintain compatibility, we fetch "all known" items via generic queries
            // or rely on the fact that formatForPrompt might be called with specific search results in the future.

            // For this implementation, we will fetch standard menus and actions 
            // We use a broad search or specific IDs if known, but here we scan for "menus" and "actions" layer GLOBAL

            const [menus, actions, rules] = await Promise.all([
                vectorService.search('menu', { category: 'menus', layer: 'GLOBAL' }, 50),
                vectorService.search('action', { category: 'actions', layer: 'GLOBAL' }, 50),
                vectorService.search('rule', { category: 'custom_rules', layer: 'GLOBAL' }, 20)
            ]);

            const knowledge = {
                knowledge: {
                    menus: menus.map(m => m.payload || m),
                    actions: actions.map(m => m.payload || m),
                    custom_rules: rules.map(m => m.payload || m)
                }
            };

            this.knowledgeCache = knowledge;
            this.lastLoad = now;
            return this.knowledgeCache;

        } catch (error) {
            console.error('[IVA Knowledge] Error loading from Qdrant:', error);
            // Return empty structure on error to prevent checks from failing
            return this.createEmpty();
        }
    }

    /**
     * Create empty knowledge structure
     */
    static createEmpty() {
        return {
            knowledge: {
                menus: [],
                actions: [],
                custom_rules: []
            }
        };
    }

    /**
     * Save/Update knowledge (Direct to Qdrant)
     */
    static async save(knowledge) {
        // In Pure Qdrant mode, "saving" the whole object isn't used.
        // We upsert individual items via contribute().
        // This method is kept for compatibility but does nothing or updates cache.
        this.knowledgeCache = knowledge;
        this.lastLoad = Date.now();
    }

    /**
     * Format knowledge for LLM prompt (optimized)
     */
    static formatForPrompt(knowledge) {
        let prompt = '\n╔═══ CONHECIMENTO DO SISTEMA CASH ═══╗\n\n';

        // Menus
        if (knowledge.knowledge.menus.length > 0) {
            prompt += '📋 MENUS:\n';
            knowledge.knowledge.menus
                .sort((a, b) => ((b.usage_count || 0) * (b.success_rate || 0)) - ((a.usage_count || 0) * (a.success_rate || 0)))
                .forEach(menu => {
                    // Safe access to keywords
                    const keywords = menu.keywords || {};
                    const primary = keywords.primary?.join(', ') || '';
                    const synCount = keywords.synonyms?.length || 0;

                    prompt += `• ${menu.screen_id || 'unknown'}: ${primary}`;
                    if (synCount > 0) prompt += ` [+${synCount}]`;
                    prompt += '\n';
                });
            prompt += '\n';
        }

        // Actions
        if (knowledge.knowledge.actions.length > 0) {
            prompt += '⚡ AÇÕES:\n';
            knowledge.knowledge.actions
                .sort((a, b) => ((b.usage_count || 0) * (b.success_rate || 0)) - ((a.usage_count || 0) * (a.success_rate || 0)))
                .slice(0, 20) // Top 20
                .forEach(action => {
                    // Safe access to keywords
                    const keywords = action.keywords || {};
                    const primary = keywords.primary?.join(', ') || '';
                    prompt += `• [${action.screen_id || 'unknown'}] ${action.action_type || 'action'}: ${primary}\n`;
                });
            prompt += '\n';
        }

        // Custom Rules
        if (knowledge.knowledge.custom_rules && knowledge.knowledge.custom_rules.length > 0) {
            prompt += '🧠 REGRAS APRENDIDAS (OBRIGATÓRIO SEGUIR):\n';
            prompt += 'Estas regras foram ensinadas pelo usuário e têm prioridade sobre qualquer outra lógica:\n';
            knowledge.knowledge.custom_rules
                .sort((a, b) => b.usage_count - a.usage_count)
                .forEach(rule => {
                    prompt += `• ${rule.description}\n`;
                });
            prompt += '\n';
        }

        prompt += '╚═════════════════════════════════════╝\n';
        prompt += 'IMPORTANTE: Siga as REGRAS APRENDIDAS rigorosamente para encontrar dados!\n\n';

        return prompt;
    }

    /**
     * Add or update knowledge
     */
    static async contribute(type, data, userId) {
        const knowledge = await this.load();

        // Find existing
        const existing = this.findExisting(knowledge, type, data);

        let itemToSync; // Item que será sincronizado com Qdrant

        if (existing) {
            // Update existing
            this.updateExisting(existing, data, userId);
            itemToSync = existing;
            console.log(`[IVA Knowledge] Updated ${type}:`, data.screen_id || data.action_id);
        } else {
            // Add new
            const newItem = this.createNewItem(data, userId);

            // Ensure array exists
            if (!knowledge.knowledge[type]) {
                console.warn(`[IVA Knowledge] Array for type '${type}' not found, initializing empty array.`);
                knowledge.knowledge[type] = [];
            }

            knowledge.knowledge[type].push(newItem);
            itemToSync = newItem;
            console.log(`[IVA Knowledge] Added new ${type}:`, data.screen_id || data.action_id);
        }

        knowledge.total_interactions++;
        await this.save(knowledge);

        // Sync with Qdrant in background
        this.syncWithQdrant(type, itemToSync, userId).catch(err =>
            console.error('[IVA Knowledge] Qdrant sync failed:', err.message)
        );

        return { success: true };
    }

    /**
     * Sync knowledge item with Qdrant
     */
    static async syncWithQdrant(type, item, userId) {
        console.log(`[IVA Qdrant] 🔄 Starting sync for type: ${type}`);
        console.log(`[IVA Qdrant] 📦 Item:`, JSON.stringify(item, null, 2));

        let textToEmbed = '';
        if (type === 'menus') {
            textToEmbed = `Menu/Tela ${item.screen_id}: ${this.getAllKeywords(item.keywords).join(', ')}. Objetivo: ${item.purpose || ''}`;
        } else if (type === 'actions') {
            textToEmbed = `Ação [${item.screen_id}] ${item.action_type}: ${this.getAllKeywords(item.keywords).join(', ')}. Descrição: ${item.description || ''}`;
        } else if (type === 'custom_rules') {
            textToEmbed = `Regra Aprendida: ${item.description}`;
            console.log(`[IVA Qdrant] 📝 Text to embed: "${textToEmbed}"`);
        } else {
            console.log(`[IVA Qdrant] ⚠️ Unknown type: ${type}`);
        }

        if (!textToEmbed) {
            console.log(`[IVA Qdrant] ⚠️ No text to embed for type: ${type}. Skipping sync.`);
            return;
        }

        const metadata = {
            source: 'json_global',
            category: type,
            layer: 'GLOBAL',
            screen_id: item.screen_id,
            action_id: item.action_id,
            user_id: userId,
            created_at: new Date().toISOString()
        };

        const qdrantId = `global_${type}_${item.screen_id || item.action_id || Math.random().toString(36).substring(7)}`;
        console.log(`[IVA Qdrant] 🆔 Generated ID: ${qdrantId}`);
        console.log(`[IVA Qdrant] 📊 Metadata:`, metadata);

        try {
            console.log(`[IVA Qdrant] 📡 Calling vectorService.upsertKnowledge...`);
            await vectorService.upsertKnowledge(qdrantId, textToEmbed, metadata);
            console.log(`[IVA Qdrant] ✅ Synced successfully to Qdrant!`);
        } catch (err) {
            console.error(`[IVA Qdrant] ❌ Sync failed:`, err.message);
            console.error(`[IVA Qdrant] Stack:`, err.stack);
            throw err; // Re-throw to propagate error
        }
    }

    /**
     * Find existing knowledge item
     */
    static findExisting(items, data) {
        // Match by ID
        if (data.screen_id || data.action_id) {
            const match = items.find(item =>
                item.screen_id === data.screen_id &&
                (!data.action_id || item.action_id === data.action_id)
            );
            if (match) return match;
        }

        // Match by keyword overlap
        if (data.keywords) {
            const keywords = Array.isArray(data.keywords) ? data.keywords :
                data.keywords.primary || [];

            return items.find(item => {
                const itemKeywords = this.getAllKeywords(item.keywords);
                return this.calculateOverlap(itemKeywords, keywords) > 0.5;
            });
        }

        return null;
    }

    /**
     * Update existing item
     */
    static updateExisting(item, data, userId) {
        // Update metrics
        item.usage_count = (item.usage_count || 0) + 1;

        if (data.success !== undefined) {
            const oldTotal = item.usage_count - 1;
            const oldSum = oldTotal * (item.success_rate || 0.5);
            item.success_rate = (oldSum + (data.success ? 1 : 0)) / item.usage_count;
        }

        // Expand keywords
        if (data.keywords) {
            const newKeywords = Array.isArray(data.keywords) ? data.keywords :
                data.keywords.primary || [];

            this.expandKeywords(item.keywords, newKeywords);
        }

        // Track contributors
        if (userId) {
            item.contributor_ids = item.contributor_ids || [];
            if (!item.contributor_ids.includes(userId)) {
                item.contributor_ids.push(userId);
                item.contributed_by = item.contributor_ids.length;
            }
        }
    }

    /**
     * Create new knowledge item
     */
    static createNewItem(data, userId) {
        const item = {
            ...data,
            usage_count: 1,
            success_rate: data.success !== undefined ? (data.success ? 1.0 : 0.5) : 0.8,
            contributed_by: 1,
            contributor_ids: userId ? [userId] : [],
            consecutive_failures: 0,
            never_delete: false,
            created_at: new Date().toISOString()
        };

        // Ensure keywords structure
        if (item.keywords && !item.keywords.primary) {
            const keywords = Array.isArray(item.keywords) ? item.keywords : [];
            item.keywords = {
                primary: keywords.slice(0, 3),
                synonyms: keywords.slice(3, 8),
                context: keywords.slice(8)
            };
        }

        delete item.success;
        delete item.userId;

        return item;
    }

    /**
     * Expand keywords intelligently
     */
    static expandKeywords(existing, newKeywords) {
        if (!existing.primary) {
            existing.primary = [];
            existing.synonyms = [];
            existing.context = [];
        }

        const allExisting = this.getAllKeywords(existing);

        newKeywords.forEach(keyword => {
            const normalized = keyword.toLowerCase().trim();

            // Skip if already exists
            if (allExisting.some(k => k.toLowerCase() === normalized)) return;

            // Categorize and add
            if (existing.primary.length < 3) {
                existing.primary.push(normalized);
            } else if (existing.synonyms.length < 8) {
                existing.synonyms.push(normalized);
            } else if (existing.context.length < 10) {
                existing.context.push(normalized);
            }
        });
    }

    /**
     * Get all keywords from structured object
     */
    static getAllKeywords(keywords) {
        if (Array.isArray(keywords)) return keywords;

        return [
            ...(keywords.primary || []),
            ...(keywords.synonyms || []),
            ...(keywords.context || [])
        ];
    }

    /**
     * Calculate keyword overlap (0 to 1)
     */
    static calculateOverlap(keywords1, keywords2) {
        const set1 = new Set(keywords1.map(k => k.toLowerCase()));
        const set2 = new Set(keywords2.map(k => k.toLowerCase()));

        const intersection = [...set1].filter(k => set2.has(k));
        const union = new Set([...set1, ...set2]);

        return intersection.length / union.size;
    }

    /**
     * Extract keywords from text
     */
    static extractKeywords(text) {
        const stopWords = ['o', 'a', 'de', 'da', 'do', 'em', 'para', 'com', 'que', 'é', 'um', 'uma'];

        return text
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.includes(word))
            .slice(0, 10);
    }

    /**
     * Record failure (for self-healing)
     */
    static async recordFailure(type, itemId) {
        const knowledge = await this.load();
        const item = knowledge.knowledge[type].find(i =>
            i.screen_id === itemId || i.action_id === itemId
        );

        if (!item) return;

        // Increment failure counter
        item.consecutive_failures = (item.consecutive_failures || 0) + 1;
        item.last_failure = new Date().toISOString();

        // Update success rate
        item.usage_count++;
        const oldSum = (item.usage_count - 1) * item.success_rate;
        item.success_rate = oldSum / item.usage_count;

        console.log(`[IVA Knowledge] ❌ Failure ${item.consecutive_failures}/5 for ${itemId}`);

        // Auto-remove if 5 consecutive failures
        if (item.consecutive_failures >= 5) {
            console.log(`[IVA Knowledge] 🗑️ Removing obsolete: ${itemId}`);
            knowledge.knowledge[type] = knowledge.knowledge[type].filter(i =>
                i.screen_id !== itemId && i.action_id !== itemId
            );
        }

        await this.save(knowledge);
    }

    /**
     * Record success (resets failure counter)
     */
    static async recordSuccess(type, itemId) {
        const knowledge = await this.load();
        const item = knowledge.knowledge[type].find(i =>
            i.screen_id === itemId || i.action_id === itemId
        );

        if (!item) return;

        item.consecutive_failures = 0;
        item.last_success = new Date().toISOString();

        await this.save(knowledge);
    }
}

module.exports = IvaGlobalKnowledge;
