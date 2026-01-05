const db = require('../config/database');
const AppError = require('../utils/AppError');
const { validateDateWithinRange } = require('../utils/dateValidation');
const { logAudit } = require('../utils/auditLogger');

const getOrderByClause = (sortBy, order = 'asc') => {
    const direction = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    switch (sortBy) {
        case 'valor':
            return `e.valor ${direction}`;
        case 'data_fato':
            return `e.data_fato ${direction}`;
        case 'data_prevista_recebimento':
            return `e.data_prevista_recebimento ${direction}`;
        case 'data_real_recebimento':
            return `e.data_real_recebimento ${direction}`;
        case 'data_atraso':
            return `e.data_atraso ${direction}`;
        case 'descricao':
            return `e.descricao ${direction}`;
        case 'tipo_entrada_name':
            return `th.full_path ${direction}`; // Sorting by joined column (nested path)
        case 'company_name':
            return `emp.name ${direction}`;
        case 'account_name':
            return `c.name ${direction}`;
        default:
            return `e.data_fato DESC, e.created_at DESC`;
    }
};

exports.listIncomes = async (req, res, next) => {
    try {
        const { projectId, page = 1, limit = 50, search, startDate, endDate, minValue, maxValue } = req.query;

        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID is required');
        }

        const offset = (page - 1) * limit;
        const params = [];
        let whereClauses = ['e.project_id = ?', 'e.active = 1'];
        params.push(projectId);

        // Dynamic Filtering - Specific Date Columns
        // Helper to handle date range
        const addDateFilter = (field, startParam, endParam) => {
            if (req.query[startParam]) {
                whereClauses.push(`e.${field} >= ?`);
                params.push(req.query[startParam]);
            }
            if (req.query[endParam]) {
                // For end date, ensure we include the whole day (23:59:59)
                whereClauses.push(`e.${field} <= ?`);
                params.push(`${req.query[endParam]} 23:59:59`);
            }
        };

        const addDateListFilter = (field, listParam) => {
            if (req.query[listParam]) {
                const dates = Array.isArray(req.query[listParam]) ? req.query[listParam] : [req.query[listParam]];
                if (dates.length > 0) {
                    // Use DATE() function to match regardless of time component
                    whereClauses.push(`DATE(e.${field}) IN (?)`);
                    params.push(dates);
                }
            }
        };

        addDateFilter('data_fato', 'data_fatoStart', 'data_fatoEnd');
        addDateListFilter('data_fato', 'data_fatoList');

        addDateFilter('data_prevista_recebimento', 'data_prevista_recebimentoStart', 'data_prevista_recebimentoEnd');
        addDateListFilter('data_prevista_recebimento', 'data_prevista_recebimentoList');

        addDateFilter('data_real_recebimento', 'data_real_recebimentoStart', 'data_real_recebimentoEnd');
        addDateListFilter('data_real_recebimento', 'data_real_recebimentoList');

        addDateFilter('data_atraso', 'data_atrasoStart', 'data_atrasoEnd');
        addDateListFilter('data_atraso', 'data_atrasoList');

        if (minValue) {
            whereClauses.push('e.valor >= ?');
            params.push(minValue);
        }
        if (maxValue) {
            whereClauses.push('e.valor <= ?');
            params.push(maxValue);
        }
        if (search) {
            whereClauses.push('(e.descricao LIKE ? OR emp.name LIKE ? OR c.name LIKE ?)');
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        // Specific Text Filters
        if (req.query.description) {
            whereClauses.push('e.descricao LIKE ?');
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

        if (req.query.tipoEntrada) {
            whereClauses.push('th.full_path LIKE ?');
            params.push(`%${req.query.tipoEntrada}%`);
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

        addTextListFilter('e.descricao', 'descriptionList');
        addTextListFilter('c.name', 'accountList');
        addTextListFilter('emp.name', 'companyList');
        addTextListFilter('th.full_path', 'tipoEntradaList');

        // Attachment Filter
        if (req.query.hasAttachment === '1') {
            whereClauses.push('e.comprovante_url IS NOT NULL AND e.comprovante_url != ""');
        } else if (req.query.hasAttachment === '0') {
            whereClauses.push('(e.comprovante_url IS NULL OR e.comprovante_url = "")');
        }

        const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count Total
        const countQuery = `
            WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_entrada
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_entrada t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
            )
            SELECT COUNT(*) as total
            FROM entradas e
            LEFT JOIN TypeHierarchy th ON e.tipo_entrada_id = th.id
            INNER JOIN empresas emp ON e.company_id = emp.id
            LEFT JOIN contas c ON e.account_id = c.id
            ${whereSQL}`;

        const [countResult] = await db.query(countQuery, params);
        const totalItems = countResult[0].total;

        // Fetch Data
        const dataQuery = `
            WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_entrada
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_entrada t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
             )
             SELECT 
                e.*,
                th.full_path as tipo_entrada_name,
                emp.name as company_name,
                emp.cnpj as company_cnpj,
                c.name as account_name
             FROM entradas e
             LEFT JOIN TypeHierarchy th ON e.tipo_entrada_id = th.id
             INNER JOIN empresas emp ON e.company_id = emp.id
             LEFT JOIN contas c ON e.account_id = c.id
             ${whereSQL}
             ORDER BY 
             ${getOrderByClause(req.query.sortBy, req.query.order)}
             LIMIT ? OFFSET ?`;

        const [incomes] = await db.query(dataQuery, [...params, parseInt(limit), parseInt(offset)]);

        res.json({
            data: incomes,
            meta: {
                total: totalItems,
                page: parseInt(page),
                pages: Math.ceil(totalItems / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('❌ listIncomes ERROR:', error.message);
        console.error('SQL State:', error.sqlState);
        console.error('SQL:', error.sql?.substring(0, 200));
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

exports.createIncome = async (req, res, next) => {
    let connection;
    try {
        const {
            dataFato,
            dataPrevistaRecebimento,
            dataRealRecebimento,
            dataAtraso,
            valor,
            descricao,
            tipoEntradaId,
            companyId,
            accountId,
            projectId,
            formaPagamento,
            comprovanteUrl,
            installmentType,
            installmentCount,
            installmentInterval,
            customDays
        } = req.body;

        // Validations
        if (!dataFato || !dataPrevistaRecebimento || !valor || !tipoEntradaId || !companyId || !projectId) {
            throw new AppError('VAL-002');
        }

        if (dataRealRecebimento && !accountId) {
            throw new AppError('VAL-002', 'Conta é obrigatória para recebimentos realizados.');
        }

        const valorDecimal = parseFloat(valor);
        if (isNaN(valorDecimal)) {
            throw new AppError('VAL-001', 'Valor inválido.');
        }

        // Validate dataRealRecebimento if provided
        if (dataRealRecebimento) {
            const validation = await validateDateWithinRange(dataRealRecebimento, projectId, req.user.role);
            if (!validation.isValid) {
                throw new AppError('VAL-DATE', validation.error);
            }
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
        const installmentDates = calculateDates(dataPrevistaRecebimento, count, interval, days);

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
            const installmentDesc = descricao;

            const [result] = await connection.query(
                `INSERT INTO entradas 
                (data_fato, data_prevista_recebimento, data_real_recebimento, data_atraso, valor, descricao, tipo_entrada_id, company_id, account_id, project_id, comprovante_url, forma_pagamento, installment_group_id, installment_number, installment_total, installment_interval, installment_custom_days) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    factDates[i],
                    installmentDates[i],
                    dataRealRecebimento || null,
                    dataAtraso || null,
                    installmentValues[i],
                    installmentDesc,
                    tipoEntradaId,
                    companyId,
                    accountId,
                    projectId,
                    comprovanteUrl || null,
                    formaPagamento || null,
                    groupId,
                    count > 1 ? i + 1 : null,
                    count > 1 ? count : null,
                    count > 1 ? interval : null,
                    count > 1 && interval === 'personalizado' ? days : null
                ]
            );

            createdIds.push(result.insertId);

            // Update account balance only if there's a real receipt date
            if (dataRealRecebimento && accountId) {
                await connection.query(
                    'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                    [installmentValues[i], accountId]
                );
            }
        }

        await connection.commit();
        logAudit(req, 'CREATE', 'entradas', createdIds[0], { count: createdIds.length, totalValue: valorDecimal, description: descricao });

        res.status(201).json({
            success: true,
            ids: createdIds,
            count: createdIds.length,
            installmentType: type,
            message: count > 1
                ? `${count} ${type === 'dividir' ? 'parcelas criadas' : 'entradas recorrentes criadas'} com sucesso`
                : 'Entrada criada com sucesso'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.updateIncome = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const {
            dataFato,
            dataPrevistaRecebimento,
            dataRealRecebimento,
            dataAtraso,
            valor,
            descricao,
            tipoEntradaId,
            companyId,
            accountId,
            comprovanteUrl,
            active
        } = req.body;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get old income data including installment info
        const [oldIncome] = await connection.query(
            'SELECT valor, account_id, installment_group_id, installment_number, installment_total, installment_interval, installment_custom_days, data_prevista_recebimento FROM entradas WHERE id = ?',
            [id]
        );

        if (!oldIncome.length) {
            throw new AppError('RES-001', 'Entrada não encontrada.');
        }

        const oldData = oldIncome[0];

        // Validate dataRealRecebimento if provided
        if (dataRealRecebimento !== undefined && dataRealRecebimento !== null) {
            const validation = await validateDateWithinRange(dataRealRecebimento, oldData.project_id || req.user.projectId, req.user.role);
            if (!validation.isValid) {
                throw new AppError('VAL-DATE', validation.error);
            }
        }

        // Check if this is the first installment of a group and if predicted date is being changed
        if (oldData.installment_group_id &&
            oldData.installment_number === 1 &&
            dataPrevistaRecebimento &&
            dataPrevistaRecebimento !== oldData.data_prevista_recebimento) {

            console.log('🔄 Atualizando parcelas em cascata...');

            // Recalculate dates for all installments in the group
            const newDates = calculateDates(
                dataPrevistaRecebimento,
                oldData.installment_total,
                oldData.installment_interval,
                oldData.installment_custom_days
            );

            // Get all installments in the group
            const [installments] = await connection.query(
                'SELECT id, installment_number FROM entradas WHERE installment_group_id = ? AND id != ? ORDER BY installment_number',
                [oldData.installment_group_id, id]
            );

            // Update each installment's predicted date
            for (const inst of installments) {
                const newDate = newDates[inst.installment_number - 1];
                await connection.query(
                    'UPDATE entradas SET data_prevista_recebimento = ? WHERE id = ?',
                    [newDate, inst.id]
                );
                console.log(`✅ Parcela ${inst.installment_number} atualizada para ${newDate}`);
            }
        }

        const updates = [];
        const values = [];

        if (dataFato !== undefined) {
            updates.push('data_fato = ?');
            values.push(dataFato);
        }
        if (dataPrevistaRecebimento !== undefined) {
            updates.push('data_prevista_recebimento = ?');
            values.push(dataPrevistaRecebimento);
        }
        if (dataRealRecebimento !== undefined) {
            updates.push('data_real_recebimento = ?');
            values.push(dataRealRecebimento || null);
        }
        if (dataAtraso !== undefined) {
            updates.push('data_atraso = ?');
            values.push(dataAtraso || null);
        }

        let newValor = oldIncome[0].valor;
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
        if (tipoEntradaId !== undefined) {
            updates.push('tipo_entrada_id = ?');
            values.push(tipoEntradaId);
        }
        if (companyId !== undefined) {
            updates.push('company_id = ?');
            values.push(companyId);
        }

        let newAccountId = oldData.account_id;
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
            values.push(comprovanteUrl);
        }
        if (req.body.formaPagamento !== undefined) {
            updates.push('forma_pagamento = ?');
            values.push(req.body.formaPagamento || null);
        }

        if (updates.length > 0) {
            values.push(id);
            await connection.query(
                `UPDATE entradas SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        // Update balances if value or account changed
        // 1. Revert old transaction from old account
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [oldData.valor, oldData.account_id]
        );

        // 2. Apply new transaction to new account (even if same account, logic holds)
        await connection.query(
            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
            [newValor, newAccountId]
        );

        // Check if converting from single entry to installments
        if (req.body.installmentType && req.body.installmentType !== 'total' && !oldData.installment_group_id) {
            console.log('🔄 Converting single entry to installments...');

            const { installmentType, installmentCount, installmentInterval, installmentCustomDays } = req.body;
            const totalInstallments = parseInt(installmentCount) || 2;

            if (totalInstallments < 2 || totalInstallments > 120) {
                throw new AppError('VAL-001', 'Número de parcelas inválido (2-120).');
            }

            // Generate unique group ID
            const groupId = `grp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Calculate dates for all installments
            const baseDateFato = dataFato || oldData.data_fato;
            const baseDatePrevista = dataPrevistaRecebimento || oldData.data_prevista_recebimento;

            const datesPrevist = calculateDates(baseDatePrevista, totalInstallments, installmentInterval, installmentCustomDays);
            const datesFato = installmentType === 'replicar'
                ? calculateDates(baseDateFato, totalInstallments, installmentInterval, installmentCustomDays)
                : Array(totalInstallments).fill(baseDateFato);

            // Update current entry to be installment #1
            await connection.query(
                `UPDATE entradas SET 
                    installment_group_id = ?,
                    installment_number = 1,
                    installment_total = ?,
                    installment_interval = ?,
                    installment_custom_days = ?
                WHERE id = ?`,
                [groupId, totalInstallments, installmentInterval, installmentCustomDays || null, id]
            );

            // Create remaining installments (2 to N)
            for (let i = 2; i <= totalInstallments; i++) {
                await connection.query(
                    `INSERT INTO entradas (
                        data_fato, data_prevista_recebimento, valor, descricao,
                        tipo_entrada_id, company_id, account_id,
                        installment_group_id, installment_number, installment_total,
                        installment_interval, installment_custom_days,
                        project_id, active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    [
                        datesFato[i - 1],
                        datesPrevist[i - 1],
                        newValor,
                        descricao || oldData.descricao,
                        tipoEntradaId || oldData.tipo_entrada_id,
                        companyId || oldData.company_id,
                        null, // No account for future installments
                        groupId,
                        i,
                        totalInstallments,
                        installmentInterval,
                        installmentCustomDays || null,
                        req.user.projectId
                    ]
                );
                console.log(`✅ Created installment ${i} of ${totalInstallments}`);
            }

            console.log(`✅ Successfully converted to ${totalInstallments} installments`);
        }

        await connection.commit();
        logAudit(req, 'UPDATE', 'entradas', id, { scope: req.body.scope || 'single', updatedCount });
        res.json({ message: 'Income updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteIncome = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get income details first to know the amount and account
        const [income] = await connection.query(
            'SELECT valor, account_id FROM entradas WHERE id = ? AND active = 1',
            [id]
        );

        if (income.length === 0) {
            throw new AppError('RES-001', 'Entrada não encontrada.');
        }

        // Soft delete
        await connection.query('UPDATE entradas SET active = 0 WHERE id = ?', [id]);

        // Decrease account balance
        await connection.query(
            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
            [income[0].valor, income[0].account_id]
        );

        await connection.commit();
        logAudit(req, 'DELETE', 'entradas', id, { deletedAmount: income[0]?.valor });
        res.json({ message: 'Income deleted successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.getDistinctValues = async (req, res, next) => {
    try {
        const { projectId, field } = req.query;

        if (!projectId || !field) {
            return res.status(400).json({ error: 'Missing projectId or field parameter' });
        }

        let query = '';
        let params = [projectId];

        if (field === 'tipo_name') {
            query = `
             WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_entrada
                WHERE parent_id IS NULL AND project_id = ?
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_entrada t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
             )
             SELECT DISTINCT th.full_path as val
             FROM entradas e
             JOIN TypeHierarchy th ON e.tipo_entrada_id = th.id
             WHERE e.project_id = ? AND e.active = 1
             ORDER BY val`;
            params = [projectId, projectId];
        }
        else if (field === 'company_name') {
            query = `SELECT DISTINCT emp.name as val FROM entradas e JOIN empresas emp ON e.company_id = emp.id WHERE e.project_id = ? AND e.active = 1 ORDER BY val`;
        }
        else if (field === 'account_name') {
            query = `SELECT DISTINCT c.name as val FROM entradas e JOIN contas c ON e.account_id = c.id WHERE e.project_id = ? AND e.active = 1 ORDER BY val`;
        }
        else {
            const map = {
                'descricao': 'descricao',
                'data_prevista_recebimento': 'data_prevista_recebimento',
                'data_fato': 'data_fato',
                'valor': 'valor'
            };
            const dbCol = map[field];

            if (dbCol) {
                query = `SELECT DISTINCT ${dbCol} as val FROM entradas e WHERE e.project_id = ? AND e.active = 1 ORDER BY val DESC`;
            } else {
                return res.json([]);
            }
        }

        const [rows] = await db.query(query, params);
        res.json(rows.map(r => r.val).filter(v => v !== null && v !== ''));

    } catch (error) {
        next(error);
    }
};

// Get all installments in a group
exports.getInstallmentGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { currentId } = req.query;

        const [installments] = await db.query(
            `SELECT id, installment_number, installment_total, descricao, data_prevista_recebimento, valor 
             FROM entradas 
             WHERE installment_group_id = ? AND active = 1 
             ORDER BY installment_number`,
            [groupId]
        );

        if (installments.length === 0) {
            return res.status(404).json({ error: 'Grupo de parcelas não encontrado' });
        }

        const currentIndex = installments.findIndex(i => i.id.toString() === currentId);

        res.json({
            installments,
            currentIndex: currentIndex >= 0 ? currentIndex : 0,
            totalCount: installments.length
        });
    } catch (error) {
        next(error);
    }
};

// Batch update incomes based on scope
exports.batchUpdateIncome = async (req, res, next) => {
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
            'SELECT installment_group_id, installment_number, installment_total, installment_interval, installment_custom_days, project_id FROM entradas WHERE id = ?',
            [id]
        );

        if (!current.length) {
            throw new AppError('RES-001', 'Registro não encontrado');
        }

        const currentData = current[0];

        // For scope 'single', just update the current record normally
        if (scope === 'single') {
            // Use the existing updateIncome logic - reuse code
            const updateResult = await executeSingleUpdate(connection, id, updateData, currentData.project_id);
            await connection.commit();
            return res.json({ success: true, message: 'Registro atualizado com sucesso', updated: 1 });
        }

        // For 'all' and 'future', we need to fetch all relevant installments
        let baseInstallmentNumber;
        let installmentsToUpdate;

        if (scope === 'all' && currentData.installment_group_id) {
            // Start from installment #1
            baseInstallmentNumber = 1;
            const [allInstallments] = await connection.query(
                'SELECT id, installment_number FROM entradas WHERE installment_group_id = ? AND active = 1 ORDER BY installment_number ASC',
                [currentData.installment_group_id]
            );
            installmentsToUpdate = allInstallments;
        } else if (scope === 'future' && currentData.installment_group_id) {
            // Start from current installment
            baseInstallmentNumber = currentData.installment_number;
            const [futureInstallments] = await connection.query(
                'SELECT id, installment_number FROM entradas WHERE installment_group_id = ? AND installment_number >= ? AND active = 1 ORDER BY installment_number ASC',
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
        const isReplicar = true; // Always replicate logic for groups unless explicitly 'dividir' (which is not stored as interval) -> actually interval null meant single before? 
        // If interval is null in DB but it IS a group, we assume standard monthly replication if not specified.
        // But wait, if type was 'dividir', interval might be null? 
        // In createIncome, 'dividir' sets interval to NULL?
        // createIncome: count > 1 ? interval : null. 
        // If type is 'dividir', interval (installmentInterval default 'mensal') is passed?
        // Let's check createIncome again. 
        // const interval = installmentInterval || 'mensal';
        // VALUES (..., count > 1 ? interval : null, ...)
        // So 'dividir' saves the interval too!
        // So if interval is null, it's definitely an error or old data. 'mensal' is safe default.

        let updatedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Calculate base dates for the base installment (first for 'all', current for 'future')
        // IMPORTANT: If user edits installment #7 and changes date, we need to calculate what installment #1 would be
        // by subtracting the intervals backwards
        let baseDataFato = updateData.dataFato;
        let baseDataPrevista = updateData.dataPrevistaRecebimento;

        // If we have dates to update and this is a group operation, calculate the base date
        if ((scope === 'all' || scope === 'future') && interval) {
            // Calculate how many intervals to subtract to get to base installment
            const intervalsToSubtract = currentData.installment_number - baseInstallmentNumber;

            // Calculate base date by going backwards from the provided date
            if (baseDataFato && intervalsToSubtract > 0) {
                const providedDate = parseLocalDate(baseDataFato);
                let calculatedBaseDate = new Date(providedDate);

                switch (interval) {
                    case 'semanal':
                        calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (7 * intervalsToSubtract));
                        break;
                    case 'quinzenal':
                        calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (15 * intervalsToSubtract));
                        break;
                    case 'mensal':
                        calculatedBaseDate = addMonths(calculatedBaseDate, -intervalsToSubtract);
                        break;
                    case 'trimestral':
                        calculatedBaseDate = addMonths(calculatedBaseDate, -(3 * intervalsToSubtract));
                        break;
                    case 'semestral':
                        calculatedBaseDate = addMonths(calculatedBaseDate, -(6 * intervalsToSubtract));
                        break;
                    case 'anual':
                        calculatedBaseDate = addMonths(calculatedBaseDate, -(12 * intervalsToSubtract));
                        break;
                    case 'personalizado':
                        if (customDays) {
                            calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (parseInt(customDays) * intervalsToSubtract));
                        }
                        break;
                }

                const year = calculatedBaseDate.getFullYear();
                const month = String(calculatedBaseDate.getMonth() + 1).padStart(2, '0');
                const day = String(calculatedBaseDate.getDate()).padStart(2, '0');
                baseDataFato = `${year}-${month}-${day}`;
            }

            // Same for data_prevista
            if (baseDataPrevista && intervalsToSubtract > 0) {
                const providedDate = parseLocalDate(baseDataPrevista);
                let calculatedBaseDate = new Date(providedDate);

                switch (interval) {
                    case 'semanal':
                        calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (7 * intervalsToSubtract));
                        break;
                    case 'quinzenal':
                        calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (15 * intervalsToSubtract));
                        break;
                    case 'mensal':
                        calculatedBaseDate.setMonth(calculatedBaseDate.getMonth() - intervalsToSubtract);
                        break;
                    case 'trimestral':
                        calculatedBaseDate.setMonth(calculatedBaseDate.getMonth() - (3 * intervalsToSubtract));
                        break;
                    case 'semestral':
                        calculatedBaseDate.setMonth(calculatedBaseDate.getMonth() - (6 * intervalsToSubtract));
                        break;
                    case 'anual':
                        calculatedBaseDate.setFullYear(calculatedBaseDate.getFullYear() - intervalsToSubtract);
                        break;
                    case 'personalizado':
                        if (customDays) {
                            calculatedBaseDate.setDate(calculatedBaseDate.getDate() - (parseInt(customDays) * intervalsToSubtract));
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

                // Calculate offset from base
                const offsetFromBase = installmentNum - baseInstallmentNumber;

                // Get old data for balance calculation
                const [oldIncome] = await connection.query(
                    'SELECT valor, account_id, data_real_recebimento, data_fato, data_prevista_recebimento FROM entradas WHERE id = ?',
                    [installmentId]
                );

                if (!oldIncome.length) continue;
                const oldData = oldIncome[0];

                // Validate dataRealRecebimento if provided AND changed
                let shouldUpdateRealDate = false;
                if (updateData.dataRealRecebimento !== undefined) {
                    const newDate = updateData.dataRealRecebimento ? updateData.dataRealRecebimento.split('T')[0] : null;
                    const oldDate = oldData.data_real_recebimento ? new Date(oldData.data_real_recebimento).toISOString().split('T')[0] : null;

                    if (newDate !== oldDate) {
                        shouldUpdateRealDate = true;
                        // Only validate if we are actually CHANGING the date (or setting it for the first time)
                        // If it's already set and we are changing it, we must validate.
                        // If it's null and we are setting it, we must validate.

                        if (newDate) { // validates only if setting a date (clearing is usually allowed? actually clearing might be restricted too depending on rules, but typically "lock" prevents changing INTO or OUT OF lock period. Let's validate the NEW date. The old date lock check is implicitly: if I can't touch the record, I shouldn't be here? No, user wants to edit OTHER fields.)
                            const validation = await validateDateWithinRange(
                                updateData.dataRealRecebimento, currentData.project_id
                            , req.user.role);

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

                // Calculate dates for this installment
                if (baseDataFato !== undefined) {
                    let finalDataFato;

                    if (offsetFromBase === 0) {
                        // Base installment: use the value directly
                        finalDataFato = baseDataFato;
                    } else if (isReplicar) {
                        // Replicated: calculate offset from base date
                        const allDates = calculateDates(baseDataFato, offsetFromBase + 1, interval, customDays);
                        finalDataFato = allDates[offsetFromBase];
                    } else {
                        // Dividir (parcelado): data_fato stays same
                        finalDataFato = baseDataFato;
                    }

                    updates.push('data_fato = ?');
                    values.push(finalDataFato);
                }

                if (baseDataPrevista !== undefined) {
                    let finalDataPrevista;

                    if (offsetFromBase === 0) {
                        // Base installment: use the value directly
                        finalDataPrevista = baseDataPrevista;
                    } else {
                        // All installments: data_prevista advances with interval
                        const allDates = calculateDates(baseDataPrevista, offsetFromBase + 1, interval, customDays);
                        finalDataPrevista = allDates[offsetFromBase];
                    }

                    updates.push('data_prevista_recebimento = ?');
                    values.push(finalDataPrevista);
                }

                if (shouldUpdateRealDate) {
                    updates.push('data_real_recebimento = ?');
                    values.push(updateData.dataRealRecebimento || null);
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
                if (updateData.tipoEntradaId !== undefined) {
                    updates.push('tipo_entrada_id = ?');
                    values.push(updateData.tipoEntradaId);
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

                if (updateData.comprovanteUrl !== undefined) {
                    updates.push('comprovante_url = ?');
                    values.push(updateData.comprovanteUrl);
                }
                if (updateData.formaPagamento !== undefined) {
                    updates.push('forma_pagamento = ?');
                    values.push(updateData.formaPagamento || null);
                }

                if (updates.length > 0) {
                    values.push(installmentId);
                    await connection.query(
                        `UPDATE entradas SET ${updates.join(', ')} WHERE id = ?`,
                        values
                    );

                    // Update balances if needed
                    if (oldData.account_id && oldData.data_real_recebimento) {
                        await connection.query(
                            'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                            [oldData.valor, oldData.account_id]
                        );
                    }

                    if (newAccountId && (updateData.dataRealRecebimento || oldData.data_real_recebimento)) {
                        await connection.query(
                            'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
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

// Helper function for single update
async function executeSingleUpdate(connection, id, updateData, projectId) {
    const [oldIncome] = await connection.query(
        'SELECT valor, account_id, data_real_recebimento FROM entradas WHERE id = ?',
        [id]
    );

    if (!oldIncome.length) {
        throw new AppError('RES-001', 'Registro não encontrado');
    }

    const oldData = oldIncome[0];

    // Validate dataRealRecebimento if provided AND changed
    let shouldUpdateRealDate = false;
    if (updateData.dataRealRecebimento !== undefined) {
        const newDate = updateData.dataRealRecebimento ? updateData.dataRealRecebimento.split('T')[0] : null;
        const oldDate = oldData.data_real_recebimento ? new Date(oldData.data_real_recebimento).toISOString().split('T')[0] : null;

        if (newDate !== oldDate) {
            shouldUpdateRealDate = true;
            if (newDate) {
                const validation = await validateDateWithinRange(updateData.dataRealRecebimento, projectId, req.user.role);
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
    if (updateData.dataPrevistaRecebimento !== undefined) {
        updates.push('data_prevista_recebimento = ?');
        values.push(updateData.dataPrevistaRecebimento);
    }
    if (shouldUpdateRealDate) {
        updates.push('data_real_recebimento = ?');
        values.push(updateData.dataRealRecebimento || null);
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
    if (updateData.tipoEntradaId !== undefined) {
        updates.push('tipo_entrada_id = ?');
        values.push(updateData.tipoEntradaId);
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

    if (updateData.comprovanteUrl !== undefined) {
        updates.push('comprovante_url = ?');
        values.push(updateData.comprovanteUrl);
    }
    if (updateData.formaPagamento !== undefined) {
        updates.push('forma_pagamento = ?');
        values.push(updateData.formaPagamento || null);
    }

    if (updates.length > 0) {
        values.push(id);
        await connection.query(
            `UPDATE entradas SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        // Update balances
        if (oldData.account_id && oldData.data_real_recebimento) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                [oldData.valor, oldData.account_id]
            );
        }

        if (newAccountId && (updateData.dataRealRecebimento || oldData.data_real_recebimento)) {
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [newValor, newAccountId]
            );
        }
    }

    return true;
}

// Batch delete incomes based on scope
exports.batchDeleteIncome = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const { scope } = req.body;

        if (!['single', 'all', 'future'].includes(scope)) {
            throw new AppError('VAL-002', 'Escopo inválido. Use: single, all ou future');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get the current record's installment info
        const [current] = await connection.query(
            'SELECT installment_group_id, installment_number FROM entradas WHERE id = ? AND active = 1',
            [id]
        );

        if (!current.length) {
            throw new AppError('RES-001', 'Registro não encontrado');
        }

        const currentData = current[0];
        let idsToDelete = [id];

        // Determine which IDs to delete based on scope
        if (scope === 'all' && currentData.installment_group_id) {
            const [allInstallments] = await connection.query(
                'SELECT id FROM entradas WHERE installment_group_id = ? AND active = 1',
                [currentData.installment_group_id]
            );
            idsToDelete = allInstallments.map(i => i.id);
        } else if (scope === 'future' && currentData.installment_group_id) {
            const [futureInstallments] = await connection.query(
                'SELECT id FROM entradas WHERE installment_group_id = ? AND installment_number >= ? AND active = 1',
                [currentData.installment_group_id, currentData.installment_number]
            );
            idsToDelete = futureInstallments.map(i => i.id);
        }

        let deletedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Delete each record
        for (const deleteId of idsToDelete) {
            try {
                // Get income details for balance adjustment
                const [income] = await connection.query(
                    'SELECT valor, account_id, data_real_recebimento FROM entradas WHERE id = ? AND active = 1',
                    [deleteId]
                );

                if (income.length === 0) continue;

                // Soft delete
                await connection.query('UPDATE entradas SET active = 0 WHERE id = ?', [deleteId]);

                // Decrease account balance only if it was already received
                if (income[0].account_id && income[0].data_real_recebimento) {
                    await connection.query(
                        'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                        [income[0].valor, income[0].account_id]
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
        logAudit(req, 'DELETE', 'entradas', id, { scope, deletedCount });

        res.json({
            success: true,
            message: `${deletedCount} registro(s) excluído(s)`,
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

// Bulk Delete - Delete a list of arbitrary IDs
exports.bulkDeleteIncomes = async (req, res, next) => {
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
                // Get COMPLETE income record for audit log (for UNDO capability)
                const [income] = await connection.query(
                    'SELECT * FROM entradas WHERE id = ? AND active = 1',
                    [deleteId]
                );

                if (income.length === 0) {
                    skippedCount++;
                    continue;
                }

                const incomeRecord = income[0];

                // Soft delete
                await connection.query('UPDATE entradas SET active = 0 WHERE id = ?', [deleteId]);

                // Log individual deletion with complete old_data for UNDO
                await logAudit(req, 'DELETE', 'entradas', deleteId,
                    {
                        deletedAmount: incomeRecord.valor,
                        scope: 'bulk_delete'
                    },
                    incomeRecord,  // old_data (complete record for restoration)
                    null           // new_data (null for deletes)
                );

                // Decrease account balance only if it was already received
                if (incomeRecord.account_id && incomeRecord.data_real_recebimento) {
                    await connection.query(
                        'UPDATE contas SET current_balance = current_balance - ? WHERE id = ?',
                        [incomeRecord.valor, incomeRecord.account_id]
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
        // Note: Individual logs already created in loop above

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




