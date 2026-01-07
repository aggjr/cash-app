const express = require('express');
const router = express.Router();
const ivaController = require('../controllers/ivaControllerV2');
const auth = require('../middleware/auth');
const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');
const IvaKnowledgeOptimizer = require('../services/IvaKnowledgeOptimizer');

// POST /api/IVA/chat - Chat with IVA using LLM
router.post('/chat', auth, ivaController.chat);

// POST /api/IVA/operate - Decide operational action (Navigate, Click, Fill)
router.post('/operate', auth, ivaController.operate);

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

// GET /api/IVA/knowledge/stats - Get knowledge statistics
router.get('/knowledge/stats', auth, async (req, res) => {
    try {
        const stats = await IvaKnowledgeOptimizer.getStats();
        res.json(stats);
    } catch (error) {
        console.error('[IVA Stats] Error:', error);
        res.status(500).json({ error: 'Erro ao obter estatísticas' });
    }
});

// POST /api/IVA/knowledge/optimize - Manually trigger optimization
router.post('/knowledge/optimize', auth, async (req, res) => {
    try {
        const result = await IvaKnowledgeOptimizer.optimize();
        res.json(result);
    } catch (error) {
        console.error('[IVA Optimize] Error:', error);
        res.status(500).json({ error: 'Erro ao otimizar conhecimento' });
    }
});

// Include tracking routes
const ivaTracking = require('./ivaTracking');
router.use('/', ivaTracking);

module.exports = router;

