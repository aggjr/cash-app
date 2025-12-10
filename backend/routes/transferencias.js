const express = require('express');
const router = express.Router();
const transferenciaController = require('../controllers/transferenciaController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', transferenciaController.listTransferencias);
router.post('/', transferenciaController.createTransferencia);
router.put('/:id', transferenciaController.updateTransferencia);
router.delete('/:id', transferenciaController.deleteTransferencia);

module.exports = router;
