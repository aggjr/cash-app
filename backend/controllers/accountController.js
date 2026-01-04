const db = require('../config/database');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/auditLogger');

exports.listAccounts = async (req, res, next) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID is required');
        }

        const [accounts] = await db.query(
            `SELECT c.*, e.name as company_name, e.cnpj as company_cnpj 
             FROM contas c 
             LEFT JOIN empresas e ON c.company_id = e.id 
             WHERE c.project_id = ? 
             ORDER BY c.name`,
            [projectId]
        );
        res.json(accounts);
    } catch (error) {
        next(error);
    }
};

exports.createAccount = async (req, res, next) => {
    try {
        const { name, description, projectId, accountType, initialBalance, companyId } = req.body;

        if (!name || !projectId) {
            throw new AppError('VAL-002', 'Name and Project ID are required');
        }

        if (!companyId) {
            throw new AppError('VAL-002', 'Company ID is required');
        }

        const type = accountType || 'outros';
        const balance = parseFloat(initialBalance) || 0;

        const [result] = await db.auditedQuery(
            'INSERT INTO contas (name, description, account_type, initial_balance, current_balance, project_id, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, description, type, balance, balance, projectId, companyId],
            req  // ← User context for automatic audit
        );

        res.status(201).json({
            id: result.insertId,
            name,
            description,
            account_type: type,
            initial_balance: balance,
            current_balance: balance,
            active: 1,
            project_id: projectId,
            company_id: companyId
        });

        // Audit is automatic via auditedQuery
    } catch (error) {
        next(error);
    }
};

exports.updateAccount = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, active, accountType, initialBalance } = req.body;

        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (active !== undefined) {
            updates.push('active = ?');
            values.push(active);
        }
        if (accountType !== undefined) {
            updates.push('account_type = ?');
            values.push(accountType);
        }
        if (initialBalance !== undefined) {
            updates.push('initial_balance = ?');
            values.push(parseFloat(initialBalance));
        }

        if (updates.length > 0) {
            values.push(id);
            await db.auditedQuery(
                `UPDATE contas SET ${updates.join(', ')} WHERE id = ?`,
                values,
                req  // ← User context for automatic audit
            );
        }

        res.json({ message: 'Account updated successfully' });
        // Audit is automatic via auditedQuery
    } catch (error) {
        next(error);
    }
};

exports.deleteAccount = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Hard delete for now
        // TODO: Handle foreign key constraints errors gracefully (RES-003)
        try {
            await db.auditedQuery('DELETE FROM contas WHERE id = ?', [id], req);
            res.json({ message: 'Account deleted successfully' });
            // Audit is automatic via auditedQuery
        } catch (dbError) {
            if (dbError.code === 'ER_ROW_IS_REFERENCED_2') {
                throw new AppError('RES-003', 'Esta conta possui transações vinculadas.');
            }
            throw dbError; // Bubble up other errors
        }
    } catch (error) {
        next(error);
    }
};
