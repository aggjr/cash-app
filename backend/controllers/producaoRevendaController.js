const db = require('../config/database');
const AppError = require('../utils/AppError');

// Helper function to generate dynamic ORDER BY clause
const getOrderByClause = (sortBy, order = 'desc') => {
    const validOrders = ['asc', 'desc'];
    const orderDirection = validOrders.includes(order?.toLowerCase()) ? order.toUpperCase() : 'DESC';

    const orderMappings = {
        'valor': `p.valor ${orderDirection}`,
        'data_fato': `p.data_fato ${orderDirection}`,
        'data_prevista_pagamento': `p.data_prevista_pagamento ${orderDirection}`,
        'data_real_pagamento': `p.data_real_pagamento ${orderDirection}`,
        'data_prevista_atraso': `p.data_prevista_atraso ${orderDirection}`,
        'descricao': `p.descricao ${orderDirection}`,
        'tipo_name': `th.full_path ${orderDirection}`,
        'company_name': `emp.name ${orderDirection}`,
        'account_name': `c.name ${orderDirection}`
    };

    return orderMappings[sortBy] || 'p.data_fato DESC, p.created_at DESC';
};

exports.listProducaoRevenda = async (req, res, next) => {
    try {
        console.log('=== DEBUG: listProducaoRevenda ===');
        console.log('Query Params:', JSON.stringify(req.query, null, 2));

        const { projectId, search, minValue, maxValue, sortBy, order } = req.query;

        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID required');
        }

        let whereClauses = ['p.project_id = ?', 'p.active = 1'];
        let params = [projectId];

        // Dynamic Filtering - Specific Date Columns
        const addDateFilter = (field, startParam, endParam) => {
            if (req.query[startParam]) {
                whereClauses.push(`p.${field} >= ?`);
                params.push(req.query[startParam]);
            }
            if (req.query[endParam]) {
                whereClauses.push(`p.${field} <= ?`);
                params.push(`${req.query[endParam]} 23:59:59`);
            }
        };

        const addDateListFilter = (field, listParam) => {
            if (req.query[listParam]) {
                const dates = Array.isArray(req.query[listParam]) ? req.query[listParam] : [req.query[listParam]];
                if (dates.length > 0) {
                    whereClauses.push(`DATE(p.${field}) IN (?)`);
                    params.push(dates);
                }
            }
        };

        addDateFilter('data_fato', 'data_fatoStart', 'data_fatoEnd');
        addDateListFilter('data_fato', 'data_fatoList');

        addDateFilter('data_prevista_pagamento', 'data_prevista_pagamentoStart', 'data_prevista_pagamentoEnd');
        addDateListFilter('data_prevista_pagamento', 'data_prevista_pagamentoList');

        addDateFilter('data_real_pagamento', 'data_real_pagamentoStart', 'data_real_pagamentoEnd');
        addDateListFilter('data_real_pagamento', 'data_real_pagamentoList');

        addDateFilter('data_prevista_atraso', 'data_prevista_atrasoStart', 'data_prevista_atrasoEnd');
        addDateListFilter('data_prevista_atraso', 'data_prevista_atrasoList');

        if (minValue) {
            whereClauses.push('p.valor >= ?');
            params.push(minValue);
        }
        if (maxValue) {
            whereClauses.push('p.valor <= ?');
            params.push(maxValue);
        }
        if (search) {
            whereClauses.push('(p.descricao LIKE ? OR emp.name LIKE ? OR c.name LIKE ?)');
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        // Specific Text Filters
        if (req.query.description) {
            whereClauses.push('p.descricao LIKE ?');
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

        if (req.query.tipo) {
            whereClauses.push('th.full_path LIKE ?');
            params.push(`%${req.query.tipo}%`);
        }

        // Attachment Filter
        if (req.query.hasAttachment === '1') {
            whereClauses.push('p.comprovante_url IS NOT NULL AND p.comprovante_url != ""');
        } else if (req.query.hasAttachment === '0') {
            whereClauses.push('(p.comprovante_url IS NULL OR p.comprovante_url = "")');
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count Total
        const countQuery = `
            WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_producao_revenda
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_producao_revenda t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
            )
            SELECT COUNT(*) as total
            FROM producao_revenda p
            LEFT JOIN TypeHierarchy th ON p.tipo_id = th.id
            INNER JOIN empresas emp ON p.company_id = emp.id
            LEFT JOIN contas c ON p.account_id = c.id
            ${whereSQL}`;

        const [countResult] = await db.query(countQuery, params);
        const totalItems = countResult[0].total;

        // Fetch Data
        const dataQuery = `
            WITH RECURSIVE TypeHierarchy AS (
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
             LEFT JOIN TypeHierarchy th ON p.tipo_id = th.id
             INNER JOIN empresas emp ON p.company_id = emp.id
             LEFT JOIN contas c ON p.account_id = c.id
             ${whereSQL}
             ORDER BY 
             ${getOrderByClause(sortBy, order)}`;

        const [items] = await db.query(dataQuery, params);

        res.json(items);
    } catch (error) {
        next(error);
    }
};

exports.createProducaoRevenda = async (req, res, next) => {
    console.log('=== CREATE PRODUCAO/REVENDA START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    let connection;
    try {
        const {
            dataFato,
            dataPrevistaPagamento,
            dataPrevistaAtraso,
            dataRealPagamento,
            valor,
            descricao,
            tipoId,
            companyId,
            accountId,
            comprovanteUrl,
            projectId
        } = req.body;

        console.log('Extracted fields:', {
            dataFato,
            dataPrevistaPagamento,
            dataPrevistaAtraso,
            dataRealPagamento,
            valor,
            descricao,
            tipoId,
            companyId,
            accountId,
            comprovanteUrl,
            projectId
        });

        // accountId is optional if dataRealPagamento is null
        if (!dataFato || !dataPrevistaPagamento || !valor || !tipoId || !companyId || !projectId) {
            console.log('Validation failed - missing required fields');
            throw new AppError('VAL-002');
        }

        const valorDecimal = parseFloat(valor);
        if (isNaN(valorDecimal)) {
            console.log('Validation failed - invalid valor:', valor);
            throw new AppError('VAL-001', 'Valor inválido.');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO producao_revenda 
            (data_fato, data_prevista_pagamento, data_prevista_atraso, data_real_pagamento, valor, descricao, tipo_id, company_id, account_id, comprovante_url, project_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dataFato, dataPrevistaPagamento, dataPrevistaAtraso || null, dataRealPagamento || null, valorDecimal, descricao, tipoId, companyId, accountId || null, comprovanteUrl || null, projectId]
        );

        console.log('Item created with ID:', result.insertId);

        // SUBTRACT from account balance (Cost) - only if accountId provided
        if (accountId) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [valorDecimal, accountId]
            );
            console.log('Account balance updated');
        }

        await connection.commit();
        console.log('=== CREATE PRODUCAO/REVENDA SUCCESS ===');

        res.status(201).json({
            id: result.insertId,
            message: 'Criado com sucesso'
        });
    } catch (error) {
        console.error('=== CREATE PRODUCAO/REVENDA ERROR ===', error);
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

        const fields = [];
        const values = [];

        // Mapping frontendCamelCase to db_snake_case
        const map = {
            dataFato: 'data_fato',
            dataPrevistaPagamento: 'data_prevista_pagamento',
            dataPrevistaAtraso: 'data_prevista_atraso',
            dataRealPagamento: 'data_real_pagamento',
            valor: 'valor',
            descricao: 'descricao',
            tipoId: 'tipo_id',
            companyId: 'company_id',
            accountId: 'account_id',
            comprovanteUrl: 'comprovante_url',
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
            const oldAccountId = oldItem[0].account_id;

            // Revert old if there was an account
            if (oldAccountId) {
                await connection.query(
                    'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                    [oldItem[0].valor, oldAccountId]
                );
            }

            // Apply new if account_id is set
            if (newAccountId) {
                await connection.query(
                    'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                    [newValor, newAccountId]
                );
            }
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
