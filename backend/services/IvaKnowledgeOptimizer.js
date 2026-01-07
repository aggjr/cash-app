const IvaGlobalKnowledge = require('./IvaGlobalKnowledge');

/**
 * IVA Knowledge Optimizer
 * Periodically optimizes and consolidates global knowledge
 */
class IvaKnowledgeOptimizer {

    /**
     * Optimize knowledge (consolidate keywords, remove duplicates)
     */
    static async optimize() {
        console.log('[IVA Optimizer] Starting optimization...');

        const knowledge = await IvaGlobalKnowledge.load();
        let changes = 0;

        // Optimize each type
        for (const type of ['menus', 'actions', 'data_structures']) {
            knowledge.knowledge[type].forEach(item => {
                const before = JSON.stringify(item.keywords);

                // Consolidate keywords
                item.keywords = this.consolidateKeywords(item.keywords);

                if (JSON.stringify(item.keywords) !== before) {
                    changes++;
                }
            });

            // Sort by relevance
            knowledge.knowledge[type].sort((a, b) =>
                (b.usage_count * b.success_rate) - (a.usage_count * a.success_rate)
            );
        }

        knowledge.last_optimization = new Date().toISOString();
        await IvaGlobalKnowledge.save(knowledge);

        console.log(`[IVA Optimizer] Optimization complete. ${changes} items updated.`);

        return { success: true, changes };
    }

    /**
     * Consolidate keywords into categories
     */
    static consolidateKeywords(keywords) {
        // Already structured
        if (keywords.primary && keywords.synonyms && keywords.context) {
            return this.optimizeStructured(keywords);
        }

        // Convert array to structure
        if (Array.isArray(keywords)) {
            return {
                primary: keywords.slice(0, 3),
                synonyms: keywords.slice(3, 8),
                context: keywords.slice(8, 15)
            };
        }

        return keywords;
    }

    /**
     * Optimize structured keywords
     */
    static optimizeStructured(keywords) {
        // Remove duplicates (case-insensitive)
        const removeDuplicates = (arr) => {
            const seen = new Set();
            return arr.filter(k => {
                const lower = k.toLowerCase();
                if (seen.has(lower)) return false;
                seen.add(lower);
                return true;
            });
        };

        return {
            primary: removeDuplicates(keywords.primary || []).slice(0, 3),
            synonyms: removeDuplicates(keywords.synonyms || []).slice(0, 8),
            context: removeDuplicates(keywords.context || []).slice(0, 10)
        };
    }

    /**
     * Get optimization stats
     */
    static async getStats() {
        const knowledge = await IvaGlobalKnowledge.load();

        const stats = {
            total_items: 0,
            total_keywords: 0,
            avg_keywords_per_item: 0,
            last_optimization: knowledge.last_optimization,
            items_by_type: {}
        };

        for (const type of ['menus', 'actions', 'data_structures']) {
            const items = knowledge.knowledge[type];
            stats.items_by_type[type] = items.length;
            stats.total_items += items.length;

            items.forEach(item => {
                const allKeywords = IvaGlobalKnowledge.getAllKeywords(item.keywords);
                stats.total_keywords += allKeywords.length;
            });
        }

        stats.avg_keywords_per_item = stats.total_items > 0
            ? (stats.total_keywords / stats.total_items).toFixed(1)
            : 0;

        return stats;
    }
}

module.exports = IvaKnowledgeOptimizer;
