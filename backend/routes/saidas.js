const express = require('express');
const router = express.Router();
const saidaController = require('../controllers/saidaController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/saidas - List all saidas for a project
router.get('/', saidaController.listSaidas);

// POST /api/saidas - Create a new saida
router.post('/', saidaController.createSaida);

// PUT /api/saidas/:id - Update a saida
router.put('/:id', saidaController.updateSaida);

// DELETE /api/saidas/:id - Delete a saida (soft delete)
router.delete('/:id', saidaController.deleteSaida);

// PUT /api/saidas/:id/batch - Batch update with scope
router.put('/:id/batch', saidaController.batchUpdateSaida);

// DELETE /api/saidas/:id/batch - Batch delete with scope
router.delete('/:id/batch', saidaController.batchDeleteSaida);

// POST /api/saidas/bulk-delete - Delete multiple items by IDs
router.post('/bulk-delete', saidaController.bulkDeleteSaidas);

module.exports = router;
