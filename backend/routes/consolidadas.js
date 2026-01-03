const express = require('express');
const router = express.Router();
const consolidadasController = require('../controllers/consolidadasController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, consolidadasController.getConsolidatedData);

module.exports = router;
