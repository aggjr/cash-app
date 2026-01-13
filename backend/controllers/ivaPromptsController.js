const { loadPrompt, savePrompt, listPrompts } = require('../services/promptLoader');
const QdrantKnowledgeService = require('../services/QdrantKnowledgeService');
// REMOVED: IvaContextBuilderQdrant - deleted in refactor
const IvaUserPreferences = require('../services/IvaUserPreferences');
const db = require('../config/database');

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


/**
 * Get resolved context for debugging (The "Consolidated" view)
 */
const getDebugResolvedContext = async (req, res) => {
    try {
        const user = req.user;
        const projectId = req.query.projectId || null;

        // Fetch User and Project data similar to ivaControllerV2
        // Fetch User and Project data similar to ivaControllerV2
        const [projectResult, preferredName, lastAccess, userResult] = await Promise.all([
            projectId ? db.query('SELECT * FROM projects WHERE id = ?', [projectId]) : Promise.resolve([[]]),
            IvaUserPreferences.getPreferredName(user.id),
            IvaUserPreferences.getLastAccess(user.id),
            db.query('SELECT * FROM users WHERE id = ?', [user.id])
        ]);

        const projectData = projectResult[0][0] || { name: 'Geral (Sem Projeto)' };
        const fullUser = userResult[0][0] || user; // Hydrated user
        const finalPreferredName = preferredName || fullUser.name?.split(' ')[0];

        // 1. Mock minimal screen data
        const screenData = { screenId: 'DEBUG_VIEW', description: 'Visualizando em modo debug' };
        const cachedScreens = [];

        // 2. Mock intent (GENERAL to see full prompt)
        const intent = { type: 'GENERAL' };

        // 3. Update user object with preference
        const userWithPref = { ...fullUser, preferred_name: finalPreferredName };

        // 4. Build Context using new unified prompt
        const UnifiedPrompt = require('../config/iva-unified-prompt');
        const resolvedPrompt = await UnifiedPrompt.getUnifiedPrompt(
            userWithPref,
            projectData,
            {
                activeScreenContext: screenData
            }
        );

        res.json({ success: true, resolvedPrompt });

    } catch (error) {
        console.error('[IVA Debug] Error resolving context:', error);
        res.status(500).json({ error: 'Erro ao gerar contexto consolidado' });
    }
};

module.exports = {
    getAllPrompts,
    updatePrompt,
    getDebugResolvedContext
};
