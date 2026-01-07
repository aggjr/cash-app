const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const IvaCostTracker = require('../services/IvaCostTracker');
const db = require('../config/database');

/**
 * GET /api/IVA/analytics - Get overall analytics
 */
router.get('/analytics', auth, async (req, res) => {
    try {
        const { period, project_id, user_id } = req.query;

        const analytics = await IvaCostTracker.getAnalytics(db, {
            projectId: project_id,
            userId: user_id,
            period: period || 'month'
        });

        res.json(analytics);
    } catch (error) {
        console.error('[IVA Analytics] Error:', error);
        res.status(500).json({ error: 'Erro ao obter analytics' });
    }
});

/**
 * GET /api/IVA/analytics/by-project/:projectId - Get cost by project
 */
router.get('/analytics/by-project/:projectId', auth, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { period } = req.query;

        const stats = await IvaCostTracker.getCostByProject(db, projectId, period || 'month');

        res.json(stats);
    } catch (error) {
        console.error('[IVA Analytics] Error:', error);
        res.status(500).json({ error: 'Erro ao obter custo por projeto' });
    }
});

/**
 * GET /api/IVA/analytics/by-user/:projectId - Get cost by user in project
 */
router.get('/analytics/by-user/:projectId', auth, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { period } = req.query;

        const stats = await IvaCostTracker.getCostByUser(db, projectId, period || 'month');

        res.json(stats);
    } catch (error) {
        console.error('[IVA Analytics] Error:', error);
        res.status(500).json({ error: 'Erro ao obter custo por usuário' });
    }
});

module.exports = router;
