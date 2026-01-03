const express = require('express');
const router = express.Router();
const controller = require('../controllers/producaoRevendaController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', controller.listProducaoRevenda);
router.post('/', controller.createProducaoRevenda);
router.put('/:id', controller.updateProducaoRevenda);
router.delete('/:id', controller.deleteProducaoRevenda);

module.exports = router;
