const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
// const IvaCostTracker = require('../services/IvaCostTracker'); // DEPRECATED - Service removed
const db = require('../config/database');

/**
 * IVA Analytics Routes - TEMPORARILY DISABLED
 * 
 * These routes depend on IvaCostTracker service which was removed during cleanup.
 * Analytics functionality will be reimplemented using Qdrant-based tracking.
 * 
 * For now, all routes return 501 Not Implemented.
 */

/**
 * GET /api/IVA/analytics - Get overall analytics
 */
router.get('/analytics', auth, async (req, res) => {
    res.status(501).json({
        error: 'Analytics temporarily disabled',
        message: 'IVA analytics will be reimplemented with Qdrant-based tracking'
    });
});

/**
 * GET /api/IVA/analytics/by-project/:projectId - Get cost by project
 */
router.get('/analytics/by-project/:projectId', auth, async (req, res) => {
    res.status(501).json({
        error: 'Analytics temporarily disabled',
        message: 'IVA analytics will be reimplemented with Qdrant-based tracking'
    });
});

/**
 * GET /api/IVA/analytics/by-user/:projectId - Get cost by user in project
 */
router.get('/analytics/by-user/:projectId', auth, async (req, res) => {
    res.status(501).json({
        error: 'Analytics temporarily disabled',
        message: 'IVA analytics will be reimplemented with Qdrant-based tracking'
    });
});

module.exports = router;
