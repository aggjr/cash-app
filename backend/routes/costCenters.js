const express = require('express');
const router = express.Router();
const costCenterController = require('../controllers/costCenterController');
const auth = require('../middleware/auth');

router.get('/', auth, costCenterController.list);
router.post('/', auth, costCenterController.create);
router.put('/:id', auth, costCenterController.update);
router.delete('/:id', auth, costCenterController.delete);

module.exports = router;
