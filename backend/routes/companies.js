const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/companies - List all companies for a project
router.get('/', companyController.listCompanies);

// POST /api/companies - Create a new company
router.post('/', companyController.createCompany);

// PUT /api/companies/:id - Update a company
router.put('/:id', companyController.updateCompany);

// DELETE /api/companies/:id - Delete a company
router.delete('/:id', companyController.deleteCompany);

module.exports = router;
