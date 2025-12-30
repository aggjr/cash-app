const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const auth = require('../middleware/auth');

router.use(auth);

// Create new loan
router.post('/', loanController.createLoan);

// List loan installments (as Payables)
router.get('/installments', loanController.listInstallments);

// Suggest category for fees/interest
router.get('/suggest-category', loanController.suggestCategory);

module.exports = router;
