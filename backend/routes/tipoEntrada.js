const express = require('express');
const router = express.Router();
const tipoEntradaController = require('../controllers/tipoEntradaController');

// GET all nodes
router.get('/', tipoEntradaController.getAll);

// GET tree structure
router.get('/tree', tipoEntradaController.getTree);

// POST create new node
router.post('/', tipoEntradaController.create);

// PUT update node
router.put('/:id', tipoEntradaController.update);

// DELETE node
router.delete('/:id', tipoEntradaController.delete);

// PUT move node
router.put('/:id/move', tipoEntradaController.move);

module.exports = router;
