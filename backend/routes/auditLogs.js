const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const auth = require('../middleware/auth');

router.get('/', auth, auditLogController.listLogs);

module.exports = router;
