const express = require('express');
const router = express.Router();
const incomeController = require('../controllers/incomeController');
const auth = require('../middleware/auth');

// All routes require authentication

// GET /api/incomes?projectId=X - List all incomes for a project
router.get('/', auth, incomeController.listIncomes);

// GET /api/incomes/distinct-values?projectId=X&field=Y - Get distinct values for filter
router.get('/distinct-values', auth, incomeController.getDistinctValues);

// POST /api/incomes - Create new income
router.post('/', auth, incomeController.createIncome);

// PUT /api/incomes/:id - Update income
router.put('/:id', auth, incomeController.updateIncome);

// DELETE /api/incomes/:id - Delete income (soft delete)
router.delete('/:id', auth, incomeController.deleteIncome);

module.exports = router;
