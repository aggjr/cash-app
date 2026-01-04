const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// List project users
router.get('/:projectId/users', auth, userController.listProjectUsers);

// Invite user to project
router.post('/:projectId/users', auth, userController.inviteUser);

module.exports = router;
