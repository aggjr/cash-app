const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Invite user to project (simplified - no email)
exports.inviteUser = async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { name, email, initialPassword, role = 'user' } = req.body;
        const inviterId = req.user.id;

        if (!name || !email || !initialPassword) {
            return res.status(400).json({ error: 'Nome, e-mail e senha inicial são obrigatórios' });
        }

        if (initialPassword.length < 8) {
            return res.status(400).json({ error: 'A senha inicial deve ter no mínimo 8 caracteres' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check if inviter is master of the project
        const [inviterRole] = await connection.query(
            'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
            [projectId, inviterId]
        );

        if (!inviterRole.length || inviterRole[0].role !== 'master') {
            await connection.rollback();
            return res.status(403).json({ error: 'Apenas o master do projeto pode convidar usuários' });
        }

        // Check if user already exists
        const [existingUser] = await connection.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        let userId;
        const hashedPassword = await bcrypt.hash(initialPassword, 10);

        if (existingUser.length > 0) {
            // User exists, just add to project
            userId = existingUser[0].id;

            // Check if already in project
            const [existingMember] = await connection.query(
                'SELECT * FROM project_users WHERE project_id = ? AND user_id = ?',
                [projectId, userId]
            );

            if (existingMember.length > 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'Usuário já está neste projeto' });
            }
        } else {
            // Create new user (WITHOUT password - password is per project)
            const [result] = await connection.query(
                `INSERT INTO users (name, email, is_active, invited_by, invited_at) 
                 VALUES (?, ?, TRUE, ?, NOW())`,
                [name, email, inviterId]
            );
            userId = result.insertId;
        }

        // Add user to project WITH PASSWORD and password_reset_required
        await connection.query(
            `INSERT INTO project_users (project_id, user_id, password, password_reset_required, role, invited_by, status, joined_at) 
             VALUES (?, ?, ?, TRUE, ?, ?, 'active', NOW())`,
            [projectId, userId, hashedPassword, role, inviterId]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Usuário criado com sucesso',
            userId,
            email,
            name
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Invite user error:', error);
        res.status(500).json({ error: 'Erro ao convidar usuário' });
    } finally {
        if (connection) connection.release();
    }
};

// List project users
exports.listProjectUsers = async (req, res) => {
    try {
        const { projectId } = req.params;

        const [users] = await db.query(
            `SELECT 
                u.id,
                u.name,
                u.email,
                u.is_active,
                pu.role,
                pu.status,
                pu.invited_at,
                pu.joined_at,
                inviter.name as invited_by_name
            FROM project_users pu
            INNER JOIN users u ON pu.user_id = u.id
            LEFT JOIN users inviter ON pu.invited_by = inviter.id
            WHERE pu.project_id = ?
            ORDER BY pu.role DESC, u.name ASC`,
            [projectId]
        );

        res.json(users);
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
};

// Remove user from project
exports.removeUserFromProject = async (req, res) => {
    let connection;
    try {
        const { projectId, userId } = req.params;
        const requesterId = req.user.id;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check if requester is master
        const [requesterRole] = await connection.query(
            'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
            [projectId, requesterId]
        );

        if (!requesterRole.length || requesterRole[0].role !== 'master') {
            await connection.rollback();
            return res.status(403).json({ error: 'Apenas o master pode remover usuários' });
        }

        // Check if target user is master
        const [targetRole] = await connection.query(
            'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
            [projectId, userId]
        );

        if (targetRole.length && targetRole[0].role === 'master') {
            await connection.rollback();
            return res.status(400).json({ error: 'Não é possível remover o master do projeto' });
        }

        // Remove user from project
        await connection.query(
            'DELETE FROM project_users WHERE project_id = ? AND user_id = ?',
            [projectId, userId]
        );

        await connection.commit();
        res.json({ message: 'Usuário removido do projeto com sucesso' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Remove user error:', error);
        res.status(500).json({ error: 'Erro ao remover usuário' });
    } finally {
        if (connection) connection.release();
    }
};

// Transfer master role
exports.transferMaster = async (req, res) => {
    let connection;
    try {
        const { projectId } = req.params;
        const { newMasterId } = req.body;
        const currentMasterId = req.user.id;

        if (!newMasterId) {
            return res.status(400).json({ error: 'ID do novo master é obrigatório' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Verify current user is master
        const [currentRole] = await connection.query(
            'SELECT role FROM project_users WHERE project_id = ? AND user_id = ?',
            [projectId, currentMasterId]
        );

        if (!currentRole.length || currentRole[0].role !== 'master') {
            await connection.rollback();
            return res.status(403).json({ error: 'Apenas o master atual pode transferir a função' });
        }

        // Verify new master is in project and active
        const [newMasterRole] = await connection.query(
            'SELECT role, status FROM project_users WHERE project_id = ? AND user_id = ?',
            [projectId, newMasterId]
        );

        if (!newMasterRole.length) {
            await connection.rollback();
            return res.status(400).json({ error: 'Usuário não encontrado no projeto' });
        }

        if (newMasterRole[0].status !== 'active') {
            await connection.rollback();
            return res.status(400).json({ error: 'Apenas usuários ativos podem se tornar master' });
        }

        // Update current master to user
        await connection.query(
            'UPDATE project_users SET role = ? WHERE project_id = ? AND user_id = ?',
            ['user', projectId, currentMasterId]
        );

        // Update new user to master
        await connection.query(
            'UPDATE project_users SET role = ? WHERE project_id = ? AND user_id = ?',
            ['master', projectId, newMasterId]
        );

        await connection.commit();
        res.json({ message: 'Master transferido com sucesso' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Transfer master error:', error);
        res.status(500).json({ error: 'Erro ao transferir master' });
    } finally {
        if (connection) connection.release();
    }
};
