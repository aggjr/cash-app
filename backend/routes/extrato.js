const express = require('express');
const router = express.Router();
const controller = require('../controllers/extratoController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', controller.getExtrato);

module.exports = router;
