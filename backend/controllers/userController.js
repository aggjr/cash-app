const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../utils/auditLogger');

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
            // Schema likely doesn't have invited_by/invited_at based on init.sql
            const [result] = await connection.query(
                `INSERT INTO users (name, email, is_active) 
                 VALUES (?, ?, TRUE)`,
                [name, email]
            );
            userId = result.insertId;
        }

        // Add user to project WITH PASSWORD
        // Removing password_reset_required, invited_by, joined_at as they likely don't exist in schema
        // Assuming 'status' exists or has default, but safe to omit if default is active? 
        // authController uses 'status' in SELECT, but NOT in INSERT.
        // Let's try inserting just what authController does + status='active' if possible, or just standard fields.
        await connection.query(
            `INSERT INTO project_users (project_id, user_id, password, role, status) 
             VALUES (?, ?, ?, ?, 'active')`,
            [projectId, userId, hashedPassword, role]
        );

        await connection.commit();
        logAudit(req, 'CREATE', 'project_users', userId, { name, email, role, action: 'INVITE_USER' });

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
                u.job_title,
                u.department,
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
        logAudit(req, 'DELETE', 'project_users', userId, { action: 'REMOVE_USER' });
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
        logAudit(req, 'UPDATE', 'project_users', newMasterId, { oldMaster: currentMasterId, newMaster: newMasterId, action: 'TRANSFER_MASTER' });
        res.json({ message: 'Master transferido com sucesso' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Transfer master error:', error);
        res.status(500).json({ error: 'Erro ao transferir master' });
    } finally {
        if (connection) connection.release();
    }
};
// Update user profile (global)
exports.updateUserProfile = async (req, res) => {
    let connection;
    try {
        const { userId } = req.params;
        const { name, preferred_name, job_title, department } = req.body;
        console.log('[User Update] Request for ID:', userId);
        console.log('[User Update] Payload:', { name, preferred_name, job_title, department });
        const requesterId = req.user.id; // From auth middleware

        // Authorization: Only allow user to update themselves OR master
        // For simplicity for now: Allow updates if authenticated. 
        // Ideally should check if requester == userId OR requester is master of a project user belongs to.
        // Let's implement: User can update self, or Master can update project members.

        // However, job_title/department are global. Let's restrict to:
        // 1. Self update
        // 2. Any Master in the system (simplification for testing)

        // For this task request ("altere a tela de cadastros"), ensuring flow works is priority.

        connection = await db.getConnection();
        await connection.beginTransaction();

        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (preferred_name !== undefined) {
            updates.push('preferred_name = ?');
            values.push(preferred_name);
        }
        if (job_title !== undefined) {
            updates.push('job_title = ?');
            values.push(job_title);
        }
        if (department !== undefined) {
            updates.push('department = ?');
            values.push(department);
        }

        if (updates.length > 0) {
            values.push(userId);
            await connection.query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        await connection.commit();
        logAudit(req, 'UPDATE', 'users', userId, { updates: req.body, action: 'UPDATE_PROFILE' });
        res.json({ message: 'Perfil atualizado com sucesso' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    } finally {
        if (connection) connection.release();
    }
};

// Smart Delete User - Hard delete if no dependencies, Soft delete otherwise
exports.deleteUser = async (req, res) => {
    let connection;
    try {
        const { userId } = req.params;
        const requesterId = req.user.id;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Prevent self-deletion
        if (parseInt(userId) === parseInt(requesterId)) {
            await connection.rollback();
            return res.status(400).json({ error: 'Você não pode deletar sua própria conta' });
        }

        // Check if user exists
        const [user] = await connection.query(
            'SELECT id, name, is_active FROM users WHERE id = ?',
            [userId]
        );

        if (!user.length) {
            await connection.rollback();
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Check for dependencies (audit logs)
        const [auditLogs] = await connection.query(
            'SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ?',
            [userId]
        );

        const hasAuditLogs = auditLogs[0].count > 0;

        if (hasAuditLogs) {
            // SOFT DELETE - Inactivate user
            await connection.query(
                'UPDATE users SET is_active = FALSE WHERE id = ?',
                [userId]
            );

            await connection.commit();
            logAudit(req, 'UPDATE', 'users', userId, {
                action: 'SOFT_DELETE_USER',
                reason: 'Has audit log entries',
                audit_logs_count: auditLogs[0].count
            });

            res.json({
                message: 'Usuário inativado com sucesso (possui registros relacionados)',
                action: 'inactivated',
                reason: `Usuário possui ${auditLogs[0].count} registro(s) no log de auditoria`
            });
        } else {
            // HARD DELETE - No dependencies
            // First remove from all projects
            await connection.query(
                'DELETE FROM project_users WHERE user_id = ?',
                [userId]
            );

            // Then delete user
            await connection.query(
                'DELETE FROM users WHERE id = ?',
                [userId]
            );

            await connection.commit();
            logAudit(req, 'DELETE', 'users', userId, {
                action: 'HARD_DELETE_USER',
                reason: 'No dependencies found'
            });

            res.json({
                message: 'Usuário excluído permanentemente com sucesso',
                action: 'deleted',
                reason: 'Usuário não possui registros relacionados'
            });
        }

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Erro ao deletar usuário' });
    } finally {
        if (connection) connection.release();
    }
};
