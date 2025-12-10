const express = require('express');
const router = express.Router();
const previsaoController = require('../controllers/previsaoController');
const auth = require('../middleware/auth');

router.get('/', auth, previsaoController.getDailyForecast);

module.exports = router;
