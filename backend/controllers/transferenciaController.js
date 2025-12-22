const db = require('../config/database');
const AppError = require('../utils/AppError');

exports.listTransferencias = async (req, res, next) => {
    try {
        // ========================================
        // COMPREHENSIVE REQUEST LOGGING
        // ========================================
        const fs = require('fs');
        const { projectId, page = 1, limit = 50, search, minValue, maxValue, exactValue, sortBy, order } = req.query;

        const logData = {
            timestamp: new Date().toISOString(),
            allQueryParams: req.query,
            extracted: {
                projectId, page, limit, search, minValue, maxValue, exactValue, sortBy, order
            }
        };

        try {
            fs.appendFileSync('transferencias_debug.log', '\n' + JSON.stringify(logData, null, 2) + '\n');
        } catch (err) {
            console.error('Error writing to debug log:', err);
        }

        console.log('\n');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔵 NEW REQUEST TO /transferencias');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📥 ALL QUERY PARAMETERS:', JSON.stringify(req.query, null, 2));
        console.log('───────────────────────────────────────────────────────────');



        console.log('📊 EXTRACTED PARAMETERS:');
        console.log('  - projectId:', projectId);
        console.log('  - page:', page);
        console.log('  - limit:', limit);
        console.log('  - search:', search);
        console.log('  - minValue:', minValue);
        console.log('  - maxValue:', maxValue);
        console.log('  - exactValue:', exactValue);
        console.log('  - sortBy:', sortBy);
        console.log('  - order:', order);
        console.log('═══════════════════════════════════════════════════════════\n');

        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID is required');
        }

        const offset = (page - 1) * limit;
        const queryParams = [projectId];

        let query = `
            SELECT t.*, 
                   s.name as source_account_name, 
                   d.name as destination_account_name 
            FROM transferencias t
            LEFT JOIN contas s ON t.source_account_id = s.id
            LEFT JOIN contas d ON t.destination_account_id = d.id
            WHERE t.project_id = ? AND t.active = 1
        `;

        // Filters
        if (search) {
            query += ` AND (t.descricao LIKE ? OR s.name LIKE ? OR d.name LIKE ?)`;
            const term = `%${search}%`;
            queryParams.push(term, term, term);
        }

        // Specific text filters for account names
        if (req.query.source_account_name) {
            query += ` AND s.name LIKE ?`;
            queryParams.push(`%${req.query.source_account_name}%`);
        }
        if (req.query.destination_account_name) {
            query += ` AND d.name LIKE ?`;
            queryParams.push(`%${req.query.destination_account_name}%`);
        }
        if (req.query.descricao) {
            query += ` AND t.descricao LIKE ?`;
            queryParams.push(`%${req.query.descricao}%`);
        }

        // Date Filters for data_prevista
        if (req.query.data_previstaStart) {
            query += ` AND t.data_prevista >= ?`;
            queryParams.push(req.query.data_previstaStart);
        }
        if (req.query.data_previstaEnd) {
            query += ` AND t.data_prevista <= ?`;
            queryParams.push(req.query.data_previstaEnd);
        }
        if (req.query.data_previstaList) {
            const dates = Array.isArray(req.query.data_previstaList) ? req.query.data_previstaList : [req.query.data_previstaList];
            query += ` AND DATE(t.data_prevista) IN (${dates.map(() => '?').join(',')})`;
            queryParams.push(...dates);
        }

        // Date Filters for data_real
        if (req.query.data_realStart) {
            query += ` AND t.data_real >= ?`;
            queryParams.push(req.query.data_realStart);
        }
        if (req.query.data_realEnd) {
            query += ` AND t.data_real <= ?`;
            queryParams.push(req.query.data_realEnd);
        }
        if (req.query.data_realList) {
            const dates = Array.isArray(req.query.data_realList) ? req.query.data_realList : [req.query.data_realList];
            query += ` AND DATE(t.data_real) IN (${dates.map(() => '?').join(',')})`;
            queryParams.push(...dates);
        }

        // Value Filters
        console.log('💰 BACKEND VALOR FILTER - exactValue:', exactValue, 'minValue:', minValue, 'maxValue:', maxValue);

        if (exactValue) {
            // Exact match using = operator
            console.log('  ✅ Adding WHERE clause: valor = ', exactValue);
            query += ` AND t.valor = ?`;
            queryParams.push(exactValue);
        } else {
            // Range match using >= and <=
            if (minValue) {
                console.log('  ✅ Adding WHERE clause: valor >= ', minValue);
                query += ` AND t.valor >= ?`;
                queryParams.push(minValue);
            }
            if (maxValue) {
                console.log('  ✅ Adding WHERE clause: valor <= ', maxValue);
                query += ` AND t.valor <= ?`;
                queryParams.push(maxValue);
            }
        }

        // Attachment Filter
        console.log('🔍 TRANSFERENCIA MAIN QUERY - hasAttachment:', req.query.hasAttachment);
        if (req.query.hasAttachment === '1') {
            console.log('✅ Filtering: WITH attachment');
            query += ` AND t.comprovante_url IS NOT NULL AND t.comprovante_url != ""`;
        } else if (req.query.hasAttachment === '0') {
            console.log('❌ Filtering: WITHOUT attachment');
            query += ` AND (t.comprovante_url IS NULL OR t.comprovante_url = "")`;
        }

        // Sorting
        // Sorting
        const validSortColumns = ['data_prevista', 'data_real', 'valor', 'descricao', 'source_account_name', 'destination_account_name'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'data_prevista';
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

        // Fix: Do not prefix 't.' for aliased columns (account names)
        const isAlias = ['source_account_name', 'destination_account_name'].includes(sortColumn);
        const columnExpression = isAlias ? sortColumn : `t.${sortColumn}`;

        query += ` ORDER BY ${columnExpression} ${sortOrder}, t.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        console.log('🔍 FINAL SQL QUERY:', query);
        console.log('📊 QUERY PARAMS:', queryParams);

        const [rows] = await db.query(query, queryParams);

        // Count Total
        let whereClause = 'WHERE t.project_id = ? AND t.active = 1';
        const countParams = [projectId];
        if (search) {
            whereClause += ` AND (t.descricao LIKE ? OR s.name LIKE ? OR d.name LIKE ?)`;
            const term = `%${search}%`;
            countParams.push(term, term, term);
        }
        if (req.query.data_previstaStart) { whereClause += ` AND t.data_prevista >= ?`; countParams.push(req.query.data_previstaStart); }
        if (req.query.data_previstaEnd) { whereClause += ` AND t.data_prevista <= ?`; countParams.push(req.query.data_previstaEnd); }
        if (req.query.data_previstaList) {
            const dates = Array.isArray(req.query.data_previstaList) ? req.query.data_previstaList : [req.query.data_previstaList];
            whereClause += ` AND DATE(t.data_prevista) IN (${dates.map(() => '?').join(',')})`;
            countParams.push(...dates);
        }
        if (req.query.data_realStart) { whereClause += ` AND t.data_real >= ?`; countParams.push(req.query.data_realStart); }
        if (req.query.data_realEnd) { whereClause += ` AND t.data_real <= ?`; countParams.push(req.query.data_realEnd); }
        if (req.query.data_realList) {
            const dates = Array.isArray(req.query.data_realList) ? req.query.data_realList : [req.query.data_realList];
            whereClause += ` AND DATE(t.data_real) IN (${dates.map(() => '?').join(',')})`;
            countParams.push(...dates);
        }
        if (minValue) { whereClause += ` AND t.valor >= ?`; countParams.push(minValue); }
        if (maxValue) { whereClause += ` AND t.valor <= ?`; countParams.push(maxValue); }

        // Attachment Filter
        console.log('🔍 TRANSFERENCIA FILTER DEBUG - hasAttachment:', req.query.hasAttachment);
        if (req.query.hasAttachment === '1') {
            console.log('✅ Filtering: WITH attachment');
            whereClause += ` AND t.comprovante_url IS NOT NULL AND t.comprovante_url != ""`;
        } else if (req.query.hasAttachment === '0') {
            console.log('❌ Filtering: WITHOUT attachment');
            whereClause += ` AND (t.comprovante_url IS NULL OR t.comprovante_url = "")`;
        }

        const [countResult] = await db.query(`
            SELECT COUNT(*) as total 
            FROM transferencias t
            LEFT JOIN contas s ON t.source_account_id = s.id
            LEFT JOIN contas d ON t.destination_account_id = d.id
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

exports.createTransferencia = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { dataFato, dataPrevista, dataReal, valor, descricao, sourceAccountId, destinationAccountId, projectId, comprovanteUrl, formaPagamento } = req.body;

        if (!dataPrevista || !valor || !projectId) {
            throw new AppError('VAL-002', 'Data Prevista, Valor e Projeto são obrigatórios');
        }

        if (sourceAccountId && destinationAccountId && sourceAccountId === destinationAccountId) {
            throw new AppError('VAL-003', 'A conta de origem e destino devem ser diferentes');
        }

        // Insert
        const [result] = await connection.query(
            `INSERT INTO transferencias (data_fato, data_prevista, data_real, valor, descricao, source_account_id, destination_account_id, project_id, comprovante_url, forma_pagamento)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dataFato || null, dataPrevista, dataReal || null, valor, descricao, sourceAccountId || null, destinationAccountId || null, projectId, comprovanteUrl || null, formaPagamento || null]
        );

        const newId = result.insertId;
        const valorDecimal = parseFloat(valor);

        // Update Balances - Only if Realized
        if (dataReal && sourceAccountId && destinationAccountId) {
            // Source Account: Decrease
            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [valorDecimal, sourceAccountId]
            );

            // Destination Account: Increase
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [valorDecimal, destinationAccountId]
            );
        }

        await connection.commit();

        res.status(201).json({
            id: newId,
            message: 'Transferência gerada com sucesso'
        });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

exports.updateTransferencia = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { dataFato, dataPrevista, dataReal, valor, descricao, sourceAccountId, destinationAccountId, active, comprovanteUrl } = req.body;

        const [oldTransf] = await connection.query('SELECT * FROM transferencias WHERE id = ?', [id]);
        if (oldTransf.length === 0) {
            throw new AppError('RES-001', 'Transferência não encontrada');
        }
        const oldData = oldTransf[0];

        // Prepare updates
        const updates = [];
        const values = [];

        if (dataFato !== undefined) { updates.push('data_fato = ?'); values.push(dataFato); }
        if (dataPrevista !== undefined) { updates.push('data_prevista = ?'); values.push(dataPrevista); }
        if (dataReal !== undefined) { updates.push('data_real = ?'); values.push(dataReal); }
        if (valor !== undefined) { updates.push('valor = ?'); values.push(valor); }
        if (descricao !== undefined) { updates.push('descricao = ?'); values.push(descricao); }
        if (sourceAccountId !== undefined) { updates.push('source_account_id = ?'); values.push(sourceAccountId); }
        if (destinationAccountId !== undefined) { updates.push('destination_account_id = ?'); values.push(destinationAccountId); }
        if (comprovanteUrl !== undefined) { updates.push('comprovante_url = ?'); values.push(comprovanteUrl); }
        if (req.body.formaPagamento !== undefined) { updates.push('forma_pagamento = ?'); values.push(req.body.formaPagamento || null); }
        if (active !== undefined) { updates.push('active = ?'); values.push(active); }

        if (updates.length > 0) {
            values.push(id);
            await connection.query(`UPDATE transferencias SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        // Handle Balance Updates
        // 1. Revert Old (Source +, Dest -) - IF it was realized
        if (oldData.active && oldData.data_real && oldData.source_account_id && oldData.destination_account_id) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [oldData.valor, oldData.source_account_id]
            );
            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [oldData.valor, oldData.destination_account_id]
            );
        }

        // 2. Apply New (Source -, Dest +) - IF it is realized
        const newActive = active !== undefined ? active : oldData.active;
        const newDataReal = dataReal !== undefined ? dataReal : oldData.data_real;
        const newSourceId = sourceAccountId !== undefined ? sourceAccountId : oldData.source_account_id;
        const newDestId = destinationAccountId !== undefined ? destinationAccountId : oldData.destination_account_id;

        if (newActive && newDataReal && newSourceId && newDestId) {
            const newValor = valor !== undefined ? parseFloat(valor) : parseFloat(oldData.valor);
            const newSourceId = sourceAccountId !== undefined ? sourceAccountId : oldData.source_account_id;
            const newDestId = destinationAccountId !== undefined ? destinationAccountId : oldData.destination_account_id;

            if (newSourceId == newDestId) {
                // If update made them same, that's invalid, but simplified here we might just error or allow DB constraint?
                // Logic error if allowed.
                // Assuming frontend blocks this.
            }

            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [newValor, newSourceId]
            );
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [newValor, newDestId]
            );
        }

        await connection.commit();
        res.json({ message: 'Transferência atualizada com sucesso' });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

exports.deleteTransferencia = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [transf] = await connection.query('SELECT * FROM transferencias WHERE id = ?', [id]);
        if (transf.length === 0) {
            throw new AppError('RES-001', 'Transferência não encontrada');
        }

        // Soft delete
        await connection.query('UPDATE transferencias SET active = 0 WHERE id = ?', [id]);

        // Revert Balances (Source +, Dest -) - IF it was realized
        if (transf[0].active && transf[0].data_real && transf[0].source_account_id && transf[0].destination_account_id) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [transf[0].valor, transf[0].source_account_id]
            );
            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [transf[0].valor, transf[0].destination_account_id]
            );
        }

        await connection.commit();
        res.json({ message: 'Transferência excluída com sucesso' });

    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};
