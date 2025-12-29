const db = require('../config/database');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/auditLogger');
const { calculateInstallments, calculateDates } = require('../utils/financialCalculations');

// Reuse sort logic from saidaController or similar
const getOrderByClause = (sortBy, order) => {
    const dir = order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    switch (sortBy) {
        case 'valor': return `s.valor ${dir}`;
        case 'data_prevista_pagamento': return `s.data_prevista_pagamento ${dir}`;
        case 'data_real_pagamento': return `s.data_real_pagamento ${dir}`;
        case 'descricao': return `s.descricao ${dir}`;
        case 'company_name': return `emp.name ${dir}`;
        default: return `s.data_prevista_pagamento ASC`;
    }
};

exports.createLoan = async (req, res, next) => {
    let connection;
    try {
        const {
            projectId,
            companyId, // Lender
            accountId, // Where money enters / payments leave (simplification)
            description,
            principalValue, // Valor captado
            totalValue, // Valor total a pagar provided by user
            interestRate,
            contractDate, // Data da contratação (e entrada do dinheiro)
            installments, // Number of installments
            firstDueDate,
            registerEntry // Boolean: Creates the cash inflow record
        } = req.body;

        if (!projectId || !companyId || !description || !principalValue || !totalValue || !installments || !contractDate || !firstDueDate) {
            throw new AppError('VAL-002', 'Campos obrigatórios faltando (Descrição, Fornecedor, Valores, Parcelas, Datas)');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Create Loan Record
        const [loanResult] = await connection.query(
            `INSERT INTO loans 
            (project_id, company_id, description, principal_value, total_value, interest_rate, contract_date, number_of_installments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [projectId, companyId, description, principalValue, totalValue, interestRate, contractDate, installments]
        );
        const loanId = loanResult.insertId;

        // 2. Create Entrada (Cash Inflow) - Optional
        if (registerEntry && accountId) {
            // Check/Create "Empréstimos" Tipo Entrada? For now leave null or generic.
            await connection.query(
                `INSERT INTO entradas 
                (project_id, company_id, account_id, description, valor, data_fato, data_real_recebimento, active, loan_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                [projectId, companyId, accountId, `Empréstimo: ${description}`, principalValue, contractDate, contractDate, loanId]
            );

            // Update Account Balance (Inflow)
            await connection.query(
                'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                [principalValue, accountId]
            );
        }

        // 3. Create Saidas (Installments)
        // Using totalValue for the sum of installments
        const installmentVal = totalValue / installments;
        // Note: Simple division. Rounding issues might occur.
        // Better: calculateInstallments util (if it handles rounding) or distributing remainder.
        // I'll assume calculateInstallments handles it or I do a manual distribution.

        // Let's use robust manual distribution to ensure sum == totalValue
        const baseVal = Math.floor((totalValue / installments) * 100) / 100;
        const remainder = totalValue - (baseVal * installments);

        // Dates
        const dates = calculateDates(firstDueDate, parseInt(installments), 'mensal');

        const groupId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        for (let i = 0; i < installments; i++) {
            let val = baseVal;
            if (i === installments - 1) {
                val += remainder; // Add remainder to last installment
                val = parseFloat(val.toFixed(2));
            }

            const desc = `${description} - Parcela ${i + 1}/${installments}`;

            await connection.query(
                `INSERT INTO saidas 
                (project_id, company_id, account_id, description, valor, data_fato, data_prevista_pagamento, active, loan_id, installment_group_id, installment_number, installment_total)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
                [projectId, companyId, accountId, desc, val, contractDate, dates[i], loanId, groupId, i + 1, installments]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Empréstimo contratado com sucesso', loanId });
        logAudit(req, 'CREATE', 'loans', loanId, { description, principalValue, totalValue });

    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.listInstallments = async (req, res, next) => {
    try {
        const { projectId, page = 1, limit = 50, search, sortBy, order } = req.query;

        if (!projectId) throw new AppError('VAL-002', 'Project ID required');

        const offset = (page - 1) * limit;
        const params = [projectId];
        let where = 's.project_id = ? AND s.active = 1 AND s.loan_id IS NOT NULL';

        // --- FILTERS (Similar to SaidaController) ---
        if (search) {
            where += ' AND (s.descricao LIKE ? OR emp.name LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term);
        }

        // Date Filters (Prevista)
        if (req.query.data_prevista_pagamentoStart) {
            where += ' AND s.data_prevista_pagamento >= ?';
            params.push(req.query.data_prevista_pagamentoStart);
        }
        if (req.query.data_prevista_pagamentoEnd) {
            where += ' AND s.data_prevista_pagamento <= ?';
            params.push(req.query.data_prevista_pagamentoEnd);
        }

        // Status Filter (Pending/Paid/Overdue) handles in frontend via data_real check?
        // Or specific filter.

        // Count
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total 
             FROM saidas s 
             LEFT JOIN empresas emp ON s.company_id = emp.id
             WHERE ${where}`,
            params
        );
        const total = countResult[0].total;

        // Data
        const itemsQuery = `
            SELECT 
                s.*,
                emp.name as company_name,
                c.name as account_name,
                l.description as loan_description,
                l.principal_value as loan_principal
            FROM saidas s
            LEFT JOIN empresas emp ON s.company_id = emp.id
            LEFT JOIN contas c ON s.account_id = c.id
            LEFT JOIN loans l ON s.loan_id = l.id
            WHERE ${where}
            ORDER BY ${getOrderByClause(sortBy, order)}
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(itemsQuery, [...params, parseInt(limit), parseInt(offset)]);

        res.json({
            data: rows,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        next(error);
    }
};
