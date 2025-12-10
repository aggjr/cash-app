const db = require('../config/database');

exports.listProjects = async (req, res) => {
    try {
        const userId = req.user.id;
        const [projects] = await db.query(`
            SELECT p.*, pu.role 
            FROM projects p 
            JOIN project_users pu ON p.id = pu.project_id 
            WHERE pu.user_id = ?
        `, [userId]);
        res.json(projects);
    } catch (error) {
        console.error('List projects error:', error);
        res.status(500).json({ error: 'Failed to list projects', details: error.message });
    }
};

exports.createProject = async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.id;

        const [result] = await db.query(
            'INSERT INTO projects (name, owner_id) VALUES (?, ?)',
            [name, userId]
        );
        const projectId = result.insertId;

        await db.query(
            'INSERT INTO project_users (project_id, user_id, role) VALUES (?, ?, ?)',
            [projectId, userId, 'master']
        );

        res.status(201).json({ id: projectId, name, role: 'master' });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
};

exports.addUser = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { email, role } = req.body; // role: 'master' or 'user'
        const requesterId = req.user.id;

        // Verify requester is master
        const [requester] = await db.query(
            'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
            [projectId, requesterId]
        );

        if (!requester.length || requester[0].role !== 'master') {
            return res.status(403).json({ error: 'Only masters can add users' });
        }

        // Find user to add
        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userIdToAdd = users[0].id;

        // Check if already in project
        const [existing] = await db.query(
            'SELECT * FROM project_users WHERE project_id = ? AND user_id = ?',
            [projectId, userIdToAdd]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'User already in project' });
        }

        // Add user
        await db.query(
            'INSERT INTO project_users (project_id, user_id, role) VALUES (?, ?, ?)',
            [projectId, userIdToAdd, role || 'user']
        );

        res.json({ message: 'User added successfully' });
    } catch (error) {
        console.error('Add user error:', error);
        res.status(500).json({ error: 'Failed to add user' });
    }
};

exports.updateProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { name } = req.body;
        const requesterId = req.user.id;

        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        // Verify requester is master
        const [requester] = await db.query(
            'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
            [projectId, requesterId]
        );

        if (!requester.length || requester[0].role !== 'master') {
            return res.status(403).json({ error: 'Only masters can rename projects' });
        }

        // Update project
        await db.query(
            'UPDATE projects SET name = ? WHERE id = ?',
            [name, projectId]
        );

        res.json({ message: 'Project updated successfully', name });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
};
