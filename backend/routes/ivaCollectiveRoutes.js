/**
 * Endpoint para registrar uso coletivo do sistema
 * 
 * Recebe dados de uso de TODOS os usuários e cria/atualiza
 * conhecimento compartilhado no nível MODULE
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * POST /api/iva/record-collective-usage
 * Registrar uso coletivo (batch)
 */
router.post('/record-collective-usage', async (req, res) => {
    try {
        const { module_code, usages } = req.body;

        if (!module_code || !usages || !Array.isArray(usages)) {
            return res.status(400).json({
                error: 'module_code and usages array required'
            });
        }

        const results = {
            processed: 0,
            created: 0,
            updated: 0,
            errors: 0
        };

        for (const usage of usages) {
            try {
                if (usage.type === 'CLICK' && usage.element_id) {
                    await processClickUsage(module_code, usage, req.user?.id);
                    results.processed++;
                } else if (usage.type === 'NAVIGATION') {
                    await processNavigationUsage(module_code, usage);
                    results.processed++;
                }
            } catch (error) {
                console.error('[IVA Collective] Error processing usage:', error);
                results.errors++;
            }
        }

        res.json({
            success: true,
            results
        });

    } catch (error) {
        console.error('[IVA Collective] Error:', error);
        res.status(500).json({
            error: 'Failed to record collective usage'
        });
    }
});

/**
 * Processar clique em botão/ação
 */
async function processClickUsage(moduleCode, usage, userId) {
    const knowledgeKey = usage.element_id;

    // Buscar conhecimento existente (MODULE level)
    const [existing] = await db.query(`
        SELECT * FROM iva_knowledge_layers
        WHERE layer_type = 'MODULE'
          AND module_code = ?
          AND knowledge_type = 'ACTION'
          AND knowledge_key = ?
    `, [moduleCode, knowledgeKey]);

    if (existing.length > 0) {
        // Já existe - incrementar contador
        await db.query(`
            UPDATE iva_knowledge_layers
            SET usage_count = usage_count + 1,
                last_used_at = NOW()
            WHERE id = ?
        `, [existing[0].id]);

    } else {
        // Novo conhecimento - criar registro MODULE
        const knowledgeValue = {
            screen_id: usage.screen_id,
            element_id: usage.element_id,
            element_text: usage.element_text,
            element_type: usage.element_type,
            discovered_at: new Date().toISOString()
        };

        await db.query(`
            INSERT INTO iva_knowledge_layers
            (layer_type, module_code, knowledge_type, knowledge_key, 
             knowledge_value, source, usage_count, last_used_at, created_by)
            VALUES ('MODULE', ?, 'ACTION', ?, ?, 'COLLECTIVE', 1, NOW(), ?)
        `, [
            moduleCode,
            knowledgeKey,
            JSON.stringify(knowledgeValue),
            userId || null
        ]);

        console.log(`[IVA Collective] Discovered ACTION: ${usage.element_text || knowledgeKey} on ${usage.screen_id}`);
    }
}

/**
 * Processar navegação entre telas
 */
async function processNavigationUsage(moduleCode, usage) {
    if (!usage.to_screen) return;

    const knowledgeKey = usage.to_screen;

    // Buscar conhecimento existente
    const [existing] = await db.query(`
        SELECT * FROM iva_knowledge_layers
        WHERE layer_type = 'MODULE'
          AND module_code = ?
          AND knowledge_type = 'NAVIGATION'
          AND knowledge_key = ?
    `, [moduleCode, knowledgeKey]);

    if (existing.length > 0) {
        // Incrementar contador
        await db.query(`
            UPDATE iva_knowledge_layers
            SET usage_count = usage_count + 1,
                last_used_at = NOW()
            WHERE id = ?
        `, [existing[0].id]);

    } else {
        // Criar novo registro de navegação
        const knowledgeValue = {
            screen_id: usage.to_screen,
            from_screen: usage.from_screen,
            discovered_at: new Date().toISOString()
        };

        await db.query(`
            INSERT INTO iva_knowledge_layers
            (layer_type, module_code, knowledge_type, knowledge_key, 
             knowledge_value, source, usage_count, last_used_at)
            VALUES ('MODULE', ?, 'NAVIGATION', ?, ?, 'COLLECTIVE', 1, NOW())
        `, [
            moduleCode,
            knowledgeKey,
            JSON.stringify(knowledgeValue)
        ]);

        console.log(`[IVA Collective] Discovered NAVIGATION: ${usage.to_screen}`);
    }
}

/**
 * GET /api/iva/knowledge/stats
 * Estatísticas de conhecimento coletivo
 */
router.get('/knowledge/stats', async (req, res) => {
    try {
        const { module_code = 'CASH' } = req.query;

        // Total de conhecimento por tipo
        const [stats] = await db.query(`
            SELECT 
                knowledge_type,
                COUNT(*) as total,
                SUM(usage_count) as total_uses,
                AVG(usage_count) as avg_uses
            FROM iva_knowledge_layers
            WHERE layer_type = 'MODULE'
              AND module_code = ?
              AND active = TRUE
            GROUP BY knowledge_type
        `, [module_code]);

        // Top 10 mais usados
        const [topUsed] = await db.query(`
            SELECT 
                knowledge_type,
                knowledge_key,
                knowledge_value,
                usage_count,
                last_used_at
            FROM iva_knowledge_layers
            WHERE layer_type = 'MODULE'
              AND module_code = ?
              AND active = TRUE
            ORDER BY usage_count DESC
            LIMIT 10
        `, [module_code]);

        res.json({
            module_code,
            stats,
            top_used: topUsed.map(k => ({
                type: k.knowledge_type,
                key: k.knowledge_key,
                value: JSON.parse(k.knowledge_value),
                uses: k.usage_count,
                last_used: k.last_used_at
            }))
        });

    } catch (error) {
        console.error('[IVA Stats] Error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

module.exports = router;
