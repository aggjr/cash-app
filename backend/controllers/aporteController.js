const db = require('../config/database');
const AppError = require('../utils/AppError');

// Helper for Sorting
const getOrderByClause = (sortBy, order) => {
    const dir = order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    switch (sortBy) {
        case 'valor': return `a.valor ${dir}`;
        case 'data_fato': return `a.data_fato ${dir}`;
        case 'descricao': return `a.descricao ${dir}`;
        case 'company_name': return `emp.name ${dir}`;
        case 'account_name': return `c.name ${dir}`;
        default: return `a.data_fato DESC, a.created_at DESC`;
    }
};

exports.listAportes = async (req, res, next) => {
    try {
        const { projectId, page = 1, limit = 50, search, sortBy, order } = req.query;

        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID is required');
        }

        const offset = (page - 1) * limit;
        const params = [];
        let whereClauses = ['a.project_id = ?', 'a.active = 1'];
        params.push(projectId);

        // Date Filters
        const addDateFilter = (field, startParam, endParam) => {
            if (req.query[startParam]) {
                whereClauses.push(`a.${field} >= ?`);
                params.push(req.query[startParam]);
            }
            if (req.query[endParam]) {
                whereClauses.push(`a.${field} <= ?`);
                params.push(`${req.query[endParam]} 23:59:59`);
            }
        };

        const addDateListFilter = (field, listParam) => {
            if (req.query[listParam]) {
                const dates = Array.isArray(req.query[listParam]) ? req.query[listParam] : [req.query[listParam]];
                if (dates.length > 0) {
                    whereClauses.push(`DATE(a.${field}) IN (?)`);
                    params.push(dates);
                }
            }
        };

        addDateFilter('data_fato', 'data_fatoStart', 'data_fatoEnd');
        addDateListFilter('data_fato', 'data_fatoList');
        addDateFilter('data_real', 'data_realStart', 'data_realEnd');
        addDateListFilter('data_real', 'data_realList');

        // Value Filters
        if (req.query.minValue) {
            whereClauses.push('a.valor >= ?');
            params.push(req.query.minValue);
        }
        if (req.query.maxValue) {
            whereClauses.push('a.valor <= ?');
            params.push(req.query.maxValue);
        }

        // Text Search
        if (search) {
            whereClauses.push('(a.descricao LIKE ? OR emp.name LIKE ? OR c.name LIKE ?)');
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        // Specific Text Filters
        if (req.query.description) {
            whereClauses.push('a.descricao LIKE ?');
            params.push(`%${req.query.description}%`);
        }
        if (req.query.account) {
            whereClauses.push('c.name LIKE ?');
            params.push(`%${req.query.account}%`);
        }
        if (req.query.company) {
            whereClauses.push('emp.name LIKE ?');
            params.push(`%${req.query.company}%`);
        }

        // Attachment Filter
        if (req.query.hasAttachment === '1') {
            whereClauses.push('a.comprovante_url IS NOT NULL AND a.comprovante_url != ""');
        } else if (req.query.hasAttachment === '0') {
            whereClauses.push('(a.comprovante_url IS NULL OR a.comprovante_url = "")');
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count Total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM aportes a
            INNER JOIN empresas emp ON a.company_id = emp.id
            LEFT JOIN contas c ON a.account_id = c.id
            ${whereSQL}`;

        const [countResult] = await db.query(countQuery, params);
        const totalItems = countResult[0].total;

        // Fetch Data
        const dataQuery = `
             SELECT 
                a.*,
                emp.name as company_name,
                emp.cnpj as company_cnpj,
                c.name as account_name,
                c.account_type as account_type
             FROM aportes a
             INNER JOIN empresas emp ON a.company_id = emp.id
             LEFT JOIN contas c ON a.account_id = c.id
             ${whereSQL}
             ORDER BY ${getOrderByClause(sortBy, order)}
             LIMIT ? OFFSET ?`;

        const [aportes] = await db.query(dataQuery, [...params, parseInt(limit), parseInt(offset)]);

        res.json({
            data: aportes,
            meta: {
                total: totalItems,
                page: parseInt(page),
                pages: Math.ceil(totalItems / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.createAporte = async (req, res, next) => {
    let connection;
    try {
        const {
            dataFato,
            dataReal,
            valor,
            descricao,
            companyId,
            accountId,
            projectId,
            comprovante_url,
            formaPagamento
        } = req.body;

        if (!dataFato || !valor || !companyId || !projectId) {
            throw new AppError('VAL-002');
        }

        const valorDecimal = parseFloat(valor);
        if (isNaN(valorDecimal)) {
            throw new AppError('VAL-001', 'Valor inválido.');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO aportes 
            (data_fato, data_real, valor, descricao, company_id, account_id, project_id, comprovante_url, forma_pagamento) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dataFato, dataReal || null, valorDecimal, descricao, companyId, accountId, projectId, comprovante_url || null, formaPagamento || null]
        );

        // Update account balance if accountId is provided (wait, accountId is not required if dataReal is null?)
        // The original code enforced accountId. But my new Modal logic makes it optional if dataReal is null.
        // We need to handle that.
        // CHECK: Original code: if (!dataFato || ... || !accountId ...) throw Error.
        // I should update validation to allow null accountId IF dataReal is null?
        // But table constraint might differ.
        // Let's assume for now accountId IS required based on previous code.
        // Update: User requirement "campo de conta destino desabilitado até que a data real seja informada".
        // This implies if no Data Real, No Account. So accountId CAN be null.

        if (accountId) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [valorDecimal, accountId]
            );
        }

        await connection.commit();

        res.status(201).json({
            id: result.insertId,
            data_fato: dataFato,
            data_real: dataReal || null,
            valor: valorDecimal,
            descricao,
            company_id: companyId,
            account_id: accountId,
            project_id: projectId,
            active: 1,
            comprovante_url,
            forma_pagamento: formaPagamento || null
        });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.updateAporte = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const {
            dataFato,
            dataReal,
            valor,
            descricao,
            companyId,
            accountId,
            active,
            comprovante_url,
            formaPagamento
        } = req.body;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get old aporte data
        const [oldAporte] = await connection.query(
            'SELECT valor, account_id FROM aportes WHERE id = ?',
            [id]
        );

        if (!oldAporte.length) {
            throw new AppError('RES-001', 'Aporte não encontrado.');
        }

        const updates = [];
        const values = [];

        if (dataFato !== undefined) {
            updates.push('data_fato = ?');
            values.push(dataFato);
        }
        if (dataReal !== undefined) {
            updates.push('data_real = ?');
            values.push(dataReal || null);
        }

        let newValor = oldAporte[0].valor;
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
        if (companyId !== undefined) {
            updates.push('company_id = ?');
            values.push(companyId);
        }

        let newAccountId = oldAporte[0].account_id;
        if (accountId !== undefined) {
            updates.push('account_id = ?');
            values.push(accountId);
            newAccountId = accountId;
        }

        if (active !== undefined) {
            updates.push('active = ?');
            values.push(active);
        }

        if (comprovante_url !== undefined) {
            updates.push('comprovante_url = ?');
            values.push(comprovante_url);
        }

        if (formaPagamento !== undefined) {
            updates.push('forma_pagamento = ?');
            values.push(formaPagamento || null);
        }

        if (updates.length > 0) {
            values.push(id);
            await connection.query(
                `UPDATE aportes SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Update balances if value or account changed (complex logic for null accounts needed?)
        // If accountId was null and now is set -> Add to new.
        // If accountId was set and now is null -> Remove from old.
        // If accountId changed -> Remove old, Add new.
        // Current logic assumes account_id is always present.
        // We need to respect the possibility of null account_id.

        const oldAcc = oldAporte[0].account_id;

        // 1. Revert old transaction if it existed
        if (oldAcc) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [oldAporte[0].valor, oldAcc]
            );
        }

        // 2. Apply new transaction if it exists
        if (newAccountId) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [newValor, newAccountId]
            );
        }

        await connection.commit();
        res.json({ message: 'Aporte updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteAporte = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [aporte] = await connection.query(
            'SELECT valor, account_id FROM aportes WHERE id = ? AND active = 1',
            [id]
        );

        if (aporte.length === 0) {
            throw new AppError('RES-001', 'Aporte não encontrado.');
        }

        // Soft delete
        await connection.query('UPDATE aportes SET active = 0 WHERE id = ?', [id]);

        // Decrease account balance (reverse the injection)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [aporte[0].valor, aporte[0].account_id]
        );

        await connection.commit();
        res.json({ message: 'Aporte deleted successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};
