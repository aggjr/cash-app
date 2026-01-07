/**
 * IVA Cost Tracker
 * Tracks LLM usage and calculates costs per user and project
 */
class IvaCostTracker {
    static PRICES = {
        'gpt-4o-mini': {
            input: 0.150 / 1_000_000,  // $0.150 per 1M tokens
            output: 0.600 / 1_000_000  // $0.600 per 1M tokens
        },
        'gpt-4o': {
            input: 2.50 / 1_000_000,
            output: 10.00 / 1_000_000
        }
    };

    /**
     * Track LLM usage
     */
    static async track(db, userId, projectId, usage, context = {}) {
        const model = context.model || 'gpt-4o-mini';
        const prices = this.PRICES[model];

        const promptCost = usage.prompt_tokens * prices.input;
        const completionCost = usage.completion_tokens * prices.output;
        const totalCost = promptCost + completionCost;

        try {
            await db.query(`
        INSERT INTO iva_usage_tracking (
          user_id, project_id, interaction_type,
          prompt_tokens, completion_tokens, total_tokens,
          prompt_cost, completion_cost, total_cost,
          model, has_knowledge, knowledge_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                userId,
                projectId,
                context.type || 'operate',
                usage.prompt_tokens,
                usage.completion_tokens,
                usage.total_tokens,
                promptCost,
                completionCost,
                totalCost,
                model,
                context.has_knowledge || false,
                context.knowledge_size || 0
            ]);

            console.log(`[IVA Cost] Tracked: $${totalCost.toFixed(6)} (${usage.total_tokens} tokens)`);
        } catch (error) {
            console.error('[IVA Cost] Error tracking:', error);
        }
    }

    /**
     * Get cost by project
     */
    static async getCostByProject(db, projectId, period = 'month') {
        const dateFilter = this.getDateFilter(period);

        const [rows] = await db.query(`
      SELECT 
        COUNT(*) as interactions,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        AVG(total_cost) as avg_cost_per_interaction,
        interaction_type,
        DATE(created_at) as date
      FROM iva_usage_tracking
      WHERE project_id = ? ${dateFilter}
      GROUP BY interaction_type, DATE(created_at)
      ORDER BY created_at DESC
    `, [projectId]);

        return this.formatStats(rows);
    }

    /**
     * Get cost by user in project
     */
    static async getCostByUser(db, projectId, period = 'month') {
        const dateFilter = this.getDateFilter(period);

        const [rows] = await db.query(`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        COUNT(*) as interactions,
        SUM(t.total_tokens) as total_tokens,
        SUM(t.total_cost) as total_cost,
        AVG(t.total_cost) as avg_cost_per_interaction
      FROM iva_usage_tracking t
      JOIN users u ON t.user_id = u.id
      WHERE t.project_id = ? ${dateFilter}
      GROUP BY u.id, u.name
      ORDER BY total_cost DESC
    `, [projectId]);

        return rows;
    }

    /**
     * Get overall analytics
     */
    static async getAnalytics(db, filters = {}) {
        const { projectId, userId, period = 'month' } = filters;
        const dateFilter = this.getDateFilter(period);

        let whereClause = `WHERE 1=1 ${dateFilter}`;
        const params = [];

        if (projectId) {
            whereClause += ' AND project_id = ?';
            params.push(projectId);
        }

        if (userId) {
            whereClause += ' AND user_id = ?';
            params.push(userId);
        }

        // Total stats
        const [totals] = await db.query(`
      SELECT 
        COUNT(*) as total_interactions,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        AVG(total_cost) as avg_cost
      FROM iva_usage_tracking
      ${whereClause}
    `, params);

        // By type
        const [byType] = await db.query(`
      SELECT 
        interaction_type,
        COUNT(*) as interactions,
        SUM(total_cost) as cost
      FROM iva_usage_tracking
      ${whereClause}
      GROUP BY interaction_type
    `, params);

        // By day
        const [byDay] = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as interactions,
        SUM(total_cost) as cost
      FROM iva_usage_tracking
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, params);

        // Knowledge impact
        const [knowledgeImpact] = await db.query(`
      SELECT 
        has_knowledge,
        AVG(total_tokens) as avg_tokens,
        AVG(total_cost) as avg_cost
      FROM iva_usage_tracking
      ${whereClause}
      GROUP BY has_knowledge
    `, params);

        return {
            period,
            total: totals[0],
            breakdown: {
                by_type: byType,
                by_day: byDay.reverse()
            },
            knowledge_impact: this.calculateKnowledgeImpact(knowledgeImpact),
            projections: this.calculateProjections(totals[0], period)
        };
    }

    /**
     * Get date filter SQL
     */
    static getDateFilter(period) {
        switch (period) {
            case 'today':
                return 'AND DATE(created_at) = CURDATE()';
            case 'week':
                return 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
            case 'month':
                return 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
            case 'year':
                return 'AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)';
            default:
                return '';
        }
    }

    /**
     * Calculate knowledge impact
     */
    static calculateKnowledgeImpact(data) {
        const withKnowledge = data.find(d => d.has_knowledge);
        const withoutKnowledge = data.find(d => !d.has_knowledge);

        if (!withKnowledge || !withoutKnowledge) {
            return { savings: '0%' };
        }

        const savings = ((withoutKnowledge.avg_cost - withKnowledge.avg_cost) / withoutKnowledge.avg_cost * 100).toFixed(0);

        return {
            with_knowledge: {
                avg_tokens: Math.round(withKnowledge.avg_tokens),
                avg_cost: withKnowledge.avg_cost
            },
            without_knowledge: {
                avg_tokens: Math.round(withoutKnowledge.avg_tokens),
                avg_cost: withoutKnowledge.avg_cost
            },
            savings: `${savings}%`
        };
    }

    /**
     * Calculate projections
     */
    static calculateProjections(totals, period) {
        if (!totals || !totals.total_cost) return {};

        const dailyAvg = totals.total_cost / this.getPeriodDays(period);

        return {
            daily_avg: dailyAvg,
            month_estimate: dailyAvg * 30,
            year_estimate: dailyAvg * 365
        };
    }

    static getPeriodDays(period) {
        switch (period) {
            case 'today': return 1;
            case 'week': return 7;
            case 'month': return 30;
            case 'year': return 365;
            default: return 30;
        }
    }

    static formatStats(rows) {
        return rows;
    }
}

module.exports = IvaCostTracker;
