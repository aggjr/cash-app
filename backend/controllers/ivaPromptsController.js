const { loadPrompt, savePrompt, listPrompts } = require('../services/promptLoader');

/**
 * Get all IVA prompts
 */
const getAllPrompts = async (req, res) => {
    try {
        const user = req.user;

        // Only master/admin can view prompts
        if (!['master', 'admin'].includes(user.role)) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        const levels = await listPrompts();
        const prompts = {};

        for (const level of levels) {
            prompts[level] = await loadPrompt(level);
        }

        res.json({ success: true, prompts });
    } catch (error) {
        console.error('[IVA Prompts] Error getting prompts:', error);
        res.status(500).json({ error: 'Erro ao car regar prompts' });
    }
};

/**
 * Update a specific prompt
 */
const updatePrompt = async (req, res) => {
    try {
        const user = req.user;
        const { level } = req.params;
        const { content } = req.body;

        // Only master/admin can edit prompts
        if (!['master', 'admin'].includes(user.role)) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        if (!content || typeof content !== 'string') {
            return res.status(400).json({ error: 'Conteúdo do prompt é obrigatório' });
        }

        // Size limit: 50KB
        if (content.length > 50000) {
            return res.status(400).json({ error: 'Prompt muito grande (máximo 50KB)' });
        }

        await savePrompt(level, content);

        console.log(`[IVA Prompts] User ${user.name} updated prompt: ${level}`);

        res.json({
            success: true,
            message: 'Prompt atualizado com sucesso',
            level
        });
    } catch (error) {
        console.error('[IVA Prompts] Error updating prompt:', error);
        res.status(500).json({ error: 'Erro ao salvar prompt' });
    }
};

module.exports = {
    getAllPrompts,
    updatePrompt
};
