const db = require('../config/database');

// Get all tipo_entrada nodes
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM tipo_entrada ORDER BY parent_id, ordem'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching tipo_entrada:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
};

// Get tree structure
exports.getTree = async (req, res) => {
    try {
        const [rows] = await db.query('CALL GetTipoEntradaTree()');
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching tree:', error);
        res.status(500).json({ error: 'Failed to fetch tree' });
    }
};

// Create new node
exports.create = async (req, res) => {
    try {
        const { label, parent_id, ordem, expanded } = req.body;

        const [result] = await db.query(
            'INSERT INTO tipo_entrada (label, parent_id, ordem, expanded) VALUES (?, ?, ?, ?)',
            [label, parent_id || null, ordem || 0, expanded !== false]
        );

        const [newNode] = await db.query(
            'SELECT * FROM tipo_entrada WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json(newNode[0]);
    } catch (error) {
        console.error('Error creating node:', error);
        res.status(500).json({ error: 'Failed to create node' });
    }
};

// Update node
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { label, parent_id, ordem, expanded } = req.body;

        await db.query(
            'UPDATE tipo_entrada SET label = ?, parent_id = ?, ordem = ?, expanded = ? WHERE id = ?',
            [label, parent_id || null, ordem, expanded, id]
        );

        const [updated] = await db.query(
            'SELECT * FROM tipo_entrada WHERE id = ?',
            [id]
        );

        res.json(updated[0]);
    } catch (error) {
        console.error('Error updating node:', error);
        res.status(500).json({ error: 'Failed to update node' });
    }
};

// Delete node (cascade deletes children)
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        await db.query('DELETE FROM tipo_entrada WHERE id = ?', [id]);

        res.json({ message: 'Node deleted successfully' });
    } catch (error) {
        console.error('Error deleting node:', error);
        res.status(500).json({ error: 'Failed to delete node' });
    }
};

// Move node (change parent)
exports.move = async (req, res) => {
    try {
        const { id } = req.params;
        const { parent_id, ordem } = req.body;

        await db.query('CALL MoveTipoEntrada(?, ?, ?)', [id, parent_id || null, ordem || 0]);

        const [updated] = await db.query(
            'SELECT * FROM tipo_entrada WHERE id = ?',
            [id]
        );

        res.json(updated[0]);
    } catch (error) {
        console.error('Error moving node:', error);
        res.status(500).json({ error: 'Failed to move node' });
    }
};
