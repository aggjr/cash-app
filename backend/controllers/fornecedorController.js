const db = require('../config/database');
const AppError = require('../utils/AppError');

exports.listFornecedores = async (req, res, next) => {
    try {
        const { projectId, onlyActive } = req.query;
        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID is required');
        }

        const where = ['project_id = ?'];
        const params = [projectId];

        if (onlyActive === '1') {
            where.push('active = 1');
        }

        const [fornecedores] = await db.query(
            `SELECT * FROM fornecedores WHERE ${where.join(' AND ')} ORDER BY name`,
            params
        );
        res.json(fornecedores);
    } catch (error) {
        next(error);
    }
};

exports.createFornecedor = async (req, res, next) => {
    try {
        const { name, cnpj, contato, telefone, email, observacoes, projectId } = req.body;

        if (!name || !projectId) {
            throw new AppError('VAL-002', 'Nome e Project ID são obrigatórios');
        }

        const [result] = await db.auditedQuery(
            `INSERT INTO fornecedores (name, cnpj, contato, telefone, email, observacoes, project_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, cnpj || null, contato || null, telefone || null, email || null, observacoes || null, projectId],
            req
        );

        res.status(201).json({
            id: result.insertId,
            name,
            cnpj: cnpj || null,
            contato: contato || null,
            telefone: telefone || null,
            email: email || null,
            observacoes: observacoes || null,
            active: 1,
            project_id: projectId
        });
    } catch (error) {
        next(error);
    }
};

exports.updateFornecedor = async (req, res, next) => {
    try {
        const { id } = req.params;
        const map = {
            name: 'name',
            cnpj: 'cnpj',
            contato: 'contato',
            telefone: 'telefone',
            email: 'email',
            observacoes: 'observacoes',
            active: 'active'
        };

        const updates = [];
        const values = [];

        for (const [key, column] of Object.entries(map)) {
            if (req.body[key] !== undefined) {
                updates.push(`${column} = ?`);
                values.push(req.body[key]);
            }
        }

        if (updates.length > 0) {
            values.push(id);
            await db.auditedQuery(
                `UPDATE fornecedores SET ${updates.join(', ')} WHERE id = ?`,
                values,
                req
            );
        }

        res.json({ message: 'Fornecedor atualizado com sucesso' });
    } catch (error) {
        next(error);
    }
};

exports.deleteFornecedor = async (req, res, next) => {
    try {
        const { id } = req.params;

        const [purchases] = await db.query(
            'SELECT COUNT(*) as count FROM producao_revenda WHERE fornecedor_id = ?',
            [id]
        );
        const [products] = await db.query(
            'SELECT COUNT(*) as count FROM produto_fornecedores WHERE fornecedor_id = ?',
            [id]
        );

        // Purchases keep the historical supplier, so deleting would erase history.
        if (purchases[0].count > 0) {
            return res.status(409).json({
                error: {
                    code: 'DEPENDENCY_EXISTS',
                    message: `Fornecedor possui ${purchases[0].count} compra(s) registrada(s). Inative-o em vez de excluir.`,
                    counts: { purchases: purchases[0].count, products: products[0].count }
                }
            });
        }

        await db.auditedQuery('DELETE FROM fornecedores WHERE id = ?', [id], req);
        res.json({ message: 'Fornecedor excluído com sucesso' });
    } catch (error) {
        next(error);
    }
};

/** Suppliers linked to a product, main one first. */
exports.listProdutoFornecedores = async (req, res, next) => {
    try {
        const { tipoId } = req.params;

        const [rows] = await db.query(
            `SELECT pf.fornecedor_id, pf.principal, f.name, f.cnpj, f.active
             FROM produto_fornecedores pf
             INNER JOIN fornecedores f ON pf.fornecedor_id = f.id
             WHERE pf.tipo_id = ?
             ORDER BY pf.principal DESC, f.name`,
            [tipoId]
        );

        res.json(rows);
    } catch (error) {
        next(error);
    }
};

/** Replaces the supplier list of a product. Exactly one of them may be the main supplier. */
exports.setProdutoFornecedores = async (req, res, next) => {
    let connection;
    try {
        const { tipoId } = req.params;
        const { fornecedores } = req.body;

        if (!Array.isArray(fornecedores)) {
            throw new AppError('VAL-002', 'Lista de fornecedores é obrigatória');
        }

        const seen = new Set();
        const entries = [];
        for (const item of fornecedores) {
            const fornecedorId = parseInt(item?.fornecedorId ?? item?.fornecedor_id);
            if (!fornecedorId || seen.has(fornecedorId)) continue;
            seen.add(fornecedorId);
            entries.push({ fornecedorId, principal: item?.principal ? 1 : 0 });
        }

        const principais = entries.filter(e => e.principal);
        if (principais.length > 1) {
            throw new AppError('VAL-001', 'Only one main supplier is allowed per product');
        }
        // Without an explicit choice the first supplier becomes the main one.
        if (principais.length === 0 && entries.length > 0) {
            entries[0].principal = 1;
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        await connection.query('DELETE FROM produto_fornecedores WHERE tipo_id = ?', [tipoId]);

        for (const entry of entries) {
            await connection.query(
                'INSERT INTO produto_fornecedores (tipo_id, fornecedor_id, principal) VALUES (?, ?, ?)',
                [tipoId, entry.fornecedorId, entry.principal]
            );
        }

        await connection.commit();
        res.json({ message: 'Fornecedores do produto atualizados', count: entries.length });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};
