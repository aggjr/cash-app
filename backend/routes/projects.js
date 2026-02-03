const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const projectController = require('../controllers/projectController');
const auth = require('../middleware/auth');

// List project users
router.get('/:projectId/users', auth, userController.listProjectUsers);

// Invite user to project
router.post('/:projectId/users', auth, userController.inviteUser);

// Alias for invite (backward compatibility)
router.post('/:id/invite', auth, userController.inviteUser);

// Update project (rename)
router.put('/:projectId', auth, projectController.updateProject);

module.exports = router;
