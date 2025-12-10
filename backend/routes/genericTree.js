const express = require('express');
const router = express.Router();
const genericTreeController = require('../controllers/genericTreeController');

// GET all nodes
router.get('/:tableName', genericTreeController.getAll);

// GET tree structure
router.get('/:tableName/tree', genericTreeController.getTree);

// POST create new node
router.post('/:tableName', genericTreeController.create);

// PUT update node
router.put('/:tableName/:id', genericTreeController.update);

// DELETE node
router.delete('/:tableName/:id', genericTreeController.delete);

// PUT move node
router.put('/:tableName/:id/move', genericTreeController.move);

module.exports = router;
