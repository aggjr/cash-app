const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

exports.register = async (req, res, next) => {
    let connection;
    try {
        const { name, email, password, projectName } = req.body;
        console.log('=== REGISTER START ===', { name, email, projectName });

        if (!name || !email || !password) {
            throw new AppError('VAL-002');
        }

        if (password.length < 8) {
            throw new AppError('VAL-004');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();
        console.log('Transaction started');

        // Check if user exists
        const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
        console.log('Checked existing user:', { found: existing.length > 0, existing });

        let userId;
        if (existing.length > 0) {
            // User exists - just create new project for them
            userId = existing[0].id;
            console.log('Using existing user:', userId);
        } else {
            // Create new user
            const [userResult] = await connection.query(
                'INSERT INTO users (name, email) VALUES (?, ?)',
                [name, email]
            );
            userId = userResult.insertId;
            console.log('Created new user:', userId);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Password hashed');

        // Create new project
        const finalProjectName = projectName || `Projeto de ${name}`;
        const [projectResult] = await connection.query(
            'INSERT INTO projects (name) VALUES (?)',
            [finalProjectName]
        );
        const projectId = projectResult.insertId;
        console.log('Created project:', { projectId, name: finalProjectName });

        // Add user as master of the new project WITH PASSWORD
        await connection.query(
            'INSERT INTO project_users (project_id, user_id, password, role) VALUES (?, ?, ?, ?)',
            [projectId, userId, hashedPassword, 'master']
        );
        console.log('Linked user to project:', { userId, projectId, role: 'master' });

        await connection.commit();
        console.log('Transaction committed successfully');
        console.log('=== REGISTER SUCCESS ===', { userId, projectId });
        res.status(201).json({ message: 'Project created successfully' });
    } catch (error) {
        console.error('=== REGISTER ERROR ===', error);
        if (connection) await connection.rollback();

        // Handle Double-Click / Race Condition
        if (error.code === 'ER_DUP_ENTRY' && error.message.includes('project_users.PRIMARY')) {
            console.warn('Handling duplicate registration request (idempotency)');
            return res.status(200).json({ message: 'Project created successfully (idempotent)' });
        }

        next(error);
    } finally {
        if (connection) connection.release();
    }
};

// Get projects by email (for login flow)
exports.getProjectsByEmail = async (req, res, next) => {
    try {
        const { email } = req.body;
        console.log('Searching projects for email:', email);

        if (!email) {
            throw new AppError('VAL-002');
        }

        const [projects] = await db.query(`
            SELECT 
                p.id,
                p.name,
                pu.role
            FROM project_users pu
            INNER JOIN projects p ON pu.project_id = p.id
            INNER JOIN users u ON pu.user_id = u.id
            WHERE u.email = ?
            ORDER BY pu.last_login_at DESC, p.name ASC
        `, [email]);

        console.log(`Found ${projects.length} projects for ${email}`);
        res.json({ projects });
    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, projectId, password } = req.body;

        if (!email || !projectId || !password) {
            throw new AppError('VAL-002');
        }

        // Find user and project credentials
        const [result] = await db.query(`
            SELECT 
                u.id,
                u.name,
                u.email,
                u.is_active,
                pu.password,
                pu.password_reset_required,
                pu.role,
                p.name as project_name
            FROM users u
            INNER JOIN project_users pu ON u.id = pu.user_id
            INNER JOIN projects p ON pu.project_id = p.id
            WHERE u.email = ? AND pu.project_id = ?
        `, [email, projectId]);

        if (result.length === 0) {
            throw new AppError('AUTH-003');
        }

        const user = result[0];

        // Check if user is active
        if (!user.is_active) {
            throw new AppError('AUTH-004', 'Conta inativa.');
        }

        // Check password (project-specific)
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            throw new AppError('AUTH-003');
        }

        // Generate Token with projectId
        const token = jwt.sign({
            id: user.id,
            email: user.email,
            projectId: parseInt(projectId)
        }, JWT_SECRET, { expiresIn: '24h' });

        // Update last_login_at
        await db.query(
            'UPDATE project_users SET last_login_at = NOW() WHERE user_id = ? AND project_id = ?',
            [user.id, projectId]
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                password_reset_required: user.password_reset_required
            },
            project: {
                id: parseInt(projectId),
                name: user.project_name,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
};

// Change password (for logged-in users) - now updates project_users table
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        const projectId = req.user.projectId;

        if (!currentPassword || !newPassword) {
            throw new AppError('VAL-002');
        }

        if (newPassword.length < 8) {
            throw new AppError('VAL-004');
        }

        // Get current password from project_users
        const [projectUsers] = await db.query(
            'SELECT password FROM project_users WHERE user_id = ? AND project_id = ?',
            [userId, projectId]
        );

        if (projectUsers.length === 0) {
            throw new AppError('AUTH-004', 'Usuário não encontrado no projeto');
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, projectUsers[0].password);
        if (!validPassword) {
            throw new AppError('AUTH-003', 'Senha atual incorreta');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password in project_users
        await db.query(
            'UPDATE project_users SET password = ?, password_reset_required = FALSE WHERE user_id = ? AND project_id = ?',
            [hashedPassword, userId, projectId]
        );

        res.json({ message: 'Senha alterada com sucesso' });

    } catch (error) {
        next(error);
    }
};
