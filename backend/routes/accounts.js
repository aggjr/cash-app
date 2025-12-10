const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const auth = require('../middleware/auth');

router.get('/', auth, accountController.listAccounts);
router.post('/', auth, accountController.createAccount);
router.put('/:id', auth, accountController.updateAccount);
router.delete('/:id', auth, accountController.deleteAccount);

module.exports = router;
