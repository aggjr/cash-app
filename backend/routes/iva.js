const express = require('express');
const router = express.Router();
const ivaController = require('../controllers/ivaController'); // NEW CLEAN CONTROLLER
const auth = require('../middleware/auth');
const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');
const IvaUserPreferences = require('../services/IvaUserPreferences');

// GET /api/IVA/debug-prefs/:userId - Check saved preferences
router.get('/debug-prefs/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const prefs = await IvaUserPreferences.getAllPreferences(userId);
        res.json({ userId, prefs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/IVA/chat - Chat with IVA using LLM
router.post('/chat', auth, ivaController.chat);

// POST /api/IVA/operate - Decide operational action (Navigate, Click, Fill)
router.post('/operate', auth, ivaController.operate);

// GET /api/IVA/debug-ghosts - List ghost prompts
router.get('/debug-ghosts', async (req, res) => {
    try {
        const QdrantKnowledgeService = require('../services/QdrantKnowledgeService');
        const prompts = await QdrantKnowledgeService.listPrompts();

        const canonical = ['system', 'module', 'company', 'department', 'role', 'user'];
        const ghosts = prompts.filter(p => !canonical.includes(p));

        const ghostData = {};
        for (const ghost of ghosts) {
            ghostData[ghost] = await QdrantKnowledgeService.getPrompt(ghost);
        }

        res.json({ ghosts: ghostData, all: prompts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// REMOVED: backfillKnowledge - not in new clean controller
// router.post('/backfill-knowledge', ivaController.backfillKnowledge);


// --- KNOWLEDGE AUDIT ROUTES ---
router.get('/knowledge/pending', auth, ivaController.getPendingKnowledge);
router.post('/knowledge/approve', auth, ivaController.approveKnowledge);
router.post('/knowledge/reject', auth, ivaController.rejectKnowledge);

// POST /api/IVA/learn - Record knowledge (active learning)
router.post('/learn', auth, async (req, res) => {
    try {
        const { type, data } = req.body;
        const userId = req.user.id;

        await IvaGlobalKnowledge.contribute(type, data, userId);

        res.json({ success: true });
    } catch (error) {
        console.error('[IVA Learn] Error:', error);
        res.status(500).json({ error: 'Erro ao registrar conhecimento' });
    }
});

// POST /api/IVA/observe - Record observation (passive learning)
router.post('/observe', auth, async (req, res) => {
    try {
        const { type, ...data } = req.body;
        const userId = req.user.id;

        // Convert observation to knowledge format
        let knowledgeType, knowledgeData;

        switch (type) {
            case 'navigation':
                knowledgeType = 'menus';
                knowledgeData = {
                    screen_id: data.screen_id,
                    menu_path: data.menu_path,
                    keywords: IvaGlobalKnowledge.extractKeywords(data.menu_path),
                    purpose: `Gerenciar ${data.screen_id}`,
                    observation: true
                };
                break;

            case 'filter_usage':
                knowledgeType = 'actions';
                knowledgeData = {
                    screen_id: data.screen_id,
                    action_id: data.filter_id,
                    action_type: 'filter',
                    description: `Filtro de ${data.filter_type}`,
                    keywords: [data.filter_type, 'filtrar', 'buscar'],
                    observation: true
                };
                break;

            case 'button_click':
                knowledgeType = 'actions';
                knowledgeData = {
                    screen_id: data.screen_id,
                    action_id: data.button_id,
                    action_type: data.button_type || 'button',
                    description: data.button_label,
                    keywords: IvaGlobalKnowledge.extractKeywords(data.button_label),
                    observation: true
                };
                break;

            default:
                return res.json({ success: true }); // Ignore unknown types
        }

        await IvaGlobalKnowledge.contribute(knowledgeType, knowledgeData, userId);

        res.json({ success: true });
    } catch (error) {
        console.error('[IVA Observe] Error:', error);
        res.status(500).json({ error: 'Erro ao processar observação' });
    }
});

// Knowledge optimization routes removed - service deprecated
// Use IvaGlobalKnowledge.contribute() for knowledge management

// POST /api/IVA/record-failure - Record failure for self-healing
router.post('/record-failure', auth, async (req, res) => {
    try {
        const { type, item_id } = req.body;
        await IvaGlobalKnowledge.recordFailure(type, item_id);
        res.json({ success: true });
    } catch (error) {
        console.error('[IVA Failure] Error:', error);
        res.status(500).json({ error: 'Erro ao registrar falha' });
    }
});

// POST /api/IVA/record-success - Record success (resets failures)
router.post('/record-success', auth, async (req, res) => {
    try {
        const { type, item_id } = req.body;
        await IvaGlobalKnowledge.recordSuccess(type, item_id);
        res.json({ success: true });
    } catch (error) {
        console.error('[IVA Success] Error:', error);
        res.status(500).json({ error: 'Erro ao registrar sucesso' });
    }
});

// Include analytics routes
const ivaAnalytics = require('./ivaAnalytics');
router.use('/', ivaAnalytics);

// Include tracking routes
const ivaTracking = require('./ivaTracking');
router.use('/', ivaTracking);

// --- SECURE MIGRATION ROUTE (Admin Only) ---
// POST /api/iva/migrate-to-qdrant-force - Force re-seed Qdrant from knowledge base
router.post('/migrate-to-qdrant-force', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Acesso negado. Apenas administradores podem executar esta migração.'
            });
        }

        console.log('🚀 Starting Forced Qdrant Migration...');
        const VectorSearchService = require('../services/VectorSearchService');
        const fs = require('fs').promises;
        const path = require('path');

        // Read knowledge base
        const knowledgeBasePath = path.join(__dirname, '../data/iva_knowledge_base.json');
        const knowledgeData = JSON.parse(await fs.readFile(knowledgeBasePath, 'utf8'));

        let count = 0;
        const log = [];

        // Populate GLOBAL knowledge
        const global = knowledgeData.GLOBAL;

        // 1. System info
        await VectorSearchService.upsertKnowledge(
            'system_info_main',
            `Assistente: ${global.system_info.assistant_name}. ${global.system_info.description}`,
            { category: 'system_info', layer: 'GLOBAL', ...global.system_info }
        );
        count++;
        log.push('✅ System info');

        // 2. Greetings
        for (const greeting of global.greetings) {
            for (let i = 0; i < greeting.variations.length; i++) {
                await VectorSearchService.upsertKnowledge(
                    `greeting_${greeting.context}_${i}`,
                    `Saudação ${greeting.context}: ${greeting.variations[i]}`,
                    { category: 'greeting', layer: 'GLOBAL', ...greeting, text: greeting.variations[i] }
                );
                count++;
            }
        }
        log.push(`✅ Greetings (${global.greetings.length} contexts)`);

        // 3. Personality
        await VectorSearchService.upsertKnowledge(
            'personality_main',
            `Personalidade: ${global.personality.tone}, ${global.personality.style}. Traços: ${global.personality.traits.join(', ')}`,
            { category: 'personality', layer: 'GLOBAL', ...global.personality }
        );
        count++;
        log.push('✅ Personality');

        // 4. Introduction
        await VectorSearchService.upsertKnowledge(
            'introduction_main',
            global.introduction.first_contact,
            { category: 'introduction', layer: 'GLOBAL', ...global.introduction }
        );
        count++;
        log.push('✅ Introduction');

        // 5. Common actions
        for (const action of global.common_actions) {
            await VectorSearchService.upsertKnowledge(
                `action_${action.action_type}`,
                `Ação ${action.action_type}: ${action.description}. Keywords: ${action.keywords.join(', ')}`,
                { category: 'action', layer: 'GLOBAL', ...action }
            );
            count++;
        }
        log.push(`✅ Common actions (${global.common_actions.length})`);

        // 6. Help responses
        for (let i = 0; i < global.help_responses.length; i++) {
            const help = global.help_responses[i];
            await VectorSearchService.upsertKnowledge(
                `help_${i}`,
                `Ajuda: ${help.trigger.join(', ')}. Resposta: ${help.response}`,
                { category: 'help', layer: 'GLOBAL', ...help }
            );
            count++;
        }
        log.push(`✅ Help responses (${global.help_responses.length})`);

        // 7. Module info
        const moduleCash = knowledgeData.MODULE_CASH;
        await VectorSearchService.upsertKnowledge(
            'module_cash_info',
            `Módulo: ${moduleCash.module_info.name}. ${moduleCash.module_info.description}`,
            { category: 'module_info', layer: 'MODULE', module: 'CASH', ...moduleCash.module_info }
        );
        count++;
        log.push('✅ Module CASH info');

        console.log(`✅ Qdrant migration completed! ${count} items upserted.`);

        res.json({
            success: true,
            message: `Migração concluída com sucesso!`,
            items_migrated: count,
            details: log
        });

    } catch (error) {
        console.error('❌ Migration Error:', error);
        res.status(500).json({
            error: 'Erro na migração',
            message: error.message,
            stack: error.stack
        });
    }
});

module.exports = router;
