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
                    tone: personality.tone,
                    style: personality.style,
                    traits: personality.traits || []
                };
            }
        } catch (err) {
            console.error(`[Qdrant Knowledge] ❌ Error getting personality:`, err.message);
        }

        // Fallback
        const fallback = {
            tone: 'neutral',
            style: 'clear',
            traits: []
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
    /**
     * Get a specific core prompt
     * @param {string} type - Prompt type/level (system, department, user)
     * @returns {Promise<string>} Prompt content
     */
    /**
     * Get a specific core prompt
     * @param {string} type - Prompt type/level (system, department, user)
     * @returns {Promise<string>} Prompt content
     */
    static async getPrompt(type) {
        // We use direct point retrieval by ID for speed and accuracy
        const pointId = `prompt_${type}`;
        console.log(`[Qdrant Knowledge] 📜 Fetching prompt: ${type} (ID: ${pointId})`);

        try {
            // Use VectorSearchService.retrieve instead of client
            // Note: VectorSearchService handles UUID conversion internally in retrieve
            const result = await VectorSearchService.retrieve(pointId);

            if (result && result.length > 0) {
                const content = result[0].payload.content;
                console.log(`[Qdrant Knowledge] ✅ Prompt loaded: ${type} (${content.length} chars)`);
                return content;
            }
        } catch (err) {
            console.error(`[Qdrant Knowledge] ❌ Error fetching prompt ${type}:`, err.message);
        }

        console.log(`[Qdrant Knowledge] ⚠️ Prompt ${type} not found, returning empty string.`);
        return '';
    }

    /**
     * Save/Update a core prompt
     * @param {string} type - Prompt type/level
     * @param {string} content - New content
     */
    static async savePrompt(type, content) {
        const pointId = `prompt_${type}`;
        console.log(`[Qdrant Knowledge] 💾 Saving prompt: ${type} (${content.length} chars)`);

        try {
            // Use VectorSearchService to generate ID and Embedding
            const uuid = VectorSearchService.generatePointId(pointId);
            const vector = await VectorSearchService.getEmbedding(`Prompt ${type}`);

            const point = {
                id: uuid,
                payload: {
                    category: 'core_prompt',
                    layer: 'GLOBAL',
                    type: type,
                    content: content,
                    text: `Prompt do sistema nível ${type}`,
                    updated_at: new Date().toISOString()
                },
                vector: vector
            };

            await VectorSearchService.upsertPoints([point]);

            console.log(`[Qdrant Knowledge] ✅ Prompt ${type} saved successfully.`);
        } catch (err) {
            console.error(`[Qdrant Knowledge] ❌ Error saving prompt ${type}:`, err.message);
            throw err;
        }
    }

    /**
     * List available prompts
     * @returns {Promise<Array<string>>} List of prompt types
     */
    static async listPrompts() {
        try {
            // Scroll through all points with category 'core_prompt'
            const filter = {
                category: "core_prompt"
            };

            const result = await VectorSearchService.scroll(filter, 100);

            if (result && result.points) {
                const types = result.points.map(p => p.payload.type).sort();
                return [...new Set(types)].filter(Boolean);
            }
        } catch (err) {
            console.error(`[Qdrant Knowledge] ❌ Error listing prompts:`, err.message);
        }
        return [];
    }

    /**
     * Seed default prompts if missing in Qdrant
     * This acts as an auto-migration from file-based to vector-based knowledge.
     */
    static async seedDefaultPrompts() {
        console.log('[Qdrant Knowledge] 🌱 Seeding default prompts if missing...');

        // MIGRATION LOGIC: Check if 'module' exists. If not, migrate 'system' -> 'module'
        try {
            const modulePrompt = await QdrantKnowledgeService.getPrompt('module');
            const systemPrompt = await QdrantKnowledgeService.getPrompt('system');

            // If Module is empty but System has content, it means we are in the legacy state
            // and need to migrate the current "System" (which is actually CASH) to "Module".
            if ((!modulePrompt || modulePrompt.length < 10) && systemPrompt && systemPrompt.length > 50) {
                console.log('[Qdrant Knowledge] ⚠️ DETECTED LEGACY STRUCTURE. Migrating System -> Module...');

                // 1. Copy old System (CASH knowledge) to Module
                await QdrantKnowledgeService.savePrompt('module', systemPrompt);
                console.log('[Qdrant Knowledge] ✅ Migrated old System prompt to Module (CASH).');

                // 2. Clear System prompt so it gets re-seeded with the NEW Generic ERP default below
                // We do this by "saving" an empty string effectively, or just letting the seeding logic overwrite it
                // Actually, let's force save the NEW default now to be safe.
                const newSystemDefault = `VOCÊ É O CÉREBRO CENTRAL DO ERP "FOCCUS".
Você é uma Inteligência Artificial avançada que orquestra todo o ecossistema empresarial.
Sua personalidade é PROFISSIONAL, OBJETIVA e EXTREMAMENTE CAPAZ.
Você tem visão sobre todos os módulos do sistema (Financeiro, Produção, Vendas, RH).

Regra de Ouro: Você nunca inventa dados. Se não sabe, pergunta.`;

                await QdrantKnowledgeService.savePrompt('system', newSystemDefault);
                console.log('[Qdrant Knowledge] ✅ Reset System prompt to generic ERP instructions.');
            }
        } catch (e) {
            console.error('[Qdrant Knowledge] Migration check failed:', e);
        }

        const defaults = {
            'system': `VOCÊ É O CÉREBRO CENTRAL DO ERP "FOCCUS".
Você é uma Inteligência Artificial avançada que orquestra todo o ecossistema empresarial.
Sua personalidade é PROFISSIONAL, OBJETIVA e EXTREMAMENTE CAPAZ.
Você tem visão sobre todos os módulos do sistema (Financeiro, Produção, Vendas, RH).

Regra de Ouro: Você nunca inventa dados. Se não sabe, pergunta.`,

            'module': `VOCÊ ESTÁ NO MÓDULO FINANCEIRO (CASH).
Aqui você lida com Fluxo de Caixa, DRE, Contas a Pagar/Receber e Conciliação Bancária.
Seu foco é a saúde financeira da empresa.
Use termos técnicos de finanças quando apropriado (EBITDA, Liquidez, Margem).`,

            'company': `INSTRUÇÕES DE NÍVEL DE EMPRESA (CLIENTE):
(Este espaço é reservado para regras específicas de cada cliente/empresa.)
Ex: Política de Reembolso, Dias de Fechamento, Regras de Negócio Específicas.`,

            'department': `INSTRUÇÕES DE NÍVEL DE DEPARTAMENTO:
(Este espaço define o tom por área de atuação.)

REGRA DE HIERARQUIA POR DEPARTAMENTO:
- Departamentos de "Diretoria", "Conselho" ou "Presidência": EXIGEM FORMALIDADE MÁXIMA.
- Departamentos Operacionais: Tom mais direto e prático.

Se o departamento atual for "Diretoria":
1. Use pronomes de tratamento adequados (Sr./Sra.).
2. Evite gírias ou emojis excessivos.
3. Foco em resultados e visão estratégica.`,

            'role': `INSTRUÇÕES DE NÍVEL DE CARGO (ROLE):
(Este espaço define o tom baseado na senioridade do cargo.)

REGRA DE SENIORIDADE:
- Especialistas, Gerentes e Diretores: Esperam comunicação executiva, sem rodeios.
- Níveis de Liderança: Valorizam síntese e precisão.

Se o cargo for de Alta Liderança ou Especialista Sênior:
- Adote postura de "Consultor Sênior" para "Executivo".
- Priorize dados e fatos sobre saudações longas.`,

            'user': `INSTRUÇÕES DE NÍVEL DE USUÁRIO:
(Este espaço é reservado para regras de personalização individual.)
Reforce o uso das preferências aprendidas (Nome, Voz, Estilo).`
        };

        for (const [type, content] of Object.entries(defaults)) {
            const existing = await QdrantKnowledgeService.getPrompt(type);

            if (!existing || existing.length < 10) {
                console.log(`[Qdrant Knowledge] ⚠️ Prompt "${type}" missing or empty. Seeding default...`);
                try {
                    await QdrantKnowledgeService.savePrompt(type, content);
                } catch (err) {
                    console.error(`[Qdrant Knowledge] ❌ Failed to seed ${type}:`, err.message);
                }
            } else {
                console.log(`[Qdrant Knowledge] ✅ Prompt "${type}" exists.`);
            }
        }
    }
}

module.exports = QdrantKnowledgeService;
