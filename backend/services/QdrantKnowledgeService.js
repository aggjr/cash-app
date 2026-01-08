const VectorSearchService = require('./VectorSearchService');

/**
 * Service to retrieve IVA knowledge from Qdrant
 * Replaces hardcoded knowledge with dynamic queries
 */
class QdrantKnowledgeService {
    /**
     * Get greeting based on time of day
     * @param {number} hour - Current hour (0-23)
     * @returns {Promise<string>} Greeting text
     */
    static async getGreeting(hour) {
        const context = hour >= 5 && hour < 12 ? 'morning'
            : hour >= 12 && hour < 19 ? 'afternoon'
                : 'evening';

        console.log(`[Qdrant Knowledge] 👋 Getting greeting for ${context} (hour: ${hour})`);

        try {
            const results = await VectorSearchService.search(
                `saudação ${context}`,
                { category: 'greeting', context, layer: 'GLOBAL' },
                3
            );

            if (results.length > 0) {
                // Return random variation for naturalness
                const random = Math.floor(Math.random() * results.length);
                const greeting = results[random].text || results[random].payload?.text;
                console.log(`[Qdrant Knowledge] ✅ Found greeting: "${greeting}"`);
                return greeting;
            }
        } catch (err) {
            console.error(`[Qdrant Knowledge] ❌ Error getting greeting:`, err.message);
        }

        // Fallback
        const fallback = context === 'morning' ? 'Bom dia! Como posso ajudar?'
            : context === 'afternoon' ? 'Boa tarde! Como posso ajudar?'
                : 'Boa noite! Como posso ajudar?';
        console.log(`[Qdrant Knowledge] ⚠️ Using fallback: "${fallback}"`);
        return fallback;
    }

    /**
     * Get personality traits
     * @returns {Promise<Object>} Personality object with tone, style, traits
     */
    static async getPersonality() {
        console.log(`[Qdrant Knowledge] 🎭 Getting personality traits`);

        try {
            const results = await VectorSearchService.search(
                'personalidade tom estilo traços',
                { category: 'personality', layer: 'GLOBAL' },
                1
            );

            if (results.length > 0) {
                const personality = results[0].payload || results[0];
                console.log(`[Qdrant Knowledge] ✅ Found personality:`, personality);
                return {
                    tone: personality.tone || 'profissional e amigável',
                    style: personality.style || 'clara e objetiva',
                    traits: personality.traits || []
                };
            }
        } catch (err) {
            console.error(`[Qdrant Knowledge] ❌ Error getting personality:`, err.message);
        }

        // Fallback
        const fallback = {
            tone: 'profissional e amigável',
            style: 'clara e objetiva',
            traits: ['Prestativa', 'Paciente', 'Eficiente']
        };
        console.log(`[Qdrant Knowledge] ⚠️ Using fallback personality`);
        return fallback;
    }

    /**
     * Get system information
     * @returns {Promise<Object>} System info with name, description
     */
    static async getSystemInfo() {
        console.log(`[Qdrant Knowledge] 📊 Getting system info`);

        try {
            const results = await VectorSearchService.search(
                'assistente virtual sistema IVA',
                { category: 'system_info', layer: 'GLOBAL' },
                1
            );

            if (results.length > 0) {
                const info = results[0].payload || results[0];
                console.log(`[Qdrant Knowledge] ✅ Found system info:`, info);
                return {
                    assistant_name: info.assistant_name || 'IVA',
                    description: info.description || 'Assistente virtual inteligente'
                };
            }
        } catch (err) {
            console.error(`[Qdrant Knowledge] ❌ Error getting system info:`, err.message);
        }

        // Fallback
        const fallback = {
            assistant_name: 'IVA - Assistente Virtual Inteligente',
            description: 'Assistente virtual inteligente para sistemas de gestão empresarial'
        };
        console.log(`[Qdrant Knowledge] ⚠️ Using fallback system info`);
        return fallback;
    }

    /**
     * Get introduction text
     * @returns {Promise<string>} Introduction text
     */
    static async getIntroduction() {
        console.log(`[Qdrant Knowledge] 👤 Getting introduction`);

        try {
            const results = await VectorSearchService.search(
                'apresentação introdução primeiro contato',
                { category: 'introduction', layer: 'GLOBAL' },
                1
            );

            if (results.length > 0) {
                const intro = results[0].text || results[0].payload?.first_contact;
                console.log(`[Qdrant Knowledge] ✅ Found introduction`);
                return intro;
            }
        } catch (err) {
            console.error(`[Qdrant Knowledge] ❌ Error getting introduction:`, err.message);
        }

        // Fallback
        const fallback = 'Olá! Sou a IVA, sua Assistente Virtual Inteligente. Estou aqui para ajudar você a usar o sistema de forma mais eficiente.';
        console.log(`[Qdrant Knowledge] ⚠️ Using fallback introduction`);
        return fallback;
    }

    /**
     * Get help response for a query
     * @param {string} query - User's help query
     * @returns {Promise<string>} Help response
     */
    static async getHelpResponse(query) {
        console.log(`[Qdrant Knowledge] ❓ Getting help for: "${query}"`);

        try {
            const results = await VectorSearchService.search(
                query,
                { category: 'help', layer: 'GLOBAL' },
                1
            );

            if (results.length > 0) {
                const help = results[0].payload?.response || results[0].text;
                console.log(`[Qdrant Knowledge] ✅ Found help response`);
                return help;
            }
        } catch (err) {
            console.error(`[Qdrant Knowledge] ❌ Error getting help:`, err.message);
        }

        // Fallback
        const fallback = 'Posso ajudar você de várias formas! Me diga o que você precisa.';
        console.log(`[Qdrant Knowledge] ⚠️ Using fallback help`);
        return fallback;
    }
}

module.exports = QdrantKnowledgeService;
