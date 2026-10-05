const express = require('express');
const router = express.Router();
const fornecedorController = require('../controllers/fornecedorController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Suppliers of a product (a tipo_producao_revenda node)
router.get('/produto/:tipoId', fornecedorController.listProdutoFornecedores);
router.put('/produto/:tipoId', fornecedorController.setProdutoFornecedores);

router.get('/', fornecedorController.listFornecedores);
router.post('/', fornecedorController.createFornecedor);
router.put('/:id', fornecedorController.updateFornecedor);
router.delete('/:id', fornecedorController.deleteFornecedor);

module.exports = router;
