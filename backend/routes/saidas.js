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

module.exports = router;
