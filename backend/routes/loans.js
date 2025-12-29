const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Create new loan
router.post('/', loanController.createLoan);

// List loan installments (as Payables)
router.get('/installments', loanController.listInstallments);

module.exports = router;
