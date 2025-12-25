const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const auth = require('../middleware/auth');

router.get('/', auth, settingsController.getSettings);
router.put('/:field', auth, settingsController.updateSetting);
router.post('/unlock', auth, settingsController.activateTemporaryUnlock);
router.get('/unlock-status', auth, settingsController.checkUnlockStatus);

module.exports = router;
