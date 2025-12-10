const db = require('../config/database');
const AppError = require('../utils/AppError');

exports.listDespesas = async (req, res, next) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            throw new AppError('VAL-002', `Debug: query=${JSON.stringify(req.query)}, projectId=${projectId}`);
        }

        const [despesas] = await db.query(
            `WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_despesa
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_despesa t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
             )
             SELECT 
                d.*,
                th.full_path as tipo_despesa_name,
                emp.name as company_name,
                emp.cnpj as company_cnpj,
                c.name as account_name,
                c.account_type as account_type
             FROM despesas d
             INNER JOIN TypeHierarchy th ON d.tipo_despesa_id = th.id
             INNER JOIN empresas emp ON d.company_id = emp.id
             INNER JOIN contas c ON d.account_id = c.id
             WHERE d.project_id = ? AND d.active = 1
             ORDER BY d.data_fato DESC, d.created_at DESC`,
            [projectId]
        );
        res.json(despesas);
    } catch (error) {
        next(error);
    }
};

exports.createDespesa = async (req, res, next) => {
    let connection;
    try {
        const {
            dataFato,
            dataPrevistaPagamento,
            dataRealPagamento,
            valor,
            descricao,
            tipoDespesaId,
            companyId,
            accountId,
            projectId
        } = req.body;

        if (!dataFato || !dataPrevistaPagamento || !valor || !tipoDespesaId || !companyId || !accountId || !projectId) {
            throw new AppError('VAL-002');
        }

        const valorDecimal = parseFloat(valor);
        if (isNaN(valorDecimal)) {
            throw new AppError('VAL-001', 'Valor inválido.');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO despesas 
            (data_fato, data_prevista_pagamento, data_real_pagamento, valor, descricao, tipo_despesa_id, company_id, account_id, project_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dataFato, dataPrevistaPagamento, dataRealPagamento || null, valorDecimal, descricao, tipoDespesaId, companyId, accountId, projectId]
        );

        // Update account balance - SUBTRACT for expenses
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [valorDecimal, accountId]
        );

        await connection.commit();

        res.status(201).json({
            id: result.insertId,
            data_fato: dataFato,
            data_prevista_pagamento: dataPrevistaPagamento,
            data_real_pagamento: dataRealPagamento || null,
            valor: valorDecimal,
            descricao,
            tipo_despesa_id: tipoDespesaId,
            company_id: companyId,
            account_id: accountId,
            project_id: projectId,
            active: 1
        });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.updateDespesa = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const {
            dataFato,
            dataPrevistaPagamento,
            dataRealPagamento,
            valor,
            descricao,
            tipoDespesaId,
            companyId,
            accountId,
            active
        } = req.body;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get old despesa data
        const [oldDespesa] = await connection.query(
            'SELECT valor, account_id FROM despesas WHERE id = ?',
            [id]
        );

        if (!oldDespesa.length) {
            throw new AppError('RES-001', 'Despesa não encontrada.');
        }

        const updates = [];
        const values = [];

        if (dataFato !== undefined) {
            updates.push('data_fato = ?');
            values.push(dataFato);
        }
        if (dataPrevistaPagamento !== undefined) {
            updates.push('data_prevista_pagamento = ?');
            values.push(dataPrevistaPagamento);
        }
        if (dataRealPagamento !== undefined) {
            updates.push('data_real_pagamento = ?');
            values.push(dataRealPagamento || null);
        }

        let newValor = oldDespesa[0].valor;
        if (valor !== undefined) {
            const valorDecimal = parseFloat(valor);
            if (isNaN(valorDecimal)) {
                throw new AppError('VAL-001', 'Valor inválido.');
            }
            updates.push('valor = ?');
            values.push(valorDecimal);
            newValor = valorDecimal;
        }

        if (descricao !== undefined) {
            updates.push('descricao = ?');
            values.push(descricao);
        }
        if (tipoDespesaId !== undefined) {
            updates.push('tipo_despesa_id = ?');
            values.push(tipoDespesaId);
        }
        if (companyId !== undefined) {
            updates.push('company_id = ?');
            values.push(companyId);
        }

        let newAccountId = oldDespesa[0].account_id;
        if (accountId !== undefined) {
            updates.push('account_id = ?');
            values.push(accountId);
            newAccountId = accountId;
        }

        if (active !== undefined) {
            updates.push('active = ?');
            values.push(active);
        }

        if (updates.length > 0) {
            values.push(id);
            await connection.query(
                `UPDATE despesas SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Update balances if value or account changed
        // 1. Revert old transaction from old account (ADD back the expense)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [oldDespesa[0].valor, oldDespesa[0].account_id]
        );

        // 2. Apply new transaction to new account (SUBTRACT the new expense)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [newValor, newAccountId]
        );

        await connection.commit();
        res.json({ message: 'Despesa updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteDespesa = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get despesa details first to know the amount and account
        const [despesa] = await connection.query(
            'SELECT valor, account_id FROM despesas WHERE id = ? AND active = 1',
            [id]
        );

        if (despesa.length === 0) {
            throw new AppError('RES-001', 'Despesa não encontrada.');
        }

        // Soft delete
        await connection.query('UPDATE despesas SET active = 0 WHERE id = ?', [id]);

        // Increase account balance (revert the expense - ADD back the money)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [despesa[0].valor, despesa[0].account_id]
        );

        await connection.commit();
        res.json({ message: 'Despesa deleted successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};
