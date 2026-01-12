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
    /**
     * Add or update knowledge with Scope support
     * @param {string} type - Knowledge type
     * @param {object} data - Data content
     * @param {object|string} context - Context object {userId, scope, department, role, projectId} or legacy userId string
     */
    static async contribute(type, data, context) {
        // Legacy support
        if (typeof context === 'string' || typeof context === 'number') {
            context = { userId: context, scope: 'GLOBAL' };
        }

        // Validate Critical Context
        if (!context.userId) {
            console.warn(`[IVA Knowledge] ⚠️ Contribution missing userId. Using 'system' default.`);
            context.userId = 'system';
        }
        if (!context.projectId && context.scope === 'PROJECT') {
            console.warn(`[IVA Knowledge] ⚠️ PROJECT scope contribution missing projectId. This may cause retrieval issues.`);
        }

        const knowledge = await this.load();

        // Find existing to determine Action (Create vs Update)
        const existing = this.findExisting(knowledge, type, data);

        // Scope Logic
        const scope = context.scope || 'GLOBAL';
        const isUserScope = scope === 'USER';

        // Auto-approve USER scope, Pending for others
        const status = isUserScope ? 'approved' : 'pending';
        const actionType = existing ? 'UPDATE' : 'CREATE';

        let itemToSync;

        if (existing) {
            // Update existing
            this.updateExisting(existing, data, context.userId);
            itemToSync = existing;
            console.log(`[IVA Knowledge] Updated ${type} (${status}):`, data.screen_id || data.action_id);

            // Store previous state for Diff if it's an update
            if (actionType === 'UPDATE' && !isUserScope) {
                itemToSync._audit_previous_description = existing.description || existing.text || '';
            }

        } else {
            // Add new
            const newItem = this.createNewItem(data, context.userId);

            // Ensure array exists
            if (!knowledge.knowledge[type]) {
                knowledge.knowledge[type] = [];
            }

            knowledge.knowledge[type].push(newItem);
            itemToSync = newItem;
            console.log(`[IVA Knowledge] Added new ${type} (${status}):`, data.screen_id || data.action_id);
        }

        knowledge.total_interactions++;
        await this.save(knowledge);

        // Sync with Qdrant in background
        this.syncWithQdrant(type, itemToSync, context, status, actionType).catch(err =>
            console.error('[IVA Knowledge] Qdrant sync failed:', err.message)
        );

        return { success: true, status };
    }

    /**
     * Sync knowledge item with Qdrant
     */
    static async syncWithQdrant(type, item, context, status = 'approved', actionType = 'CREATE') {
        console.log(`[IVA Qdrant] 🔄 Starting sync for type: ${type} [${status}]`);
        console.log(`[IVA Qdrant] Context: User=${context.userId}, Project=${context.projectId}, Scope=${context.scope}`);

        let textToEmbed = '';
        const scope = context.scope || 'GLOBAL';
        const scopePrefix = scope === 'GLOBAL' ? '(Global)' : `(${scope})`;

        if (type === 'menus') {
            textToEmbed = `${scopePrefix} Menu/Tela ${item.screen_id}: ${this.getAllKeywords(item.keywords).join(', ')}. Objetivo: ${item.purpose || ''}`;
        } else if (type === 'actions') {
            textToEmbed = `${scopePrefix} Ação [${item.screen_id}] ${item.action_type}: ${this.getAllKeywords(item.keywords).join(', ')}. Descrição: ${item.description || ''}`;
        } else if (type === 'custom_rules') {
            textToEmbed = `${scopePrefix} Regra Aprendida: ${item.description}`;
        }

        if (!textToEmbed) return;

        // Map Scope to Layer and Metadata
        const metadata = {
            source: 'iva_learning',
            category: type,
            layer: scope,
            screen_id: item.screen_id,
            action_id: item.action_id,
            user_id: context.userId,
            user_name: context.userName || null, // Added for Audit
            project_id: context.projectId || null, // Ensure explicit null if undefined
            department: context.department,
            role: context.role,
            created_at: new Date().toISOString(),

            // Audit Metadata
            audit_status: status, // 'pending' | 'approved' | 'rejected'
            audit_action: actionType, // 'CREATE' | 'UPDATE'
            previous_description: item._audit_previous_description || null, // For diffs
            proposed_prompt: textToEmbed // Store the actual text used for embedding
        };

        const safeId = item.screen_id || item.action_id || Math.random().toString(36).substring(7);
        const qdrantId = `${scope.toLowerCase()}_${type}_${safeId}`;

        try {
            await vectorService.upsertKnowledge(qdrantId, textToEmbed, metadata);
            console.log(`[IVA Qdrant] ✅ Synced to Qdrant (${status})! ID: ${qdrantId}`);
        } catch (err) {
            console.error(`[IVA Qdrant] ❌ Sync failed:`, err.message);
            throw err;
        }
    }

    /**
     * Get Pending Knowledge for Audit
     */
    static async getPendingKnowledge(scopeFilter = null) {
        try {
            const filter = {
                audit_status: 'pending'
            };
            if (scopeFilter) {
                filter.layer = scopeFilter;
            }

            const results = await vectorService.scroll(filter, 100);
            return results.points.map(p => ({
                id: p.id,
                ...p.payload
            }));
        } catch (error) {
            console.error('[IVA Knowledge] Error getting pending:', error);
            return [];
        }
    }

    /**
     * Approve Knowledge
     */
    static async approveKnowledge(id, refinedText = null) {
        try {
            // 1. Retrieve the point to get current metadata
            const points = await vectorService.retrieve(id);
            if (!points || points.length === 0) throw new Error('Knowledge not found');

            const point = points[0];
            const payload = point.payload;

            // 2. Update status to approved
            payload.audit_status = 'approved';
            payload.audit_approved_at = new Date().toISOString();

            // 3. Apply refinement if provided
            let textToEmbed = refinedText || payload.proposed_prompt;

            // Define scope prefix for reconstruction/update
            const scopePrefix = payload.layer === 'GLOBAL' ? '(Global)' : `(${payload.layer})`;

            // If no text found (legacy) or refined provided, reconstruct/update
            if (!textToEmbed || refinedText) {
                if (payload.category === 'custom_rules') {
                    // Start with refined text or description
                    const content = refinedText || payload.description;

                    // If refined, update description too for consistency
                    if (refinedText) {
                        payload.description = refinedText;
                        // For custom rules, the prompt IS the description essentially, plus metadata
                        textToEmbed = `${scopePrefix} Regra Aprendida: ${refinedText}`;
                    } else {
                        // Legacy reconstruction
                        textToEmbed = `${scopePrefix} Regra Aprendida: ${payload.description}`;
                    }
                } else if (payload.category === 'menus') {
                    // Menus usually don't have descriptions editable this way, but if they did:
                    textToEmbed = `${scopePrefix} Menu/Tela ${payload.screen_id}: ${this.getAllKeywords(payload.keywords).join(', ')}. Objetivo: ${payload.purpose || ''}`;
                } else if (payload.category === 'actions') {
                    textToEmbed = `${scopePrefix} Ação [${payload.screen_id}] ${payload.action_type}: ${this.getAllKeywords(payload.keywords).join(', ')}. Descrição: ${payload.description || ''}`;
                }
            }

            // Ensure we update proposed_prompt in payload for future reference
            payload.proposed_prompt = textToEmbed;

            if (textToEmbed) {
                await vectorService.upsertKnowledge(id, textToEmbed, payload);
                console.log(`[IVA Audit] ✅ Approved knowledge ${id}`);
                return true;
            } else {
                // Just update payload if we can't re-embed? 
                // VectorSearchService.updatePointPayload? (Not implemented)
                // Start with simple re-upsert.
                throw new Error('Cannot approve: unable to reconstruct text');
            }

        } catch (error) {
            console.error('[IVA Audit] Error approving:', error);
            throw error;
        }
    }

    /**
     * Reject Knowledge (Delete)
     */
    static async rejectKnowledge(id) {
        try {
            await vectorService.deletePointByUuid(id);
            console.log(`[IVA Audit] ❌ Rejected (Deleted) knowledge ${id}`);
            return true;
        } catch (error) {
            console.error('[IVA Audit] Error rejecting:', error);
            throw error;
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
