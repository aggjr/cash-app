const express = require('express');
const router = express.Router();
const controller = require('../controllers/fechamentoController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', controller.getFechamentoReport);

module.exports = router;
