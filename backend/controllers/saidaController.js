const db = require('../config/database');
const AppError = require('../utils/AppError');
const { validateDateWithinRange } = require('../utils/dateValidation');
const { logAudit } = require('../utils/auditLogger');
const { wrapConnectionWithAudit } = require('../utils/connectionWrapper');

// Helper function to generate dynamic ORDER BY clause
const getOrderByClause = (sortBy, order = 'desc') => {
    const validOrders = ['asc', 'desc'];
    const orderDirection = validOrders.includes(order?.toLowerCase()) ? order.toUpperCase() : 'DESC';

    const orderMappings = {
        'valor': `s.valor ${orderDirection}`,
        'data_fato': `s.data_fato ${orderDirection}`,
        'data_prevista_pagamento': `s.data_prevista_pagamento ${orderDirection}`,
        'data_real_pagamento': `s.data_real_pagamento ${orderDirection}`,
        'data_prevista_atraso': `s.data_prevista_atraso ${orderDirection}`,
        'descricao': `s.descricao ${orderDirection}`,
        'tipo_saida_name': `th.full_path ${orderDirection}`,
        'company_name': `emp.name ${orderDirection}`,
        'account_name': `c.name ${orderDirection}`
    };

    return orderMappings[sortBy] || 's.data_fato DESC, s.created_at DESC';
};

exports.listSaidas = async (req, res, next) => {
    try {
        const { projectId, page = 1, limit = 50, search, minValue, maxValue, sortBy, order } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(1000, Math.max(1, parseInt(limit) || 50));
        const offset = (pageNum - 1) * limitNum;

        if (!projectId) {
            throw new AppError('VAL-002', `Debug: query=${JSON.stringify(req.query)}, projectId=${projectId}`);
        }

        let whereClauses = ['s.project_id = ?', 's.active = 1'];
        let params = [projectId];

        // Dynamic Filtering - Specific Date Columns
        const addDateFilter = (field, startParam, endParam) => {
            if (req.query[startParam]) {
                whereClauses.push(`s.${field} >= ?`);
                params.push(req.query[startParam]);
            }
            if (req.query[endParam]) {
                whereClauses.push(`s.${field} <= ?`);
                params.push(`${req.query[endParam]} 23:59:59`);
            }
        };

        const addDateListFilter = (field, listParam) => {
            if (req.query[listParam]) {
                let dates = Array.isArray(req.query[listParam]) ? req.query[listParam] : [req.query[listParam]];
                const hasEmpty = dates.includes('__EMPTY__');

                if (hasEmpty) {
                    dates = dates.filter(d => d !== '__EMPTY__');
                }

                if (dates.length > 0) {
                    if (hasEmpty) {
                        whereClauses.push(`(DATE(s.${field}) IN (?) OR s.${field} IS NULL OR s.${field} = '0000-00-00' OR s.${field} = '' OR DATE(s.${field}) IS NULL)`);
                        params.push(dates);
                    } else {
                        whereClauses.push(`DATE(s.${field}) IN (?)`);
                        params.push(dates);
                    }
                } else if (hasEmpty) {
                    whereClauses.push(`(s.${field} IS NULL OR s.${field} = '0000-00-00' OR s.${field} = '' OR DATE(s.${field}) IS NULL)`);
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

        const includeEmptyValor = req.query.includeEmptyValor === 'true';
        let valorConditions = [];
        let valorParams = [];

        if (minValue) {
            valorConditions.push('s.valor >= ?');
            valorParams.push(minValue);
        }
        if (maxValue) {
            valorConditions.push('s.valor <= ?');
            valorParams.push(maxValue);
        }

        if (valorConditions.length > 0) {
            const rangeCondition = `(${valorConditions.join(' AND ')})`;
            if (includeEmptyValor) {
                // Range OR Empty
                whereClauses.push(`(${rangeCondition} OR s.valor IS NULL)`);
                params.push(...valorParams);
            } else {
                // Range Only
                whereClauses.push(rangeCondition);
                params.push(...valorParams);
            }
        } else if (includeEmptyValor) {
            // Only Empty
            whereClauses.push('s.valor IS NULL');
        }
        if (search) {
            whereClauses.push('(s.descricao LIKE ? OR emp.name LIKE ? OR c.name LIKE ?)');
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        // Specific Text Filters
        if (req.query.description) {
            whereClauses.push('s.descricao LIKE ?');
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

        if (req.query.tipoSaida) {
            whereClauses.push('th.full_path LIKE ?');
            params.push(`%${req.query.tipoSaida}%`);
        }

        // List Filters for Text Columns
        const addTextListFilter = (field, listParam) => {
            if (req.query[listParam]) {
                const values = Array.isArray(req.query[listParam]) ? req.query[listParam] : [req.query[listParam]];
                if (values.length > 0) {
                    whereClauses.push(`${field} IN (?)`);
                    params.push(values);
                }
            }
        };

        addTextListFilter('s.descricao', 'descriptionList');
        addTextListFilter('c.name', 'accountList');
        addTextListFilter('emp.name', 'companyList');
        addTextListFilter('th.full_path', 'tipoSaidaList');

        // Attachment Filter
        if (req.query.hasAttachment === '1') {
            whereClauses.push('s.comprovante_url IS NOT NULL AND s.comprovante_url != ""');
        } else if (req.query.hasAttachment === '0') {
            whereClauses.push('(s.comprovante_url IS NULL OR s.comprovante_url = "")');
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count Total
        const countQuery = `
            WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_saida
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_saida t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
            )
            SELECT COUNT(*) as total
            FROM saidas s
            LEFT JOIN TypeHierarchy th ON s.tipo_saida_id = th.id
            INNER JOIN empresas emp ON s.company_id = emp.id
            LEFT JOIN contas c ON s.account_id = c.id
            ${whereSQL}`;

        const [countResult] = await db.query(countQuery, params);
        const totalItems = countResult[0].total;

        // Fetch Data
        const dataQuery = `
            WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_saida
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_saida t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
             )
             SELECT 
                s.*,
                th.full_path as tipo_saida_name,
                emp.name as company_name,
                emp.cnpj as company_cnpj,
                c.name as account_name
             FROM saidas s
             LEFT JOIN TypeHierarchy th ON s.tipo_saida_id = th.id
             INNER JOIN empresas emp ON s.company_id = emp.id
             LEFT JOIN contas c ON s.account_id = c.id
             ${whereSQL}
             ORDER BY 
             ${getOrderByClause(sortBy, order)}
             LIMIT ? OFFSET ?`;

        const [saidas] = await db.query(dataQuery, [...params, limitNum, offset]);

        res.json({
            data: saidas,
            meta: {
                total: totalItems,
                page: pageNum,
                pages: Math.ceil(totalItems / limitNum),
                limit: limitNum
            }
        });
    } catch (error) {
        next(error);
    }
};

// Helper functions for installment calculation
const calculateInstallments = (totalValue, count, type) => {
    if (type === 'total') return [totalValue];

    if (type === 'dividir') {
        // Divide the total value into equal parts
        const baseValue = Math.floor((totalValue * 100) / count) / 100;
        const remainder = Math.round((totalValue - (baseValue * count)) * 100) / 100;

        // First installment gets the remainder (rounding difference)
        const installments = [baseValue + remainder];
        for (let i = 1; i < count; i++) {
            installments.push(baseValue);
        }
        return installments;
    }

    if (type === 'replicar') {
        // Replicate the full value for each installment
        return Array(count).fill(totalValue);
    }

    return [totalValue];
};

// Helper to parse date string as local time (not UTC)
const parseLocalDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(num => parseInt(num));
    return new Date(year, month - 1, day); // month is 0-indexed
};

// Helper to safely add months (handling 31st -> 28th/30th rollover)
const addMonths = (date, months) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    // If day changed, it meant we overflowed (e.g. Jan 31 -> Feb 03), so snap back to last day of intended month
    if (d.getDate() !== day) {
        d.setDate(0);
    }
    return d;
};

const calculateDates = (baseDate, count, interval, customDays = null) => {
    const dates = [baseDate];

    for (let i = 1; i < count; i++) {
        const prevDate = parseLocalDate(dates[i - 1]);
        let nextDate;

        switch (interval) {
            case 'semanal':
                nextDate = new Date(prevDate);
                nextDate.setDate(prevDate.getDate() + 7);
                break;
            case 'quinzenal':
                nextDate = new Date(prevDate);
                nextDate.setDate(prevDate.getDate() + 15);
                break;
            case 'mensal':
                nextDate = addMonths(prevDate, 1);
                break;
            case 'trimestral':
                nextDate = addMonths(prevDate, 3);
                break;
            case 'semestral':
                nextDate = addMonths(prevDate, 6);
                break;
            case 'anual':
                nextDate = addMonths(prevDate, 12);
                break;
            case 'personalizado':
                nextDate = new Date(prevDate);
                nextDate.setDate(prevDate.getDate() + (customDays || 1));
                break;
            default:
                nextDate = prevDate;
        }

        // Format to YYYY-MM-DD
        const year = nextDate.getFullYear();
        const month = String(nextDate.getMonth() + 1).padStart(2, '0');
        const day = String(nextDate.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }

    return dates;
};

exports.createSaida = async (req, res, next) => {
    let connection;
    try {
        const {
            dataFato,
            dataPrevistaPagamento,
            dataAtraso,
            dataRealPagamento,
            valor,
            descricao,
            tipoSaidaId,
            companyId,
            accountId,
            projectId,
            comprovanteUrl,
            boletoUrl,
            formaPagamento,
            installmentType,
            installmentCount,
            installmentInterval,
            customDays
        } = req.body;

        // Validations
        if (!dataFato || !dataPrevistaPagamento || !valor || !tipoSaidaId || !companyId || !projectId) {
            throw new AppError('VAL-002');
        }

        if (dataRealPagamento && !accountId) {
            throw new AppError('VAL-002', 'Conta é obrigatória para pagamentos realizados.');
        }

        const valorDecimal = parseFloat(valor);
        if (isNaN(valorDecimal)) {
            throw new AppError('VAL-001', 'Valor inválido.');
        }

        // Validate dataRealPagamento if provided
        if (dataRealPagamento) {
            const validation = await validateDateWithinRange(dataRealPagamento, projectId, req.user.role);
            if (!validation.isValid) {
                throw new AppError('VAL-DATE', validation.error);
            }
        }

        // Regra de negócio: data_atraso
        // 1. Se data_atraso <= data_prevista → ignorar (não houve atraso)
        // 2. Se data_real > data_prevista e data_atraso não foi informada → registrar data_real como atraso
        let dataAtrasoFinal = dataAtraso || null;
        if (dataAtrasoFinal && dataPrevistaPagamento && dataAtrasoFinal <= dataPrevistaPagamento) {
            dataAtrasoFinal = null;
        }
        if (!dataAtrasoFinal && dataRealPagamento && dataPrevistaPagamento && dataRealPagamento > dataPrevistaPagamento) {
            dataAtrasoFinal = dataRealPagamento;
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Determine installment parameters
        const type = installmentType || 'total';
        const count = (type === 'total') ? 1 : (parseInt(installmentCount) || 1);
        const interval = installmentInterval || 'mensal';
        const days = customDays ? parseInt(customDays) : null;

        // Calculate installments and dates
        const installmentValues = calculateInstallments(valorDecimal, count, type);
        const installmentDates = calculateDates(dataPrevistaPagamento, count, interval, days);

        // Calculate fact dates based on type
        let factDates;
        if (type === 'replicar') {
            // For REPLICAR: data_fato increments with each interval (recorrente)
            factDates = calculateDates(dataFato, count, interval, days);
        } else {
            // For DIVIDIR or TOTAL: data_fato stays the same for all installments (parcelamento)
            factDates = Array(count).fill(dataFato);
        }

        const createdIds = [];

        // Generate group ID for installments if count > 1
        const groupId = count > 1 ? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : null;

        // Create each installment
        for (let i = 0; i < count; i++) {
            const installmentDesc = count > 1
                ? `${descricao || ''} - Parcela ${i + 1}/${count}`.trim()
                : descricao;

            const [result] = await connection.query(
                `INSERT INTO saidas 
                (data_fato, data_prevista_pagamento, data_real_pagamento, data_atraso, valor, descricao, tipo_saida_id, company_id, account_id, project_id, comprovante_url, boleto_url, forma_pagamento, installment_group_id, installment_number, installment_total, installment_interval, installment_custom_days) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    factDates[i],
                    installmentDates[i],
                    dataRealPagamento || null,
                    dataAtrasoFinal,
                    installmentValues[i],
                    installmentDesc,
                    tipoSaidaId,
                    companyId,
                    accountId,
                    projectId,
                    comprovanteUrl || null,
                    boletoUrl || null,
                    formaPagamento || null,
                    groupId,
                    count > 1 ? i + 1 : null,
                    count > 1 ? count : null,
                    count > 1 ? interval : null,
                    count > 1 && interval === 'personalizado' ? days : null
                ]
            );

            createdIds.push(result.insertId);

            // Update account balance only if there's a real payment date - SUBTRACT for expenses
            if (dataRealPagamento && accountId) {
                await connection.query(
                    'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                    [installmentValues[i], accountId]
                );
            }
        }

        await connection.commit();
        logAudit(req, 'CREATE', 'saidas', createdIds[0], { count: createdIds.length, totalValue: valorDecimal, description: descricao });

        res.status(201).json({
            message: `${count} saída(s) criada(s) com sucesso`,
            ids: createdIds,
            count: createdIds.length
        });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.updateSaida = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const {
            dataFato,
            dataPrevistaPagamento,
            dataRealPagamento,
            dataAtraso,
            valor,
            descricao,
            tipoSaidaId,
            companyId,
            accountId,
            active,
            comprovanteUrl,
            boletoUrl,
            formaPagamento
        } = req.body;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get old saida data
        const [oldSaida] = await connection.query(
            'SELECT valor, account_id, data_real_pagamento FROM saidas WHERE id = ?',
            [id]
        );

        if (!oldSaida.length) {
            throw new AppError('RES-001', 'Saída não encontrada.');
        }

        // Validate dataRealPagamento if provided AND changed
        const oldData = oldSaida[0];
        let shouldUpdateRealDate = false;

        if (dataRealPagamento !== undefined) {
            const newDate = dataRealPagamento ? dataRealPagamento.split('T')[0] : null;
            const oldDate = oldData.data_real_pagamento ? new Date(oldData.data_real_pagamento).toISOString().split('T')[0] : null;

            if (newDate !== oldDate) {
                shouldUpdateRealDate = true;
                if (newDate) {
                    const validation = await validateDateWithinRange(dataRealPagamento, req.user.projectId, req.user.role);
                    if (!validation.isValid) {
                        throw new AppError('VAL-DATE', validation.error);
                    }
                }
            }
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
        if (shouldUpdateRealDate) {
            updates.push('data_real_pagamento = ?');
            values.push(dataRealPagamento || null);
        }

        let newValor = oldSaida[0].valor;
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
        if (tipoSaidaId !== undefined) {
            updates.push('tipo_saida_id = ?');
            values.push(tipoSaidaId);
        }
        if (companyId !== undefined) {
            updates.push('company_id = ?');
            values.push(companyId);
        }

        let newAccountId = oldSaida[0].account_id;
        if (accountId !== undefined) {
            updates.push('account_id = ?');
            values.push(accountId);
            newAccountId = accountId;
        }

        if (active !== undefined) {
            updates.push('active = ?');
            values.push(active);
        }

        if (comprovanteUrl !== undefined) {
            updates.push('comprovante_url = ?');
            values.push(comprovanteUrl || null);
        }

        if (boletoUrl !== undefined) {
            updates.push('boleto_url = ?');
            values.push(boletoUrl || null);
        }

        if (formaPagamento !== undefined) {
            updates.push('forma_pagamento = ?');
            values.push(formaPagamento || null);
        }

        // Regra de negócio: data_atraso
        if (dataAtraso !== undefined) {
            const effectivePrevista = dataPrevistaPagamento !== undefined
                ? dataPrevistaPagamento
                : (oldData.data_prevista_pagamento ? String(oldData.data_prevista_pagamento).substring(0, 10) : null);
            let finalDataAtraso = dataAtraso || null;
            if (finalDataAtraso && effectivePrevista && finalDataAtraso <= effectivePrevista) {
                finalDataAtraso = null;
            }
            updates.push('data_atraso = ?');
            values.push(finalDataAtraso);
        }

        if (updates.length > 0) {
            values.push(id);
            await connection.query(
                `UPDATE saidas SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Update balances if value or account changed
        // 1. Revert old transaction from old account (ADD back the expense)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [oldSaida[0].valor, oldSaida[0].account_id]
        );

        // 2. Apply new transaction to new account (SUBTRACT the new expense)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [newValor, newAccountId]
        );

        await connection.commit();
        logAudit(req, 'UPDATE', 'saidas', id, { updates: updates.length });
        res.json({ message: 'Saída updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteSaida = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await db.getConnection();
        const audited = wrapConnectionWithAudit(connection, req);
        await audited.beginTransaction();

        // Get saida details first to know the amount and account
        const [saida] = await audited.query(
            'SELECT valor, account_id FROM saidas WHERE id = ? AND active = 1',
            [id]
        );

        if (saida.length === 0) {
            throw new AppError('RES-001', 'Saída não encontrada.');
        }

        // Soft delete
        await audited.query('UPDATE saidas SET active = 0 WHERE id = ?', [id]);

        // Increase account balance (revert the expense - ADD back the money)
        await audited.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [saida[0].valor, saida[0].account_id]
        );

        await audited.commit();
        // Audit is automatic via connectionWrapper
        res.json({ message: 'Saída deleted successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

// Helper function for single update (used by batch)
async function executeSingleUpdate(connection, id, updateData, projectId) {
    const [oldSaida] = await connection.query(
        'SELECT valor, account_id, data_real_pagamento FROM saidas WHERE id = ?',
        [id]
    );

    if (!oldSaida.length) {
        throw new AppError('RES-001', 'Registro não encontrado');
    }

    const oldData = oldSaida[0];

    // Validate dataRealPagamento if provided AND changed
    let shouldUpdateRealDate = false;
    if (updateData.dataRealPagamento !== undefined) {
        const newDate = updateData.dataRealPagamento ? updateData.dataRealPagamento.split('T')[0] : null;
        const oldDate = oldData.data_real_pagamento ? new Date(oldData.data_real_pagamento).toISOString().split('T')[0] : null;

        if (newDate !== oldDate) {
            shouldUpdateRealDate = true;
            if (newDate) {
                const validation = await validateDateWithinRange(updateData.dataRealPagamento, projectId, req.user.role);
                if (!validation.isValid) {
                    throw new AppError('VAL-DATE', validation.error);
                }
            }
        }
    }

    const updates = [];
    const values = [];

    if (updateData.dataFato !== undefined) {
        updates.push('data_fato = ?');
        values.push(updateData.dataFato);
    }
    if (updateData.dataPrevistaPagamento !== undefined) {
        updates.push('data_prevista_pagamento = ?');
        values.push(updateData.dataPrevistaPagamento);
    }
    if (shouldUpdateRealDate) {
        updates.push('data_real_pagamento = ?');
        values.push(updateData.dataRealPagamento || null);
    }
    if (updateData.dataAtraso !== undefined) {
        updates.push('data_atraso = ?');
        values.push(updateData.dataAtraso || null);
    }

    let newValor = oldData.valor;
    if (updateData.valor !== undefined) {
        const valorDecimal = parseFloat(updateData.valor);
        if (!isNaN(valorDecimal)) {
            updates.push('valor = ?');
            values.push(valorDecimal);
            newValor = valorDecimal;
        }
    }

    if (updateData.descricao !== undefined) {
        updates.push('descricao = ?');
        values.push(updateData.descricao);
    }
    if (updateData.tipoSaidaId !== undefined) {
        updates.push('tipo_saida_id = ?');
        values.push(updateData.tipoSaidaId);
    }
    if (updateData.companyId !== undefined) {
        updates.push('company_id = ?');
        values.push(updateData.companyId);
    }

    let newAccountId = oldData.account_id;
    if (updateData.accountId !== undefined) {
        updates.push('account_id = ?');
        values.push(updateData.accountId);
        newAccountId = updateData.accountId;
    }

    if (updateData.active !== undefined) {
        updates.push('active = ?');
        values.push(updateData.active);
    }

    if (updateData.comprovanteUrl !== undefined) {
        updates.push('comprovante_url = ?');
        values.push(updateData.comprovanteUrl);
    }
    if (updateData.boletoUrl !== undefined) {
        updates.push('boleto_url = ?');
        values.push(updateData.boletoUrl || null);
    }
    if (updateData.formaPagamento !== undefined) {
        updates.push('forma_pagamento = ?');
        values.push(updateData.formaPagamento || null);
    }

    if (updates.length > 0) {
        values.push(id);
        await connection.query(
            `UPDATE saidas SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        // Update balances for SAIDAS
        // 1. Revert old transaction (ADD back the money because it was an expense)
        if (oldData.account_id && oldData.data_real_pagamento) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [oldData.valor, oldData.account_id]
            );
        }

        // 2. Apply new transaction (SUBTRACT the money because it is an expense)
        if (newAccountId && (updateData.dataRealPagamento || oldData.data_real_pagamento)) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [newValor, newAccountId]
            );
        }
    }

    return true;
}

// Batch update saidas based on scope
exports.batchUpdateSaida = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const { scope, ...updateData } = req.body;

        if (!['single', 'all', 'future'].includes(scope)) {
            throw new AppError('VAL-002', 'Escopo inválido. Use: single, all ou future');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get the current record's installment info
        const [current] = await connection.query(
            'SELECT installment_group_id, installment_number, installment_total, installment_interval, installment_custom_days, project_id FROM saidas WHERE id = ?',
            [id]
        );

        if (!current.length) {
            throw new AppError('RES-001', 'Registro não encontrado');
        }

        const currentData = current[0];

        // For scope 'single', just update the current record normally
        if (scope === 'single') {
            const updateResult = await executeSingleUpdate(connection, id, updateData, currentData.project_id);
            await connection.commit();
            return res.json({ success: true, message: 'Registro atualizado com sucesso', updated: 1 });
        }

        // For 'all' and 'future', we need to fetch all relevant installments
        let baseInstallmentNumber;
        let installmentsToUpdate;

        if (scope === 'all' && currentData.installment_group_id) {
            baseInstallmentNumber = 1;
            const [allInstallments] = await connection.query(
                'SELECT id, installment_number FROM saidas WHERE installment_group_id = ? AND active = 1 ORDER BY installment_number ASC',
                [currentData.installment_group_id]
            );
            installmentsToUpdate = allInstallments;
        } else if (scope === 'future' && currentData.installment_group_id) {
            baseInstallmentNumber = currentData.installment_number;
            const [futureInstallments] = await connection.query(
                'SELECT id, installment_number FROM saidas WHERE installment_group_id = ? AND installment_number >= ? AND active = 1 ORDER BY installment_number ASC',
                [currentData.installment_group_id, currentData.installment_number]
            );
            installmentsToUpdate = futureInstallments;
        } else {
            // No installment group, treat as single
            const updateResult = await executeSingleUpdate(connection, id, updateData, currentData.project_id);
            await connection.commit();
            return res.json({ success: true, message: 'Registro atualizado com sucesso', updated: 1 });
        }

        const interval = currentData.installment_interval || 'mensal';
        const isReplicar = true;

        let updatedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Calculate base dates
        let baseDataFato = updateData.dataFato;
        let baseDataPrevista = updateData.dataPrevistaPagamento; // Note: dataPrevistaPagamento

        if ((scope === 'all' || scope === 'future') && interval) {
            const intervalsToSubtract = currentData.installment_number - baseInstallmentNumber;

            if (baseDataFato && intervalsToSubtract > 0) {
                const providedDate = parseLocalDate(baseDataFato);
                let calculatedBaseDate = new Date(providedDate);

                switch (interval) {
                    case 'semanal': calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (7 * intervalsToSubtract)); break;
                    case 'quinzenal': calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (15 * intervalsToSubtract)); break;
                    case 'mensal': calculatedBaseDate = addMonths(calculatedBaseDate, -intervalsToSubtract); break;
                    case 'trimestral': calculatedBaseDate = addMonths(calculatedBaseDate, -(3 * intervalsToSubtract)); break;
                    case 'semestral': calculatedBaseDate = addMonths(calculatedBaseDate, -(6 * intervalsToSubtract)); break;
                    case 'anual': calculatedBaseDate = addMonths(calculatedBaseDate, -(12 * intervalsToSubtract)); break;
                    case 'personalizado':
                        if (currentData.installment_custom_days) {
                            calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (parseInt(currentData.installment_custom_days) * intervalsToSubtract));
                        }
                        break;
                }

                const year = calculatedBaseDate.getFullYear();
                const month = String(calculatedBaseDate.getMonth() + 1).padStart(2, '0');
                const day = String(calculatedBaseDate.getDate()).padStart(2, '0');
                baseDataFato = `${year}-${month}-${day}`;
            }

            if (baseDataPrevista && intervalsToSubtract > 0) {
                const providedDate = parseLocalDate(baseDataPrevista);
                let calculatedBaseDate = new Date(providedDate);

                switch (interval) {
                    case 'semanal': calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (7 * intervalsToSubtract)); break;
                    case 'quinzenal': calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (15 * intervalsToSubtract)); break;
                    case 'mensal': calculatedBaseDate = addMonths(calculatedBaseDate, -intervalsToSubtract); break;
                    case 'trimestral': calculatedBaseDate = addMonths(calculatedBaseDate, -(3 * intervalsToSubtract)); break;
                    case 'semestral': calculatedBaseDate = addMonths(calculatedBaseDate, -(6 * intervalsToSubtract)); break;
                    case 'anual': calculatedBaseDate = addMonths(calculatedBaseDate, -(12 * intervalsToSubtract)); break;
                    case 'personalizado':
                        if (currentData.installment_custom_days) {
                            calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (parseInt(currentData.installment_custom_days) * intervalsToSubtract));
                        }
                        break;
                }

                const year = calculatedBaseDate.getFullYear();
                const month = String(calculatedBaseDate.getMonth() + 1).padStart(2, '0');
                const day = String(calculatedBaseDate.getDate()).padStart(2, '0');
                baseDataPrevista = `${year}-${month}-${day}`;
            }
        }

        // Update each installment
        for (const installment of installmentsToUpdate) {
            try {
                const installmentId = installment.id;
                const installmentNum = installment.installment_number;
                const offsetFromBase = installmentNum - baseInstallmentNumber;

                const [oldSaida] = await connection.query(
                    'SELECT valor, account_id, data_real_pagamento, data_fato, data_prevista_pagamento FROM saidas WHERE id = ?',
                    [installmentId]
                );

                if (!oldSaida.length) continue;
                const oldData = oldSaida[0];

                let shouldUpdateRealDate = false;
                if (updateData.dataRealPagamento !== undefined) {
                    const newDate = updateData.dataRealPagamento ? updateData.dataRealPagamento.split('T')[0] : null;
                    const oldDate = oldData.data_real_pagamento ? new Date(oldData.data_real_pagamento).toISOString().split('T')[0] : null;

                    if (newDate !== oldDate) {
                        shouldUpdateRealDate = true;
                        if (newDate) {
                            const validation = await validateDateWithinRange(updateData.dataRealPagamento, currentData.project_id, req.user.role);
                            if (!validation.isValid) {
                                skippedCount++;
                                errors.push(`Parcela ${installmentNum}: ${validation.error}`);
                                continue;
                            }
                        }
                    }
                }

                const updates = [];
                const values = [];

                if (baseDataFato !== undefined) {
                    let finalDataFato;
                    if (offsetFromBase === 0) finalDataFato = baseDataFato;
                    else {
                        const allDates = calculateDates(baseDataFato, offsetFromBase + 1, interval, currentData.installment_custom_days);
                        finalDataFato = allDates[offsetFromBase];
                    }
                    updates.push('data_fato = ?');
                    values.push(finalDataFato);
                }

                if (baseDataPrevista !== undefined) {
                    let finalDataPrevista;
                    if (offsetFromBase === 0) finalDataPrevista = baseDataPrevista;
                    else {
                        const allDates = calculateDates(baseDataPrevista, offsetFromBase + 1, interval, currentData.installment_custom_days);
                        finalDataPrevista = allDates[offsetFromBase];
                    }
                    updates.push('data_prevista_pagamento = ?'); // Updated field name
                    values.push(finalDataPrevista);
                }

                if (shouldUpdateRealDate) {
                    updates.push('data_real_pagamento = ?');
                    values.push(updateData.dataRealPagamento || null);
                }
                if (updateData.dataAtraso !== undefined) {
                    updates.push('data_atraso = ?');
                    values.push(updateData.dataAtraso || null);
                }

                let newValor = oldData.valor;
                if (updateData.valor !== undefined) {
                    const valorDecimal = parseFloat(updateData.valor);
                    if (!isNaN(valorDecimal)) {
                        updates.push('valor = ?');
                        values.push(valorDecimal);
                        newValor = valorDecimal;
                    }
                }

                if (updateData.descricao !== undefined) {
                    updates.push('descricao = ?');
                    values.push(updateData.descricao);
                }
                if (updateData.tipoSaidaId !== undefined) {
                    updates.push('tipo_saida_id = ?');
                    values.push(updateData.tipoSaidaId);
                }
                if (updateData.companyId !== undefined) {
                    updates.push('company_id = ?');
                    values.push(updateData.companyId);
                }

                let newAccountId = oldData.account_id;
                if (updateData.accountId !== undefined) {
                    updates.push('account_id = ?');
                    values.push(updateData.accountId);
                    newAccountId = updateData.accountId;
                }

                if (updateData.active !== undefined) {
                    updates.push('active = ?');
                    values.push(updateData.active);
                }

                if (updateData.comprovanteUrl !== undefined && installmentId === parseInt(id)) {
                    updates.push('comprovante_url = ?');
                    values.push(updateData.comprovanteUrl || null);
                }
                if (updateData.boletoUrl !== undefined && installmentId === parseInt(id)) {
                    updates.push('boleto_url = ?');
                    values.push(updateData.boletoUrl || null);
                }
                if (updateData.formaPagamento !== undefined) {
                    updates.push('forma_pagamento = ?');
                    values.push(updateData.formaPagamento || null);
                }

                if (updates.length > 0) {
                    values.push(installmentId);
                    await connection.query(
                        `UPDATE saidas SET ${updates.join(', ')} WHERE id = ?`,
                        values
                    );

                    // Update balances for SAIDAS
                    // 1. Revert old transaction (ADD back)
                    if (oldData.account_id && oldData.data_real_pagamento) {
                        await connection.query(
                            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                            [oldData.valor, oldData.account_id]
                        );
                    }

                    // 2. Apply new transaction (SUBTRACT)
                    if (newAccountId && (updateData.dataRealPagamento || oldData.data_real_pagamento)) {
                        await connection.query(
                            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                            [newValor, newAccountId]
                        );
                    }

                    updatedCount++;
                }
            } catch (error) {
                console.error(`Error updating installment ${installment.id}:`, error);
                skippedCount++;
                errors.push(`Parcela ${installment.installment_number}: ${error.message}`);
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: `${updatedCount} de ${installmentsToUpdate.length} registro(s) atualizado(s)`,
            updated: updatedCount,
            skipped: skippedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.batchDeleteSaida = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const { scope } = req.body;

        if (!['single', 'all', 'future'].includes(scope)) {
            throw new AppError('VAL-002', 'Escopo inválido. Use: single, all ou future');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [current] = await connection.query(
            'SELECT installment_group_id, installment_number FROM saidas WHERE id = ? AND active = 1',
            [id]
        );

        if (!current.length) {
            throw new AppError('RES-001', 'Registro não encontrado');
        }

        const currentData = current[0];
        let idsToDelete = [id];

        if (scope === 'all' && currentData.installment_group_id) {
            const [allInstallments] = await connection.query(
                'SELECT id FROM saidas WHERE installment_group_id = ? AND active = 1',
                [currentData.installment_group_id]
            );
            idsToDelete = allInstallments.map(i => i.id);
        } else if (scope === 'future' && currentData.installment_group_id) {
            const [futureInstallments] = await connection.query(
                'SELECT id FROM saidas WHERE installment_group_id = ? AND installment_number >= ? AND active = 1',
                [currentData.installment_group_id, currentData.installment_number]
            );
            idsToDelete = futureInstallments.map(i => i.id);
        }

        let deletedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const deleteId of idsToDelete) {
            try {
                const [saida] = await connection.query(
                    'SELECT valor, account_id, data_real_pagamento FROM saidas WHERE id = ? AND active = 1',
                    [deleteId]
                );

                if (saida.length === 0) continue;

                await connection.query('UPDATE saidas SET active = 0 WHERE id = ?', [deleteId]);

                // Balance adjustment for SAIDAS:
                // Expense deleted -> Money returns to account -> ADD
                if (saida[0].account_id && saida[0].data_real_pagamento) {
                    await connection.query(
                        'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                        [saida[0].valor, saida[0].account_id]
                    );
                }

                deletedCount++;
            } catch (error) {
                console.error(`Error deleting installment ${deleteId}:`, error);
                skippedCount++;
                errors.push(`Parcela ${deleteId}: ${error.message}`);
            }
        }

        await connection.commit();
        logAudit(req, 'DELETE', 'saidas', id, { scope, deletedCount });

        res.json({
            success: true,
            message: `${deletedCount} de ${idsToDelete.length} registro(s) excluído(s)`,
            deleted: deletedCount,
            skipped: skippedCount,
            total: idsToDelete.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

// Bulk Delete - Delete a list of arbitrary IDs
exports.bulkDeleteSaidas = async (req, res, next) => {
    let connection;
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new AppError('VAL-002', 'Lista de IDs inválida ou vazia');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        let deletedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const deleteId of ids) {
            try {
                // Get saida details
                const [saida] = await connection.query(
                    'SELECT valor, account_id, data_real_pagamento FROM saidas WHERE id = ? AND active = 1',
                    [deleteId]
                );

                if (saida.length === 0) {
                    skippedCount++;
                    continue;
                }

                // Soft delete
                await connection.query('UPDATE saidas SET active = 0 WHERE id = ?', [deleteId]);

                // Balance Adjustment: Expense deleted -> Return money to account -> ADD
                if (saida[0].account_id && saida[0].data_real_pagamento) {
                    await connection.query(
                        'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                        [saida[0].valor, saida[0].account_id]
                    );
                }

                deletedCount++;
            } catch (error) {
                console.error(`Error deleting ID ${deleteId}:`, error);
                skippedCount++;
                errors.push(`ID ${deleteId}: ${error.message}`);
            }
        }

        await connection.commit();
        logAudit(req, 'BULK_DELETE', 'saidas', ids.join(','), { count: deletedCount });

        res.json({
            success: true,
            message: `${deletedCount} registro(s) excluído(s) com sucesso.`,
            deleted: deletedCount,
            skipped: skippedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

// Bulk Edit - Update multiple IDs with same changes
exports.bulkEditSaidas = async (req, res, next) => {
    let connection;
    try {
        const { ids, updates } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new AppError('VAL-002', 'Lista de IDs inválida ou vazia');
        }

        if (!updates || Object.keys(updates).length === 0) {
            throw new AppError('VAL-002', 'Nenhuma atualização fornecida');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const setClauses = [];
        const values = [];

        if (updates.tipo_id) {
            setClauses.push('tipo_saida_id = ?');
            values.push(updates.tipo_id);
        }

        if (updates.company_id) {
            setClauses.push('company_id = ?');
            values.push(updates.company_id);
        }

        if (updates.account_id) {
            setClauses.push('account_id = ?');
            values.push(updates.account_id);
        }

        if (updates.description_mode && updates.description_value) {
            if (updates.description_mode === 'replace') {
                setClauses.push('descricao = ?');
                values.push(updates.description_value);
            } else if (updates.description_mode === 'prefix') {
                setClauses.push('descricao = CONCAT(?, descricao)');
                values.push(updates.description_value + ' ');
            } else if (updates.description_mode === 'suffix') {
                setClauses.push('descricao = CONCAT(descricao, ?)');
                values.push(' ' + updates.description_value);
            }
        }

        if (setClauses.length === 0) {
            throw new AppError('VAL-002', 'Nenhuma atualização válida');
        }

        // Add WHERE clause values
        values.push(req.user.projectId);
        ids.forEach(id => values.push(id));

        const placeholders = ids.map(() => '?').join(',');
        const query = `
            UPDATE saidas 
            SET ${setClauses.join(', ')}
            WHERE project_id = ? AND id IN (${placeholders}) AND active = 1
        `;

        const [result] = await connection.query(query, values);

        await connection.commit();
        logAudit(req, 'BULK_UPDATE', 'saidas', null, { ids, updates, affectedRows: result.affectedRows });

        res.json({
            success: true,
            message: `${result.affectedRows} ${result.affectedRows === 1 ? 'item atualizado' : 'itens atualizados'} com sucesso!`,
            updated: result.affectedRows
        });

    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};


