const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const auth = require('../middleware/auth');
const requireMaster = require('../middleware/requireMaster');

// All routes require authentication
router.use(auth);

// All routes also require Master role
router.use(requireMaster);

// GET /api/audit-logs - List audit logs
router.get('/', auditLogController.getAuditLogs);

// POST /api/audit-logs/undo/:id - Undo an action
router.post('/undo/:id', auditLogController.undoAction);

module.exports = router;
