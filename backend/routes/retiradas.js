const express = require('express');
const router = express.Router();
const retiradaController = require('../controllers/retiradaController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', retiradaController.listRetiradas);
router.post('/', retiradaController.createRetirada);
router.put('/:id', retiradaController.updateRetirada);
router.delete('/:id', retiradaController.deleteRetirada);

module.exports = router;
