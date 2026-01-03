const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// POST /api/projects/:projectId/invite - Invite user to project
router.post('/:projectId/invite', userController.inviteUser);

// GET /api/projects/:projectId/users - List project users
router.get('/:projectId/users', userController.listProjectUsers);

// DELETE /api/projects/:projectId/users/:userId - Remove user from project
router.delete('/:projectId/users/:userId', userController.removeUserFromProject);

// PUT /api/projects/:projectId/transfer-master - Transfer master role
router.put('/:projectId/transfer-master', userController.transferMaster);

module.exports = router;
