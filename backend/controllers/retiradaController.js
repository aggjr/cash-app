const db = require('../config/database');
const AppError = require('../utils/AppError');
const fileLogger = require('../utils/fileLogger');

exports.listRetiradas = async (req, res, next) => {
    try {
        const { projectId, page = 1, limit = 50, search, account, company, description, startDate, endDate, minValue, maxValue } = req.query;

        console.log('DEBUG RETIRADAS LIST:', {
            query: req.query,
            projectId,
            type: typeof projectId
        });

        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID is required');
        }

        const offset = (page - 1) * limit;
        const queryParams = [projectId];

        let query = `
            SELECT r.*, e.name as company_name, c.name as account_name 
            FROM retiradas r
            LEFT JOIN empresas e ON r.company_id = e.id
            LEFT JOIN contas c ON r.account_id = c.id
            WHERE r.project_id = ? AND r.active = 1
        `;

        // Filters
        if (search) {
            query += ` AND (r.descricao LIKE ? OR e.name LIKE ? OR c.name LIKE ?)`;
            const term = `%${search}%`;
            queryParams.push(term, term, term);
        }

        // Specific Text Filters
        if (account) {
            query += ` AND c.name LIKE ?`;
            queryParams.push(`%${account}%`);
        }
        if (company) {
            query += ` AND e.name LIKE ?`;
            queryParams.push(`%${company}%`);
        }
        if (description) {
            query += ` AND r.descricao LIKE ?`;
            queryParams.push(`%${description}%`);
        }

        // Dynamic Date Filters for data_fato, data_prevista, data_real
        ['data_fato', 'data_prevista', 'data_real'].forEach(field => {
            const startKey = `${field}Start`;
            const endKey = `${field}End`;
            const listKey = `${field}List`;

            if (req.query[startKey]) {
                query += ` AND r.${field} >= ?`;
                queryParams.push(req.query[startKey]);
            }
            if (req.query[endKey]) {
                query += ` AND r.${field} <= ?`;
                queryParams.push(req.query[endKey]);
            }
            if (req.query[listKey]) {
                const dates = Array.isArray(req.query[listKey]) ? req.query[listKey] : [req.query[listKey]];
                if (dates.length > 0) {
                    query += ` AND DATE(r.${field}) IN (?)`;
                    queryParams.push(dates);
                }
            }
        });

        // Legacy support if startDate is used without specific key (mapped to data_fato)
        // But RetiradaManager now sends data_fatoStart/End, so this is just fallback
        if (startDate && !req.query.data_fatoStart) {
            query += ` AND r.data_fato >= ?`;
            queryParams.push(startDate);
        }
        if (endDate && !req.query.data_fatoEnd) {
            query += ` AND r.data_fato <= ?`;
            queryParams.push(endDate);
        }

        if (minValue) {
            query += ` AND r.valor >= ?`;
            queryParams.push(minValue);
        }
        if (maxValue) {
            query += ` AND r.valor <= ?`;
            queryParams.push(maxValue);
        }

        // Link/Attachment Filter
        const { hasAttachment } = req.query;
        if (hasAttachment !== undefined) {
            if (hasAttachment === '1') {
                query += ` AND r.comprovante_url IS NOT NULL AND r.comprovante_url != ''`;
            } else {
                query += ` AND (r.comprovante_url IS NULL OR r.comprovante_url = '')`;
            }
        }

        // --- COUNT QUERY ---
        let whereClause = 'WHERE r.project_id = ? AND r.active = 1';
        const countParams = [projectId];
        if (search) {
            whereClause += ` AND (r.descricao LIKE ? OR e.name LIKE ? OR c.name LIKE ?)`;
            const term = `%${search}%`;
            countParams.push(term, term, term);
        }
        if (account) { whereClause += ` AND c.name LIKE ?`; countParams.push(`%${account}%`); }
        if (company) { whereClause += ` AND e.name LIKE ?`; countParams.push(`%${company}%`); }
        if (description) { whereClause += ` AND r.descricao LIKE ?`; countParams.push(`%${description}%`); }

        // Dynamic Date Filters for Count
        ['data_fato', 'data_prevista', 'data_real'].forEach(field => {
            const startKey = `${field}Start`;
            const endKey = `${field}End`;
            const listKey = `${field}List`;

            if (req.query[startKey]) { whereClause += ` AND r.${field} >= ?`; countParams.push(req.query[startKey]); }
            if (req.query[endKey]) { whereClause += ` AND r.${field} <= ?`; countParams.push(req.query[endKey]); }
            if (req.query[listKey]) {
                const dates = Array.isArray(req.query[listKey]) ? req.query[listKey] : [req.query[listKey]];
                if (dates.length > 0) {
                    whereClause += ` AND DATE(r.${field}) IN (?)`;
                    countParams.push(dates);
                }
            }
        });

        if (startDate && !req.query.data_fatoStart) { whereClause += ` AND r.data_fato >= ?`; countParams.push(startDate); }
        if (endDate && !req.query.data_fatoEnd) { whereClause += ` AND r.data_fato <= ?`; countParams.push(endDate); }
        if (minValue) { whereClause += ` AND r.valor >= ?`; countParams.push(minValue); }
        if (maxValue) { whereClause += ` AND r.valor <= ?`; countParams.push(maxValue); }

        if (hasAttachment !== undefined) {
            if (hasAttachment === '1') {
                whereClause += ` AND r.comprovante_url IS NOT NULL AND r.comprovante_url != ''`;
            } else {
                whereClause += ` AND (r.comprovante_url IS NULL OR r.comprovante_url = '')`;
            }
        }

        // Sorting
        query += ` ORDER BY r.data_fato DESC, r.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.query(query, queryParams);

        const [countResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM retiradas r
            LEFT JOIN empresas e ON r.company_id = e.id
            LEFT JOIN contas c ON r.account_id = c.id
            ${whereClause}
        `, countParams);

        res.json({
            data: rows,
            meta: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.debugProbe = (req, res) => { // Updated to return logs
    const fs = require('fs');
    const logPath = fileLogger.getLogFilePath();
    let logs = 'Log file not found.';
    if (fs.existsSync(logPath)) {
        logs = fs.readFileSync(logPath, 'utf8');
    }

    res.header('Content-Type', 'text/plain');
    res.send(`--- DEBUG PROBE W/ LOGS ---\nVariables Check: fileLogger active.\n\n${logs}`);
};

exports.createRetirada = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { dataFato, dataPrevista, dataReal, valor, descricao, companyId, accountId, projectId, comprovanteUrl } = req.body;

        // FILE LOGGING
        fileLogger.log('--- CREATE RETIRADA REQUEST ---', {
            body: req.body,
            headers: req.headers
        });

        // Validation with specific errors
        if (!dataFato) {
            const msg = 'Validation Fail: Missing Data Fato';
            console.error(`[CRITICAL] ${msg}`, { body: req.body }); // Force output to console
            fileLogger.log(msg);
            throw new AppError('VAL-002', 'Data Fato é obrigatória');
        }

        if (!dataPrevista) {
            const msg = 'Validation Fail: Missing Data Prevista';
            console.error(`[CRITICAL] ${msg}`, { body: req.body }); // Force output to console
            fileLogger.log(msg);
            throw new AppError('VAL-002', 'Data Prevista é obrigatória');
        }

        if (!descricao) {
            const msg = 'Validation Fail: Missing Descricao';
            console.error(`[CRITICAL] ${msg}`, { body: req.body }); // Force output to console
            fileLogger.log(msg);
            throw new AppError('VAL-002', 'Descrição é obrigatória');
        }

        if (!companyId) { // Mapped from 'empresa' in instruction
            const msg = 'Validation Fail: Missing Company ID';
            console.error(`[CRITICAL] ${msg}`, { body: req.body }); // Force output to console
            fileLogger.log(msg);
            throw new AppError('VAL-002', 'Empresa é obrigatória');
        }

        // accountId is only mandatory if dataReal is present, so this check is moved below
        // if (!accountId) { // Mapped from 'conta' in instruction
        //     const msg = 'Validation Fail: Missing Account ID';
        //     console.error(`[CRITICAL] ${msg}`, { body: req.body }); // Force output to console
        //     fileLogger.log(msg);
        //     throw new AppError('VAL-002', 'Conta é obrigatória');
        // }

        if (valor === undefined || valor === null || valor === '') {
            const msg = 'Validation Fail: Missing Valor';
            console.error(`[CRITICAL] ${msg}`, { body: req.body }); // Force output to console
            fileLogger.log(msg);
            throw new AppError('VAL-002', 'Valor é obrigatório');
        }

        if (!projectId) {
            const msg = 'Validation Fail: Missing Project ID';
            console.error(`[CRITICAL] ${msg}`, { body: req.body }); // Force output to console
            fileLogger.log(msg);
            throw new AppError('VAL-002', 'Projeto ID é obrigatório (Erro Interno)');
        }

        if (dataReal && !accountId) {
            const msg = 'Validation Fail: Missing Account ID on Realized Transaction';
            console.error(`[CRITICAL] ${msg}`, { body: req.body, dataReal }); // Force output to console
            fileLogger.log(msg, { dataReal });
            throw new AppError('VAL-002', 'Conta é obrigatória para transações realizadas (com Data Real)');
        }

        fileLogger.log('Validation Passed. Inserting into DB...');

        // Insert Retirada
        const [result] = await connection.query(
            `INSERT INTO retiradas (data_fato, data_prevista, data_real, valor, descricao, company_id, account_id, project_id, comprovante_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dataFato, dataPrevista || null, dataReal || null, valor, descricao, companyId, accountId || null, projectId, comprovanteUrl || null]
        );

        const newId = result.insertId;

        // Decrease Account Balance (It's a withdrawal) - ONLY if Account is defined
        if (accountId) {
            const valorDecimal = parseFloat(valor);
            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [valorDecimal, accountId]
            );
        }

        await connection.commit();

        res.status(201).json({
            id: newId,
            message: 'Retirada criada com sucesso'
        });

    } catch (error) {
        await connection.rollback();
        // Log error to file
        fileLogger.log('Create Retirada Error:', {
            message: error.message,
            stack: error.stack
        });
        next(error);
    } finally {
        connection.release();
    }
};

exports.updateRetirada = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { dataFato, dataPrevista, dataReal, valor, descricao, companyId, accountId, active, comprovanteUrl } = req.body;

        // Get old data to revert balance
        const [oldRetirada] = await connection.query('SELECT * FROM retiradas WHERE id = ?', [id]);
        if (oldRetirada.length === 0) {
            throw new AppError('RES-001', 'Retirada não encontrada');
        }
        const oldData = oldRetirada[0];

        // Prepare updates
        const updates = [];
        const values = [];

        if (dataFato !== undefined) { updates.push('data_fato = ?'); values.push(dataFato); }
        if (dataPrevista !== undefined) { updates.push('data_prevista = ?'); values.push(dataPrevista); }
        if (dataReal !== undefined) { updates.push('data_real = ?'); values.push(dataReal); }
        if (valor !== undefined) { updates.push('valor = ?'); values.push(valor); }
        if (descricao !== undefined) { updates.push('descricao = ?'); values.push(descricao); }
        if (companyId !== undefined) { updates.push('company_id = ?'); values.push(companyId); }
        if (accountId !== undefined) { updates.push('account_id = ?'); values.push(accountId); }
        if (active !== undefined) { updates.push('active = ?'); values.push(active); }
        if (comprovanteUrl !== undefined) { updates.push('comprovante_url = ?'); values.push(comprovanteUrl); }

        if (updates.length > 0) {
            values.push(id);
            await connection.query(`UPDATE retiradas SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        // Handle Balance Updates if Value or Account Changed or Activation Changed
        // Simplest strategy: Revert old, Apply new.

        // 1. Revert Old (Increase balance back)
        if (oldData.active && oldData.account_id) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [oldData.valor, oldData.account_id]
            );
        }

        // 2. Apply New (Decrease balance)
        const newActive = active !== undefined ? active : oldData.active;
        if (newActive) {
            const newValor = valor !== undefined ? parseFloat(valor) : parseFloat(oldData.valor);
            const newAccountId = accountId !== undefined ? accountId : oldData.account_id;

            if (newAccountId) {
                await connection.query(
                    'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                    [newValor, newAccountId]
                );
            }
        }

        await connection.commit();
        res.json({ message: 'Retirada atualizada com sucesso' });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

exports.deleteRetirada = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [retirada] = await connection.query('SELECT * FROM retiradas WHERE id = ?', [id]);
        if (retirada.length === 0) {
            throw new AppError('RES-001', 'Retirada não encontrada');
        }

        // Soft delete
        await connection.query('UPDATE retiradas SET active = 0 WHERE id = ?', [id]);

        // Increase account balance (reverse the withdrawal)
        if (retirada[0].active && retirada[0].account_id) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [retirada[0].valor, retirada[0].account_id]
            );
        }

        await connection.commit();
        res.json({ message: 'Retirada excluída com sucesso' });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};
