const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Temporary endpoint to add initial_balance column
router.post('/fix-initial-balance', async (req, res) => {
    try {
        console.log('Attempting to add initial_balance column...');

        // Check if column exists
        const [rows] = await db.query("SHOW COLUMNS FROM contas LIKE 'initial_balance'");

        if (rows.length === 0) {
            await db.query("ALTER TABLE contas ADD COLUMN initial_balance DECIMAL(15,2) DEFAULT 0.00 AFTER description");
            console.log('Successfully added initial_balance column');
            res.json({ success: true, message: 'Coluna initial_balance adicionada com sucesso!' });
        } else {
            console.log('Column initial_balance already exists');
            res.json({ success: true, message: 'A coluna initial_balance já existe.' });
        }
    } catch (error) {
        console.error('Migration failed:', error);
        res.status(500).json({ success: false, message: 'Erro ao executar migração: ' + error.message });
    }
});

const bcrypt = require('bcryptjs');

// Temporary endpoint to reset a user password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, projectId, newPassword } = req.body;
        if (!email || !newPassword) {
            return res.status(400).json({ success: false, message: 'Email and newPassword are required' });
        }

        const [users] = await db.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        const userId = users[0].id;
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        let result;
        if (projectId) {
            [result] = await db.query(
                'UPDATE project_users SET password = ?, password_reset_required = FALSE WHERE user_id = ? AND project_id = ?',
                [hashedPassword, userId, projectId]
            );
        } else {
            [result] = await db.query(
                'UPDATE project_users SET password = ?, password_reset_required = FALSE WHERE user_id = ?',
                [hashedPassword, userId]
            );
        }

        res.json({
            success: true,
            message: 'Senha atualizada com sucesso!',
            affectedRows: result.affectedRows,
            user: { id: userId, email: users[0].email, name: users[0].name, projectId: projectId || 'all' }
        });
    } catch (error) {
        console.error('Password reset failed:', error);
        res.status(500).json({ success: false, message: 'Erro ao redefinir senha: ' + error.message });
    }
});

module.exports = router;
