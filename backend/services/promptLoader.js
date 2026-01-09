const QdrantKnowledgeService = require('./QdrantKnowledgeService');

// DEPRECATED: Files are no longer used.
// const fs = require('fs').promises;
// const path = require('path');
// const PROMPTS_DIR = path.join(__dirname, '../prompts');

/**
 * Load a prompt from Qdrant
 * @param {string} level - Prompt level ('system', 'department', 'user')
 * @returns {Promise<string>} Prompt content
 */
async function loadPrompt(level) {
    try {
        const content = await QdrantKnowledgeService.getPrompt(level);
        if (!content) {
            console.warn(`[PromptLoader] Prompt "${level}" not found in Qdrant.`);
            // Fallback empty string instead of throw, handled by builder
            return '';
        }
        return content;
    } catch (error) {
        console.error(`[PromptLoader] Failed to load ${level} prompt from Qdrant:`, error.message);
        throw error;
    }
}

/**
 * Save a prompt to Qdrant
 * @param {string} level - Prompt level
 * @param {string} content - Prompt content
 * @returns {Promise<void>}
 */
async function savePrompt(level, content) {
    try {
        await QdrantKnowledgeService.savePrompt(level, content);
        console.log(`[PromptLoader] Saved ${level} prompt to Qdrant successfully`);
    } catch (error) {
        console.error(`[PromptLoader] Failed to save ${level} prompt to Qdrant:`, error.message);
        throw error;
    }
}

/**
 * List all available prompts from Qdrant
 * @returns {Promise<Array<string>>} List of prompt levels
 */
async function listPrompts() {
    try {
        const prompts = await QdrantKnowledgeService.listPrompts();
        // Ensure system is always returned even if not found (bootstrapping)
        if (!prompts.includes('system')) {
            return ['system', ...prompts];
        }
        return prompts;
    } catch (error) {
        console.error('[PromptLoader] Failed to list prompts from Qdrant:', error.message);
        return ['system']; // Minimal fallback
    }
}

module.exports = {
    loadPrompt,
    savePrompt,
    listPrompts
};
