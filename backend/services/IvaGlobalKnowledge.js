const fs = require('fs').promises;
const path = require('path');

/**
 * IVA Global Knowledge Manager
 * Manages global system knowledge shared across all users and projects
 */
class IvaGlobalKnowledge {
    static KNOWLEDGE_FILE = path.join(__dirname, '../data/iva_global_knowledge.json');
    static knowledgeCache = null;
    static lastLoad = null;
    static CACHE_TTL = 300000; // 5 minutes

    /**
     * Load global knowledge (with cache)
     */
    static async load() {
        const now = Date.now();

        // Return cached if valid
        if (this.knowledgeCache && this.lastLoad && (now - this.lastLoad) < this.CACHE_TTL) {
            return this.knowledgeCache;
        }

        try {
            const data = await fs.readFile(this.KNOWLEDGE_FILE, 'utf8');
            this.knowledgeCache = JSON.parse(data);
            this.lastLoad = now;
            return this.knowledgeCache;
        } catch (error) {
            // Create new if doesn't exist
            console.log('[IVA Knowledge] Creating new knowledge base');
            const newKnowledge = this.createEmpty();
            await this.save(newKnowledge);
            return newKnowledge;
        }
    }

    /**
     * Create empty knowledge structure
     */
    static createEmpty() {
        return {
            system: 'CASH',
            version: '1.0',
            last_updated: new Date().toISOString(),
            last_optimization: new Date().toISOString(),
            total_interactions: 0,
            total_contributors: 0,
            knowledge: {
                menus: [],
                actions: [],
                data_structures: [],
                common_queries: []
            }
        };
    }

    /**
     * Save knowledge to file
     */
    static async save(knowledge) {
        knowledge.last_updated = new Date().toISOString();

        // Ensure data directory exists
        const dataDir = path.dirname(this.KNOWLEDGE_FILE);
        await fs.mkdir(dataDir, { recursive: true });

        await fs.writeFile(this.KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));
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
                .sort((a, b) => (b.usage_count * b.success_rate) - (a.usage_count * a.success_rate))
                .forEach(menu => {
                    const primary = menu.keywords.primary?.join(', ') || '';
                    const synCount = menu.keywords.synonyms?.length || 0;

                    prompt += `• ${menu.screen_id}: ${primary}`;
                    if (synCount > 0) prompt += ` [+${synCount}]`;
                    prompt += '\n';
                });
            prompt += '\n';
        }

        // Actions
        if (knowledge.knowledge.actions.length > 0) {
            prompt += '⚡ AÇÕES:\n';
            knowledge.knowledge.actions
                .sort((a, b) => (b.usage_count * b.success_rate) - (a.usage_count * a.success_rate))
                .slice(0, 20) // Top 20
                .forEach(action => {
                    const primary = action.keywords.primary?.join(', ') || '';
                    prompt += `• [${action.screen_id}] ${action.action_type}: ${primary}\n`;
                });
            prompt += '\n';
        }

        prompt += '╚═════════════════════════════════════╝\n';
        prompt += 'IMPORTANTE: Consulte este conhecimento PRIMEIRO!\n\n';

        return prompt;
    }

    /**
     * Add or update knowledge
     */
    static async contribute(type, data, userId) {
        const knowledge = await this.load();

        // Find existing
        const existing = this.findExisting(knowledge.knowledge[type], data);

        if (existing) {
            // Update existing
            this.updateExisting(existing, data, userId);
            console.log(`[IVA Knowledge] Updated ${type}:`, data.screen_id || data.action_id);
        } else {
            // Add new
            const newItem = this.createNewItem(data, userId);
            knowledge.knowledge[type].push(newItem);
            console.log(`[IVA Knowledge] Added new ${type}:`, data.screen_id || data.action_id);
        }

        knowledge.total_interactions++;
        await this.save(knowledge);

        return { success: true };
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
