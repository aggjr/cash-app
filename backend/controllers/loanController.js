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

// Helper to get or create a category
const getOrCreateType = async (connection, tableName, projectId, label) => {
    try {
        // 1. Check existing
        const [rows] = await connection.query(
            `SELECT id FROM ${tableName} WHERE project_id = ? AND label = ? AND active = 1 LIMIT 1`,
            [projectId, label]
        );
        if (rows.length > 0) return rows[0].id;

        // 2. If not found, create as root node
        const [res] = await connection.query(
            `INSERT INTO ${tableName} (project_id, label, parent_id, active) VALUES (?, ?, NULL, 1)`,
            [projectId, label]
        );
        return res.insertId;
    } catch (e) {
        console.error(`Error in getOrCreateType for ${label}:`, e);
        return null; // Fail safe
    }
};

// Helper to find best category for fees using smart inference
const findBestCategoryForFees = async (connection, projectId) => {
    try {
        // 1. Get all active expense types
        const [types] = await connection.query(
            "SELECT id, label, parent_id FROM tipo_saida WHERE project_id = ? AND active = 1",
            [projectId]
        );

        // Keywords to search for
        const parentKeywords = ['financeir', 'bancari', 'adm'];
        const childKeywords = ['taxa', 'tarifa', 'iof', 'juros', 'despesa'];

        let bestParentId = null;
        let bestChildId = null;

        // Helper to normalize string for comparison
        const norm = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // 2. Search for existing structure
        for (const type of types) {
            const label = norm(type.label);

            // Check if this is a potential parent
            if (!type.parent_id && parentKeywords.some(k => label.includes(k))) {
                bestParentId = type.id;
            }

            // Check if this is a potential child
            if (type.parent_id && childKeywords.some(k => label.includes(k))) {
                // Check if its parent is also relevant? Ideally yes, but let's be flexible via parent check later or just grab first match
                bestChildId = type.id;
                // If we found a child that looks like "Taxas" or "Tarifas", we might be good.
                // Let's check if its parent is "Financeira" to be sure.
                const parent = types.find(p => p.id === type.parent_id);
                if (parent && parentKeywords.some(k => norm(parent.label).includes(k))) {
                    return bestChildId; // Perfect match found: Financeira -> Taxas
                }
            }
        }

        // 3. Logic to Create if missing

        // Scenario A: Found a good child (Taxas) but parent wasn't perfect match? 
        // If we found a bestChildId previously (even if parent wasn't strict "Financeira"), let's use it to avoid proliferation.
        if (bestChildId) return bestChildId;

        // Scenario B: Found a parent (Financeira) but no child (Taxas)
        if (bestParentId) {
            // Create "Tarifas Bancárias" under this parent
            const [res] = await connection.query(
                "INSERT INTO tipo_saida (project_id, label, parent_id, active) VALUES (?, ?, ?, 1)",
                [projectId, 'Tarifas Bancárias', bestParentId]
            );
            return res.insertId;
        }

        // Scenario C: Found nothing. Create entire structure "Despesas Financeiras" -> "Tarifas Bancárias"
        // First check if "Despesas" generic root exists to put "Financeiras" under, or just make "Financeiras" root?
        // Usually "Despesas" is root. Let's look for a generic "Despesas" root.
        const genericRoot = types.find(t => !t.parent_id && norm(t.label).includes('despesa'));
        let rootId = genericRoot ? genericRoot.id : null;

        if (!rootId) {
            // Create Root "Despesas"
            const [res] = await connection.query(
                "INSERT INTO tipo_saida (project_id, label, parent_id, active) VALUES (?, ?, NULL, 1)",
                [projectId, 'Despesas']
            );
            rootId = res.insertId;
        }

        // Create "Financeiras" under Root
        const [resFin] = await connection.query(
            "INSERT INTO tipo_saida (project_id, label, parent_id, active) VALUES (?, ?, ?, 1)",
            [projectId, 'Financeiras', rootId]
        );
        const financeirasId = resFin.insertId;

        // Create "Tarifas" under Financeiras
        const [resTax] = await connection.query(
            "INSERT INTO tipo_saida (project_id, label, parent_id, active) VALUES (?, ?, ?, 1)",
            [projectId, 'Tarifas Bancárias', financeirasId]
        );

        return resTax.insertId;

    } catch (e) {
        console.error('Error in findBestCategoryForFees:', e);
        // Fallback: Just return any valid ID or create a basic one at root to prevent crash
        return await getOrCreateType(connection, 'tipo_saida', projectId, 'Taxas Empréstimo');
    }
};

exports.createLoan = async (req, res, next) => {
    let connection;
    try {
        const {
            projectId,
            companyId, // Lender
            accountId, // Where money enters / payments leave
            description,
            nominalValue, // Valor Contrato (Bruto)
            netValue,     // Valor Líquido (Recebido)
            totalValue,   // Valor total a pagar 
            interestRate,
            contractDate, // Data da contratação
            installments, // Number of installments
            firstDueDate,
            registerEntry, // Boolean: Creates the cash inflow record
            feeCategoryId, // Explicit ID from EVA
            interestCategoryId // Explicit ID from EVA
        } = req.body;

        // Fallback for compatibility if frontend sends old keys (though we will fix frontend too)
        const principal = nominalValue || req.body.principalValue;
        const net = netValue || principal; // If no fees, net = principal

        if (!projectId || !companyId || !description || !principal || !totalValue || !installments || !contractDate || !firstDueDate) {
            throw new AppError('VAL-002', 'Campos obrigatórios faltando');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Create Loan Record (Use Nominal/Principal Value as the Debt)
        const [loanResult] = await connection.query(
            `INSERT INTO loans 
            (project_id, company_id, description, principal_value, total_value, interest_rate, contract_date, number_of_installments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [projectId, companyId, description, principal, totalValue, interestRate, contractDate, installments]
        );
        const loanId = loanResult.insertId;

        // 2. Resolve Types
        const tipoEntradaId = await getOrCreateType(connection, 'tipo_entrada', projectId, 'EMPRÉSTIMOS');

        // INTEREST CATEGORY
        let tipoSaidaPagamentoId;
        if (interestCategoryId) {
            tipoSaidaPagamentoId = interestCategoryId; // Use user selected
        } else {
            // Default Inference
            tipoSaidaPagamentoId = await getOrCreateType(connection, 'tipo_saida', projectId, 'Pagamento Empréstimo');
        }

        // 3. Handle Cash Flow (Entrada + Fees)
        if (registerEntry && accountId) {

            // A. Register GROSS Inflow (O valor que "deveria" entrar pelo contrato)
            await connection.query(
                `INSERT INTO entradas 
                (project_id, company_id, account_id, descricao, valor, data_fato, data_real_recebimento, active, loan_id, tipo_entrada_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                [projectId, companyId, accountId, `Empréstimo: ${description}`, principal, contractDate, contractDate, loanId, tipoEntradaId]
            );

            // B. Calculate Fees (Diferença entre Nominal e Líquido)
            const feeAmount = parseFloat((principal - net).toFixed(2));

            if (feeAmount > 0) {
                // Find category for fees
                let tipoSaidaTaxasId;
                if (feeCategoryId) {
                    tipoSaidaTaxasId = feeCategoryId; // Use from EVA
                } else {
                    tipoSaidaTaxasId = await findBestCategoryForFees(connection, projectId);
                }

                // Register Fee Expense (Paid immediately)
                await connection.query(
                    `INSERT INTO saidas 
                    (project_id, company_id, account_id, descricao, valor, data_fato, data_prevista_pagamento, data_real_pagamento, active, loan_id, tipo_saida_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                    [projectId, companyId, accountId, `Taxas/IOF Empréstimo: ${description}`, feeAmount, contractDate, contractDate, contractDate, loanId, tipoSaidaTaxasId]
                );

                // Update Balance: +Principal -Fee = +Net
                // Simply update logic:
                // Balance += Principal
                // Balance -= Fee
                await connection.query(
                    'UPDATE contas SET current_balance = current_balance + ? - ? WHERE id = ?',
                    [principal, feeAmount, accountId]
                );

            } else {
                // Update Balance just with Principal (Net = Principal)
                await connection.query(
                    'UPDATE contas SET current_balance = current_balance + ? WHERE id = ?',
                    [principal, accountId]
                );
            }
        }

        // 4. Create Saidas (Installments) for Repayment
        const baseVal = Math.floor((totalValue / installments) * 100) / 100;
        const remainder = totalValue - (baseVal * installments);

        const dates = calculateDates(firstDueDate, parseInt(installments), 'mensal');
        const groupId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        for (let i = 0; i < installments; i++) {
            let val = baseVal;
            if (i === installments - 1) {
                val += remainder;
                val = parseFloat(val.toFixed(2));
            }

            const descriptionText = `${description} - Parcela ${i + 1}/${installments}`;

            await connection.query(
                `INSERT INTO saidas 
                (project_id, company_id, account_id, descricao, valor, data_fato, data_prevista_pagamento, active, loan_id, installment_group_id, installment_number, installment_total, tipo_saida_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
                [projectId, companyId, accountId, descriptionText, val, contractDate, dates[i], loanId, groupId, i + 1, installments, tipoSaidaPagamentoId]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Empréstimo contratado com sucesso', loanId });
        logAudit(req, 'CREATE', 'loans', loanId, { description, principal, net, totalValue });

    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.listInstallments = async (req, res, next) => {
    try {
        console.log('[DEBUG] listInstallments query params:', req.query);
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

exports.suggestCategory = async (req, res, next) => {
    let connection;
    try {
        const { projectId, type } = req.query; // type: 'fees' or 'interest'
        if (!projectId) throw new AppError('VAL-002', 'Project ID required');

        connection = await db.getConnection();

        let suggestedId;
        let suggestedName = "Despesas Financeiras"; // Default

        if (type === 'fees') {
            suggestedId = await findBestCategoryForFees(connection, projectId);
            // Fetch name for display
            const [rows] = await connection.query("SELECT label FROM tipo_saida WHERE id = ?", [suggestedId]);
            if (rows.length > 0) suggestedName = rows[0].label;
        } else {
            // Logic for Interest (Juros)
            // Similar to Fees but targeting 'Juros'
            // Simple implementation for now:
            suggestedId = await getOrCreateType(connection, 'tipo_saida', projectId, 'Juros Empréstimo');
            const [rows] = await connection.query("SELECT label FROM tipo_saida WHERE id = ?", [suggestedId]);
            if (rows.length > 0) suggestedName = rows[0].label;
        }

        res.json({ id: suggestedId, name: suggestedName });

    } catch (error) {
        next(error);
    } finally {
        if (connection) connection.release();
    }
};
