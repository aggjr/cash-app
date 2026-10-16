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

module.exports = router;
