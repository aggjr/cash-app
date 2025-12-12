const db = require('../config/database');

// Whitelist of allowed tables for security
const ALLOWED_TABLES = ['tipo_entrada', 'tipo_saida', 'tipo_producao_revenda'];

// Validate table name
const validateTableName = (tableName) => {
    if (!ALLOWED_TABLES.includes(tableName)) {
        throw new Error('Invalid table name');
    }
    return tableName;
};

// Get all nodes from a table (filtered by project)
exports.getAll = async (req, res) => {
    try {
        const tableName = validateTableName(req.params.tableName);
        const projectId = req.query.projectId;

        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        const [rows] = await db.query(
            `SELECT * FROM ${tableName} WHERE project_id = ? ORDER BY parent_id, ordem`,
            [projectId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch data' });
    }
};

// Get tree structure (filtered by project)
// Note: Stored Procedures would need update, falling back to raw query for simplicity in this migration
exports.getTree = async (req, res) => {
    try {
        const tableName = validateTableName(req.params.tableName);
        const projectId = req.query.projectId;

        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        // Simple fetch for now, tree logic handled in frontend or we update SPs later
        const [rows] = await db.query(
            `SELECT * FROM ${tableName} WHERE project_id = ? ORDER BY parent_id, ordem`,
            [projectId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching tree:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch tree' });
    }
};

// Create new node
exports.create = async (req, res) => {
    try {
        const tableName = validateTableName(req.params.tableName);
        const { label, parent_id, ordem, expanded, projectId } = req.body;

        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        const [result] = await db.query(
            `INSERT INTO ${tableName} (label, parent_id, ordem, expanded, active, project_id) VALUES (?, ?, ?, ?, TRUE, ?)`,
            [label, parent_id || null, ordem || 0, expanded !== false, projectId]
        );

        const [newNode] = await db.query(
            `SELECT * FROM ${tableName} WHERE id = ?`,
            [result.insertId]
        );

        res.status(201).json(newNode[0]);
    } catch (error) {
        console.error('Error creating node:', error);
        res.status(500).json({ error: error.message || 'Failed to create node' });
    }
};

// Update node
exports.update = async (req, res) => {
    try {
        const tableName = validateTableName(req.params.tableName);
        const { id } = req.params;
        const { label, parent_id, ordem, expanded, active } = req.body;

        // Fetch current node to preserve values if not provided
        const [current] = await db.query(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
        if (current.length === 0) {
            return res.status(404).json({ error: 'Node not found' });
        }
        const node = current[0];

        await db.query(
            `UPDATE ${tableName} SET label = ?, parent_id = ?, ordem = ?, expanded = ?, active = ? WHERE id = ?`,
            [
                label !== undefined ? label : node.label,
                parent_id !== undefined ? parent_id : node.parent_id,
                ordem !== undefined ? ordem : node.ordem,
                expanded !== undefined ? expanded : node.expanded,
                active !== undefined ? active : node.active,
                id
            ]
        );

        const [updated] = await db.query(
            `SELECT * FROM ${tableName} WHERE id = ?`,
            [id]
        );

        res.json(updated[0]);
    } catch (error) {
        console.error('Error updating node:', error);
        res.status(500).json({ error: error.message || 'Failed to update node' });
    }
};

// Delete node (cascade deletes children) or Soft Delete if referenced
exports.delete = async (req, res) => {
    try {
        const tableName = validateTableName(req.params.tableName);
        const { id } = req.params;

        try {
            // Try hard delete first
            await db.query(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
            res.json({ message: 'Node deleted successfully', type: 'hard' });
        } catch (deleteError) {
            // Check for Foreign Key Constraint violation (Error 1451)
            if (deleteError.errno === 1451) {
                // Soft delete: Mark as inactive
                await db.query(`UPDATE ${tableName} SET active = FALSE WHERE id = ?`, [id]);
                res.json({ message: 'Node marked as inactive (referenced elsewhere)', type: 'soft' });
            } else {
                throw deleteError;
            }
        }
    } catch (error) {
        console.error('Error deleting node:', error);
        res.status(500).json({ error: error.message || 'Failed to delete node' });
    }
};

// Move node (change parent)
exports.move = async (req, res) => {
    try {
        const tableName = validateTableName(req.params.tableName);
        const { id } = req.params;
        const { parent_id, ordem } = req.body;

        // Note: Stored Procedure Move... might not handle project_id check, 
        // but since we select by ID it should be fine for now. 
        // Ideally we should verify project_id ownership here too.

        const procName = `Move${tableName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`;
        await db.query(`CALL ${procName}(?, ?, ?)`, [id, parent_id || null, ordem || 0]);

        const [updated] = await db.query(
            `SELECT * FROM ${tableName} WHERE id = ?`,
            [id]
        );

        res.json(updated[0]);
    } catch (error) {
        console.error('Error moving node:', error);
        res.status(500).json({ error: error.message || 'Failed to move node' });
    }
};
