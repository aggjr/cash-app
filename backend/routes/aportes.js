const express = require('express');
const router = express.Router();
const controller = require('../controllers/aporteController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', controller.listAportes);
router.get('/distinct-values', controller.getDistinctValues);
router.post('/', controller.createAporte);
router.put('/:id', controller.updateAporte);
router.delete('/:id', controller.deleteAporte);

module.exports = router;
