const db = require('../config/database');
const AppError = require('../utils/AppError');

exports.listProducaoRevenda = async (req, res, next) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID required');
        }

        const [items] = await db.query(
            `WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_producao_revenda
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_producao_revenda t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
             )
             SELECT 
                p.*,
                th.full_path as tipo_name,
                emp.name as company_name,
                c.name as account_name
             FROM producao_revenda p
             INNER JOIN TypeHierarchy th ON p.tipo_producao_revenda_id = th.id
             INNER JOIN empresas emp ON p.company_id = emp.id
             INNER JOIN contas c ON p.account_id = c.id
             WHERE p.project_id = ? AND p.active = 1
             ORDER BY p.data_fato DESC, p.created_at DESC`,
            [projectId]
        );
        res.json(items);
    } catch (error) {
        next(error);
    }
};

exports.createProducaoRevenda = async (req, res, next) => {
    let connection;
    try {
        const {
            dataFato,
            dataPrevistaPagamento,
            dataRealPagamento,
            valor,
            descricao,
            tipoProducaoRevendaId,
            companyId,
            accountId,
            projectId
        } = req.body;

        if (!dataFato || !dataPrevistaPagamento || !valor || !tipoProducaoRevendaId || !companyId || !accountId || !projectId) {
            throw new AppError('VAL-002');
        }

        const valorDecimal = parseFloat(valor);
        if (isNaN(valorDecimal)) {
            throw new AppError('VAL-001', 'Valor inválido.');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO producao_revenda 
            (data_fato, data_prevista_pagamento, data_real_pagamento, valor, descricao, tipo_producao_revenda_id, company_id, account_id, project_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dataFato, dataPrevistaPagamento, dataRealPagamento || null, valorDecimal, descricao, tipoProducaoRevendaId, companyId, accountId, projectId]
        );

        // SUBTRACT from account balance (Cost)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [valorDecimal, accountId]
        );

        await connection.commit();

        res.status(201).json({
            id: result.insertId,
            message: 'Criado com sucesso'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.updateProducaoRevenda = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const updates = req.body;

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [oldItem] = await connection.query(
            'SELECT valor, account_id FROM producao_revenda WHERE id = ?',
            [id]
        );

        if (!oldItem.length) {
            throw new AppError('RES-001', 'Item não encontrado.');
        }

        // Simplified update logic (omitting granular field checks to save space, but functional)
        // In a full implementation, we'd build the query dynamically like in despesaController
        // For brevity in this fix agent, assuming full payload or handling specifically
        // But let's do it right:

        const fields = [];
        const values = [];

        // Mapping frontendCamelCase to db_snake_case
        const map = {
            dataFato: 'data_fato',
            dataPrevistaPagamento: 'data_prevista_pagamento',
            dataRealPagamento: 'data_real_pagamento',
            valor: 'valor',
            descricao: 'descricao',
            tipoProducaoRevendaId: 'tipo_producao_revenda_id',
            companyId: 'company_id',
            accountId: 'account_id',
            active: 'active'
        };

        for (const [key, val] of Object.entries(updates)) {
            if (map[key] && val !== undefined) {
                fields.push(`${map[key]} = ?`);
                values.push(val);
            }
        }

        if (fields.length > 0) {
            values.push(id);
            await connection.query(
                `UPDATE producao_revenda SET ${fields.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Handle balance update if value or account changed
        if (updates.valor !== undefined || updates.accountId !== undefined) {
            const newValor = updates.valor !== undefined ? parseFloat(updates.valor) : parseFloat(oldItem[0].valor);
            const newAccountId = updates.accountId !== undefined ? updates.accountId : oldItem[0].account_id;

            // Revert old
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [oldItem[0].valor, oldItem[0].account_id]
            );

            // Apply new
            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [newValor, newAccountId]
            );
        }

        await connection.commit();
        res.json({ message: 'Atualizado com sucesso' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteProducaoRevenda = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [item] = await connection.query(
            'SELECT valor, account_id FROM producao_revenda WHERE id = ? AND active = 1',
            [id]
        );

        if (item.length === 0) {
            throw new AppError('RES-001', 'Item não encontrado.');
        }

        await connection.query('UPDATE producao_revenda SET active = 0 WHERE id = ?', [id]);

        // Revert balance (ADD back)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [item[0].valor, item[0].account_id]
        );

        await connection.commit();
        res.json({ message: 'Excluído com sucesso' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};
