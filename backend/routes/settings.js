const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authMaster } = require('../middleware/auth');

router.get('/', authMaster, settingsController.getSettings);
router.put('/:field', authMaster, settingsController.updateSetting);
router.post('/unlock', authMaster, settingsController.activateTemporaryUnlock);
router.get('/unlock-status', authMaster, settingsController.checkUnlockStatus);

module.exports = router;
