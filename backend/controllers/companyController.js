const db = require('../config/database');
const AppError = require('../utils/AppError');

exports.listCompanies = async (req, res, next) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID is required');
        }

        const [companies] = await db.query(
            'SELECT * FROM empresas WHERE project_id = ? ORDER BY name',
            [projectId]
        );
        res.json(companies);
    } catch (error) {
        next(error);
    }
};

exports.createCompany = async (req, res, next) => {
    try {
        const { name, cnpj, description, projectId } = req.body;

        if (!name || !cnpj || !projectId) {
            throw new AppError('VAL-002', 'Name, CNPJ and Project ID are required');
        }

        // Validate CNPJ format (basic validation)
        const cnpjClean = cnpj.replace(/[^\d]/g, '');
        if (cnpjClean.length !== 14) {
            throw new AppError('VAL-005');
        }

        // Check if CNPJ already exists
        const [existing] = await db.query(
            'SELECT id FROM empresas WHERE cnpj = ?',
            [cnpj]
        );

        if (existing.length > 0) {
            throw new AppError('RES-002', 'CNPJ already registered');
        }

        const [result] = await db.query(
            'INSERT INTO empresas (name, cnpj, description, project_id) VALUES (?, ?, ?, ?)',
            [name, cnpj, description, projectId]
        );

        res.status(201).json({
            id: result.insertId,
            name,
            cnpj,
            description,
            active: 1,
            project_id: projectId
        });
    } catch (error) {
        next(error);
    }
};

exports.updateCompany = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, cnpj, description, active } = req.body;

        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (cnpj !== undefined) {
            // Validate CNPJ format
            const cnpjClean = cnpj.replace(/[^\d]/g, '');
            if (cnpjClean.length !== 14) {
                throw new AppError('VAL-005');
            }

            // Check if CNPJ already exists for another company
            const [existing] = await db.query(
                'SELECT id FROM empresas WHERE cnpj = ? AND id != ?',
                [cnpj, id]
            );

            if (existing.length > 0) {
                throw new AppError('RES-002', 'CNPJ already registered');
            }

            updates.push('cnpj = ?');
            values.push(cnpj);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (active !== undefined) {
            updates.push('active = ?');
            values.push(active);
        }

        if (updates.length > 0) {
            values.push(id);
            await db.query(
                `UPDATE empresas SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        res.json({ message: 'Company updated successfully' });
    } catch (error) {
        next(error);
    }
};

exports.deleteCompany = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if company has associated accounts
        const [accounts] = await db.query(
            'SELECT COUNT(*) as count FROM contas WHERE company_id = ?',
            [id]
        );

        // Check if company has associated incomes
        const [incomes] = await db.query(
            'SELECT COUNT(*) as count FROM entradas WHERE company_id = ?',
            [id]
        );

        // Check if company has associated expenses
        const [expenses] = await db.query(
            'SELECT COUNT(*) as count FROM despesas WHERE company_id = ?',
            [id]
        );

        const totalDependencies = accounts[0].count + incomes[0].count + expenses[0].count;

        if (totalDependencies > 0) {
            // Return specific error for frontend to handle inactivation prompt
            return res.status(409).json({
                error: {
                    code: 'DEPENDENCY_EXISTS',
                    message: `Cannot delete company. Found ${accounts[0].count} accounts, ${incomes[0].count} incomes, and ${expenses[0].count} expenses linked.`,
                    counts: {
                        accounts: accounts[0].count,
                        incomes: incomes[0].count,
                        expenses: expenses[0].count
                    }
                }
            });
        }

        await db.query('DELETE FROM empresas WHERE id = ?', [id]);
        res.json({ message: 'Company deleted successfully' });
    } catch (error) {
        next(error);
    }
};
