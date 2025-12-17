const db = require('../config/database');
const AppError = require('../utils/AppError');

exports.list = async (req, res, next) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            throw new AppError('VAL-002', 'Project ID required');
        }

        const [items] = await db.query(
            'SELECT * FROM centros_custo WHERE project_id = ? ORDER BY created_at DESC',
            [projectId]
        );

        res.json(items);
    } catch (error) {
        next(error);
    }
};

exports.create = async (req, res, next) => {
    let connection;
    try {
        const { name, description, projectId } = req.body;

        if (!name || !projectId) {
            throw new AppError('VAL-002', 'Name and Project ID are required');
        }

        connection = await db.getConnection();
        const [result] = await connection.query(
            'INSERT INTO centros_custo (name, description, project_id) VALUES (?, ?, ?)',
            [name, description, projectId]
        );

        res.status(201).json({
            id: result.insertId,
            name,
            description,
            project_id: projectId,
            active: 1,
            created_at: new Date()
        });
    } catch (error) {
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.update = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        const { name, description, active } = req.body;

        connection = await db.getConnection();

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

        if (updates.length > 0) {
            values.push(id);
            await connection.query(
                `UPDATE centros_custo SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        res.json({ message: 'Updated successfully' });
    } catch (error) {
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.delete = async (req, res, next) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await db.getConnection();

        // Check usage
        const [entradas] = await connection.query('SELECT COUNT(*) as count FROM entradas WHERE centro_custo_id = ?', [id]);
        const [saidas] = await connection.query('SELECT COUNT(*) as count FROM saidas WHERE centro_custo_id = ?', [id]);
        const [producao] = await connection.query('SELECT COUNT(*) as count FROM producao_revenda WHERE centro_custo_id = ?', [id]);

        const totalUsage = entradas[0].count + saidas[0].count + producao[0].count;

        if (totalUsage > 0) {
            // Soft delete
            await connection.query('UPDATE centros_custo SET active = 0 WHERE id = ?', [id]);
            res.json({ type: 'soft', message: 'Item inativado pois possui vínculos.' });
        } else {
            // Hard delete
            await connection.query('DELETE FROM centros_custo WHERE id = ?', [id]);
            res.json({ type: 'hard', message: 'Item excluído permanentemente.' });
        }
    } catch (error) {
        next(error);
    } finally {
        if (connection) connection.release();
    }
};
