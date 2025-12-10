const express = require('express');
const router = express.Router();
const despesaController = require('../controllers/despesaController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/despesas - List all despesas for a project
router.get('/', despesaController.listDespesas);

// POST /api/despesas - Create a new despesa
router.post('/', despesaController.createDespesa);

// PUT /api/despesas/:id - Update a despesa
router.put('/:id', despesaController.updateDespesa);

// DELETE /api/despesas/:id - Delete a despesa (soft delete)
router.delete('/:id', despesaController.deleteDespesa);

module.exports = router;
