const fs = require('fs').promises;
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, '../prompts');

/**
 * Load a prompt from file
 * @param {string} level - Prompt level ('system', 'conversation', etc)
 * @returns {Promise<string>} Prompt content
 */
async function loadPrompt(level) {
    try {
        const filepath = path.join(PROMPTS_DIR, `${level}.txt`);
        const content = await fs.readFile(filepath, 'utf-8');
        return content;
    } catch (error) {
        console.error(`[PromptLoader] Failed to load ${level} prompt:`, error.message);
        throw new Error(`Prompt "${level}" not found`);
    }
}

/**
 * Save a prompt to file
 * @param {string} level - Prompt level
 * @param {string} content - Prompt content
 * @returns {Promise<void>}
 */
async function savePrompt(level, content) {
    try {
        // Ensure prompts directory exists
        await fs.mkdir(PROMPTS_DIR, { recursive: true });

        // Backup existing file before overwriting
        const filepath = path.join(PROMPTS_DIR, `${level}.txt`);
        const backupPath = path.join(PROMPTS_DIR, `${level}.backup.txt`);

        try {
            const existing = await fs.readFile(filepath, 'utf-8');
            await fs.writeFile(backupPath, existing, 'utf-8');
        } catch (err) {
            // No existing file, skip backup
        }

        // Write new content
        await fs.writeFile(filepath, content, 'utf-8');
        console.log(`[PromptLoader] Saved ${level} prompt successfully`);
    } catch (error) {
        console.error(`[PromptLoader] Failed to save ${level} prompt:`, error.message);
        throw error;
    }
}

/**
 * List all available prompts
 * @returns {Promise<Array<string>>} List of prompt levels
 */
async function listPrompts() {
    try {
        const files = await fs.readdir(PROMPTS_DIR);
        return files
            .filter(f => f.endsWith('.txt') && !f.includes('.backup.'))
            .map(f => f.replace('.txt', ''));
    } catch (error) {
        console.error('[PromptLoader] Failed to list prompts:', error.message);
        return [];
    }
}

module.exports = {
    loadPrompt,
    savePrompt,
    listPrompts
};
