const OpenAI = require('openai');
const db = require('../config/database');
const IvaContextBuilder = require('../services/IvaContextBuilderQdrant'); // Qdrant-based context builder
const IvaIntentValidator = require('../utils/ivaIntentValidator');
const IntentClassifier = require('../utils/ivaIntentClassifier');
const ContextualPrompts = require('../config/iva-contextual-prompts');
const IvaDataFetcher = require('../services/IvaDataFetcher');
const IvaScreenCache = require('../services/IvaScreenCache');
const LearningCommandClassifier = require('../utils/LearningCommandClassifier');
const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');
// TEMPORARILY DISABLED - Tables not in production yet

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Limitador de itera├º├╡es para evitar loops infinitos
const MAX_ITERATIONS = 5; // M├íximo de tentativas aut├┤nomas

console.log('Γ£à IVA Controller loaded successfully');

const chat = async (req, res, next) => {
    try {
        const { message, conversationHistory, context, isIntroduction } = req.body;
        const user = req.user;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        // Normalize auto-greeting (Prevents timeout/heavy prompt)
        if (message === 'IVA_AUTO_GREETING') {
            message = 'Olá';
        }

        // --- RESET COMMAND ---
        if (message === '/reset_iva_knowledge_confirmed') {
            console.log('[IVA Command] Resetting knowledge for user:', user.id);
            const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');
            await IvaGlobalKnowledge.resetAllForUser(user.id);
            return res.json({
                reply: '🗑️ Todo o conhecimento aprendido foi excluído. \n\nPodemos começar do zero agora! Como posso me apresentar?'
            });
        }
        // ---------------------

        // Validate intent before calling LLM (security layer)
        const validation = IvaIntentValidator.validate(message);
        if (!validation.valid) {
            console.log(`[IVA Security] Blocked ${validation.reason}:`, message.substring(0, 50));
            return res.json({
                reply: validation.response,
                validationError: validation.reason
            });
        }

        // ========================================
        // DEBUG: User Data Loading
        // ========================================
        console.log('[IVA Chat] Step 1 - req.user:', JSON.stringify({
            id: user?.id,
            name: user?.name,
            email: user?.email,
            preferred_name: user?.preferred_name
        }));

        // Fetch hierarchical context from DB and Qdrant in PARALLEL
        const IvaUserPreferences = require('../services/IvaUserPreferences');

        const [userResult, projectResult, preferredName] = await Promise.all([
            db.query('SELECT * FROM users WHERE id = ?', [user.id]),
            context.projectId ? db.query('SELECT * FROM projects WHERE id = ?', [context.projectId]) : Promise.resolve([[]]),
            IvaUserPreferences.getPreferredName(user.id)
        ]);

        const userData = userResult[0][0] || user;
        const projectData = projectResult[0][0] || {};
        const finalPreferredName = preferredName || userData.name?.split(' ')[0];

        // MERGE QDRANT DATA INTO USERDATA (Critical Fix)
        userData.preferred_name = preferredName;

        console.log('[IVA Operate] Step 3 - User with Qdrant preferences:', JSON.stringify({
            id: userData?.id,
            name: userData?.name,
            preferred_name: preferredName,
            job_title: userData?.job_title,
            department: userData?.department
        }));

        // Dynamic profile not needed - Qdrant provides all context

        // ========================================
        // INTENT CLASSIFICATION
        // ========================================
        const intent = IntentClassifier.classify(message, conversationHistory || []);
        console.log('[IVA Chat] Intent classified:', intent.type, '- Priority:', intent.priority);

        // ========================================
        // LEARNING COMMAND DETECTION
        // ========================================
        const learningCommand = LearningCommandClassifier.classify(message);

        if (learningCommand.type !== 'NONE') {
            console.log('[IVA Learning] Command detected:', learningCommand.type);

            if (learningCommand.type === 'PREFERRED_NAME') {
                // Extract preferred name from command
                const nameMatch = message.match(/(?:me chame|me trate|prefiro que.*?me (?:chame|trate)).*?(?:de|como)\s+([^.,!?]+)/i);

                if (nameMatch) {
                    const newPreferredName = nameMatch[1].trim();

                    // Save via IvaUserPreferences (Qdrant)
                    await IvaUserPreferences.setPreferredName(user.id, newPreferredName);
                    console.log(`[IVA Learning] Saved preferred_name via Qdrant: "${newPreferredName}"`);

                    return res.json({
                        reply: `Entendido! A partir de agora vou te chamar de ${newPreferredName}. ≡ƒÿè`,
                        learned: true,
                        preferredName: newPreferredName
                    });
                }
            }
        }

        // Get time context
        const now = new Date();
        // FIX: Force Brazil Timezone (UTC-3)
        const hour = parseInt(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(now));
        const timeOfDay = hour >= 5 && hour < 12 ? 'manh├ú' : hour >= 12 && hour < 19 ? 'tarde' : 'noite';

        // Build contextual system prompt based on intent
        let systemPrompt;
        const lastAssistantMessage = conversationHistory
            ?.filter(m => m.sender === 'assistant')
            .slice(-1)[0]?.text || '';

        switch (intent.type) {
            case 'LEARNING':
                systemPrompt = `
Você está em modo de aprendizado ativo. O usuário quer te ensinar uma nova regra ou conhecimento.
Extraia a essência do que está sendo ensinado.
Se for uma regra de onde encontrar dados (como na tela de previsão), formalize-a.
Confirme de forma clara e natural que você aprendeu.
`;
                // Trigger learning process in background
                IvaGlobalKnowledge.contribute('custom_rules', {
                    description: message.replace(/(iva|aprenda|guarde|memorize|grave|registre|ensinar|conhecimento|que)/gi, '').trim(),
                    keywords: IntentClassifier.extractKeywords ? IntentClassifier.extractKeywords(message) : IvaGlobalKnowledge.extractKeywords(message)
                }, user.id).catch(e => console.error('[IVA Learning] Error:', e));
                break;

            case 'GREETING':
                // Check context for daily greeting flag (passed from operate or calculated)
                // Note: 'operate' function uses 'context.isFirstDailyGreeting'
                // 'chat' function (this one) needs to ensure it has access to it.
                // Assuming isIntroduction might carry this or we infer it.
                // For safety, defaulting to FALSE in generic chat unless specified.
                const isFirst = context?.isFirstDailyGreeting === true || isIntroduction === true;
                systemPrompt = ContextualPrompts.greeting(userData, timeOfDay, isFirst);
                break;
            case 'CONFIRMATION':
                systemPrompt = ContextualPrompts.confirmation(userData);
                break;
            case 'FAREWELL':
                systemPrompt = ContextualPrompts.farewell(userData);
                break;
            case 'IDENTITY':
            case 'CORRECTION':
                systemPrompt = intent.type === 'IDENTITY'
                    ? ContextualPrompts.identity(userData, lastAssistantMessage)
                    : ContextualPrompts.correction(userData, lastAssistantMessage);
                break;
            case 'GRATITUDE':
                systemPrompt = ContextualPrompts.gratitude(userData);
                break;
            default:
                // Use enhanced base prompt with intent context
                systemPrompt = await ContextualPrompts.baseChatImproved(
                    userData,
                    projectData,
                    timeOfDay,
                    hour,
                    intent,
                    conversationHistory || []
                );
        }

        console.log('[IVA Chat] Using contextual prompt for:', intent.type);

        console.log('[IVA Chat] Step 4 - System Prompt Length:', systemPrompt?.length);
        console.log('[IVA Chat] Step 4 - Prompt contains name?', systemPrompt?.includes(userData?.name || 'NOTFOUND'));

        // Prepare messages for OpenAI
        const messages = [
            { role: "system", content: systemPrompt }
        ];

        // Add conversation history (last 10 messages for context)
        if (conversationHistory && Array.isArray(conversationHistory)) {
            conversationHistory.slice(-10).forEach(msg => {
                messages.push({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.text
                });
            });
        }

        // Add current message
        messages.push({ role: "user", content: message });

        // Get dynamic parameters based on intent
        const temperature = IntentClassifier.getTemperature(intent);
        const maxTokens = IntentClassifier.getMaxTokens(intent);

        console.log('[IVA Chat] LLM Parameters:', { temperature, maxTokens, intent: intent.type });

        // Call OpenAI API with 60-second timeout
        const response = await Promise.race([
            openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                temperature: temperature,
                max_tokens: maxTokens,
                presence_penalty: 0.1,
                frequency_penalty: 0.1
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('OpenAI request timeout (60s)')), 60000)
            )
        ]);

        const llmResponse = response.choices[0].message.content;

        // ≡ƒºá GENERIC LEARNING HANDLER
        // If LLM identified LEARNING intent, save to IvaGlobalKnowledge
        if (intent.type === 'LEARNING') {
            console.log('[IVA Learning] Generic learning detected, saving to global knowledge...');
            try {
                await IvaGlobalKnowledge.contribute({
                    type: 'custom_rules',
                    data: {
                        description: message, // User's original message
                        context: currentScreen || 'general',
                        learned_at: new Date().toISOString()
                    }
                }, user.id);
                console.log('[IVA Learning] Γ£à Saved to IvaGlobalKnowledge (will sync with Qdrant)');
            } catch (err) {
                console.error('[IVA Learning] Γ¥î Failed to save:', err.message);
            }
        }

        // Extract data if in introduction mode
        let extracted = { preferredName: null, voicePreference: null };
        let reply = llmResponse;

        if (isIntroduction) {
            const dataMatch = llmResponse.match(/<<<DATA>>>(.*?)<<<END>>>/s);

            if (dataMatch) {
                try {
                    extracted = JSON.parse(dataMatch[1].trim());
                    reply = llmResponse.replace(/<<<DATA>>>.*?<<<END>>>/s, '').trim();
                } catch (e) {
                    console.error('Failed to parse extracted data:', e);
                }
            }
        }


        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json({
            reply,
            extracted: isIntroduction ? extracted : undefined,
            usage: {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens
            }
        });

    } catch (error) {
        console.error('IVA Chat Error:', error);

        if (error.code === 'insufficient_quota') {
            return res.status(429).json({ error: 'Limite de uso da API OpenAI atingido' });
        }

        if (error.code === 'invalid_api_key') {
            return res.status(500).json({ error: 'Chave API OpenAI inv├ílida' });
        }

        res.status(500).json({ error: 'Erro ao processar mensagem' });
    }
};

const operate = async (req, res) => {
    try {
        let { message, conversationHistory, context, screenContext, currentScreen, availableScreens, userSettings } = req.body;
        const originalMessage = message;
        const user = req.user;

        console.log('[IVA Operate] ≡ƒÜÇ VERSION: Function Calling Enabled (v2.1)');
        // EXTENSIVE DEBUG LOGGING
        console.log('[IVA Operate] ========== REQUEST DEBUG ==========');
        console.log('[IVA Operate] Processing:', message);
        console.log('[IVA Operate] req.body keys:', Object.keys(req.body));
        console.log('[IVA Operate] context:', JSON.stringify(context, null, 2));
        console.log('[IVA Operate] screenContext (root):', screenContext?.screenId);
        console.log('[IVA Operate] context.screenContext:', context?.screenContext?.screenId);
        console.log('[IVA Operate] currentScreen:', currentScreen?.id);
        console.log('[IVA Operate] req.user:', JSON.stringify({
            id: user?.id,
            name: user?.name,
            preferred_name: user?.preferred_name
        }));
        console.log('[IVA Operate] Has activeScreenContext:', !!req.body.activeScreenContext);
        console.log('[IVA Operate] ====================================');

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Mensagem ├⌐ obrigat├│ria' });
        }

        // Validate intent before calling LLM (security layer)
        const validation = IvaIntentValidator.validate(message);
        if (!validation.valid) {
            console.log(`[IVA Security] Blocked ${validation.reason}:`, message.substring(0, 50));
            return res.json({
                action: { action: 'REPLY' },
                message: validation.response,
                validationError: validation.reason
            });
        }

        // Extract user voice settings
        const currentVoiceRate = userSettings?.ivaVoiceRate || 88;
        const currentVoiceGender = userSettings?.ivaVoiceMale ? 'M' : 'F';
        const currentVoiceEnabled = userSettings?.ivaVoiceEnabled !== 0;

        // Get state and time context
        const ivaIntroduced = user?.iva_introduced || false;
        const now = new Date();
        // FIX: Force Brazil Timezone (UTC-3)
        const hour = parseInt(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(now));
        const timeOfDay = hour >= 5 && hour < 12 ? 'manh├ú' : hour >= 12 && hour < 19 ? 'tarde' : 'noite';

        // ========================================
        // DEBUG: User Data Loading (Operate)
        // ========================================
        const perfStart = Date.now();
        console.log('[IVA Operate] Step 1 - req.user:', JSON.stringify({
            id: user?.id,
            name: user?.name,
            email: user?.email,
            preferred_name: user?.preferred_name
        }));

        // Fetch User, Project, and Qdrant Data in PARALLEL
        const IvaUserPreferences = require('../services/IvaUserPreferences');

        console.log('[IVA Perf] Starting Parallel Data Fetch...');
        const [userResult, projectResult, preferredName, lastAccess] = await Promise.all([
            db.query('SELECT * FROM users WHERE id = ?', [user.id]),
            context?.projectId ? db.query('SELECT * FROM projects WHERE id = ?', [context.projectId]) : Promise.resolve([[]]),
            IvaUserPreferences.getPreferredName(user.id),
            IvaUserPreferences.getLastAccess(user.id)
        ]);
        console.log(`[IVA Perf] Parallel Data Fetch Complete (${Date.now() - perfStart}ms)`);

        const userData = (userResult && userResult[0] && userResult[0][0]) || user;
        if (!userData) {
            console.error('[IVA Code Critical] User data is NULL. Using req.user fallback.');
        }
        const projectData = (projectResult && projectResult[0] && projectResult[0][0]) || {};
        const finalPreferredName = preferredName || userData.name?.split(' ')[0];

        // ========================================
        // INTENT CLASSIFICATION (EARLY CHECK)
        // ========================================
        if (message === 'IVA_AUTO_GREETING') {
            // message = 'Olá, boa noite'; // Dont normalize - let LLM see the token matches the instruction
        }

        const isAutoGreeting = (originalMessage === 'IVA_AUTO_GREETING');

        // ========================================
        // INTENT CLASSIFICATION (EARLY CHECK)
        // ========================================
        let intent;

        if (isAutoGreeting) {
            console.log('[IVA Operate] 🤖 Auto-Greeting detected - FORCING intent: GREETING');
            intent = {
                type: 'GREETING',
                priority: 'HIGHEST',
                context: 'System auto-greeting trigger'
            };
        } else {
            intent = IntentClassifier.classify(message, conversationHistory || []);
        }

        console.log('[IVA Operate] Preferred Name Debug:', {
            qdrant: preferredName,
            userDB: userData.name,
            final: finalPreferredName,
            userId: user.id
        });

        if (intent.type === 'LEARNING') {
            console.log('[IVA Operate] ≡ƒºá Learning intent detected, bypassing normal loop');

            // Trigger learning in background
            const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');

            // 1. Save rule first
            const isPersonal = /(minha|meu|eu |gosto de|prefiro|sou|estou)/i.test(message);
            const scope = isPersonal ? 'USER' : 'SYSTEM';

            await IvaGlobalKnowledge.contribute('custom_rules', {
                description: message.replace(/(iva|aprenda|guarde|memorize|grave|registre|ensinar|conhecimento|que|pergunta|original|:|"|')/gi, '').trim(),
                keywords: IntentClassifier.extractKeywords ? IntentClassifier.extractKeywords(message) : IvaGlobalKnowledge.extractKeywords(message)
            }, {
                userId: user.id,
                projectId: context.projectId,
                scope: scope,
                department: user.department,
                role: user.job_title
            }).catch(e => console.error('[IVA Learning] Error:', e));

            // 2. CHECK FOR NAVIGATION HINT (The "Anti-Laziness" Fix)
            // If user says "it is on X screen", we should go there immediately.
            const screenMatch = message.match(/(?:na|em|ir para|vai para|acesse|tela de|tela|no|em) ([\wáàâãéèêíïóôõöúçñ\s]+)/i);

            if (screenMatch && availableScreens) {
                const hint = screenMatch[1].toLowerCase().trim();
                // Try to find a matching screen in availableScreens
                const targetScreen = availableScreens.find(s =>
                    s.name?.toLowerCase().includes(hint) ||
                    s.id?.toLowerCase().includes(hint) ||
                    s.label?.toLowerCase().includes(hint)
                );

                if (targetScreen) {
                    console.log(`[IVA Learning] 🚀 Navigation hint detected: "${hint}" -> Target: ${targetScreen.id}`);
                    return res.json({
                        intent: 'LEARNING_AND_NAVIGATE',
                        action: 'NAVIGATE', // Chain navigation
                        target: targetScreen.id, // Frontend uses 'target' or 'screen'
                        screen: targetScreen.id,
                        message: `Entendi! Registrei a regra e estou indo para a tela **${targetScreen.name || hint}** para verificar essa informação agora mesmo.`
                    });
                }
            }

            return res.json({
                intent: 'LEARNING',
                action: 'REPLY',
                message: 'Entendido! Guardei esse novo conhecimento e vou usá-lo quando você me perguntar.'
            });
        }

        // ========================================
        // DYNAMIC KNOWLEDGE DISCOVERY
        // ========================================
        let discoveredKnowledge = null;

        /* TEMPORARILY DISABLED
        // Check hvis projeto j├í foi explorado
        const hasKnowledge = await IvaExplorationService.hasProjectKnowledge(context.projectId);

        if (!hasKnowledge) {
            console.log(`[IVA] Primeira vez no projeto ${context.projectId}. Explorando...`);
            discoveredKnowledge = await IvaExplorationService.exploreProject(context.projectId, userData.id);
        } else {
            // Carregar conhecimento existente
            discoveredKnowledge = await IvaExplorationService.loadProjectKnowledge(context.projectId);
            console.log(`[IVA] Conhecimento carregado para projeto ${context.projectId}`);
        */

        // ========================================
        // SCREEN CONTEXT: Fetch complete data based on filters
        // ========================================
        let screenData = null;
        let cachedScreens = [];

        if (context?.screenContext) {
            console.log('[IVA Operate] Screen Context Received:', {
                screenId: context.screenContext.screenId,
                filters: context.screenContext.filters
            });

            try {
                // Fetch complete data from DB with same filters
                screenData = await IvaDataFetcher.fetchScreenData(
                    db,
                    context.screenContext.screenId,
                    context.screenContext.filters,
                    context.projectId
                );

                // Cache the data
                if (screenData) {
                    IvaScreenCache.set(user.id, context.projectId, screenData.screenId, screenData);
                    console.log('[IVA Operate] Cached screen data:', screenData.screenId);
                }

                // Get most accessed screens for cross-analysis
                cachedScreens = IvaScreenCache.getMostAccessed(user.id, context.projectId, 3);
                console.log('[IVA Operate] Most accessed screens:', cachedScreens.map(s => s.screenId));

            } catch (error) {
                console.error('[IVA Operate] Error fetching screen data:', error);
                // Continue without screen data
            }
        }

        // Dynamic profile not needed - Qdrant provides all context

        // Update userData with Qdrant preferredName (override MySQL value)
        // Ensure userData is a plain object to avoid RowDataPacket issues
        const plainUserData = JSON.parse(JSON.stringify(userData));

        const userDataWithQdrant = {
            ...plainUserData,
            preferred_name: finalPreferredName // From Qdrant or MySQL fallback
        };

        console.log('[IVA Code Debug] userDataWithQdrant passed to builder:', JSON.stringify(userDataWithQdrant, null, 2));
        console.log('[IVA Code Debug] projectData passed to builder:', JSON.stringify(projectData, null, 2));

        // Use Qdrant-based context builder (simplified)
        let systemPrompt = '';
        try {
            console.log('[IVA Perf] Starting Context Builder...');
            const ctxStart = Date.now();
            systemPrompt = await IvaContextBuilder.buildOperateContextWithQdrant(
                userDataWithQdrant,
                projectData,
                screenData,
                cachedScreens,
                intent,
                lastAccess,
                conversationHistory,
                isAutoGreeting
            );
            console.log(`[IVA Perf] Context Builder Complete (${Date.now() - ctxStart}ms)`);
        } catch (ctxError) {
            console.error('[IVA Code Critical] Context Builder Failed:', ctxError);
            systemPrompt = 'Erro crítico ao construir contexto. Aja como assistente genérico.';
        }


        // Qdrant knowledge already injected in buildOperateContextWithQdrant
        // ALL system prompts must define the base persona first
        const globalPersona = ContextualPrompts.getGlobalIdentity(userData);
        systemPrompt = globalPersona + "\n\n" + systemPrompt;

        // No need to inject again here




        // Determine Greeting Instruction based on frontend flag
        const isFirstDailyGreeting = context?.isFirstDailyGreeting === true;

        // Generate prompt using the centralized config
        const greetingContextPrompt = ContextualPrompts.greeting(userData, timeOfDay, isFirstDailyGreeting);

        const greetingInstruction = greetingContextPrompt;

        // ADD INTENT CLASSIFICATION INSTRUCTION
        systemPrompt += `

CLASSIFICAÇÃO DE INTENÇÃO (OBRIGATÓRIO):
Antes de retornar a ação, classifique a intenção do usuário:

INSTRUÇÃO DE SAUDAÇÃO ATIVA:
${greetingInstruction}

1. GREETING - Usuário iniciando conversa ou 'IVA_AUTO_GREETING'
   - Retorne: { "intent": "GREETING", "action": "REPLY", "message": "..." }
   - IMPORTANTE: Siga a INSTRUÇÃO DE SAUDAÇÃO ATIVA acima.

2. PREFERENCE_CHANGE - Usuário pede para mudar nome, voz, ou configurações
   Exemplos: "Me chame de Guto", "Mude minha voz", "Pare de falar"
   OBRIGATÓRIO: Chame a função correspondente (\`save_preferred_name\`, \`save_voice_settings\`).
   NÃO RESPONDA APENAS COM TEXTO. USE A FUNÇÃO.

3. IDENTITY - Usuário pergunta quem você é
   Retorne: { "intent": "IDENTITY", "action": "REPLY", "message": "Sou a IVA..." }

4. FAREWELL - Usuário está se despedindo EXPLICITAMENTE
   Exemplos: "Tchau", "Até logo", "Fui", "Encerrar", "Fechar"
   Retorne: { "intent": "FAREWELL", "action": "REPLY", "message": "Até logo! 👋", "forceClose": true }
   CRÍTICO: PERGUNTAS DE TEMPO ("Daqui a 20 dias", "Até quando?") NÃO SÃO FAREWELL. SÃO DATA_SEEKING.

5. NAVIGATION_ONLY - Usuário quer apenas encontrar/ver uma tela
   Exemplos: "Onde cadastro usuários?", "Como acesso relatórios?", "Onde fica configurações?"
   Retorne: { "intent": "NAVIGATION_ONLY", "action": "NAVIGATE", "target": "screen-id", "message": "...", "highlight": "texto opcional para destacar" }
   IMPORTANTE: SEMPRE use a pergunta de validação ao navegar para uma nova tela em busca de informação.

6. DATA_SEEKING - Usuário quer informação específica/dados ou análise de valores
   Exemplos: "Quanto recebi em dezembro?", "Qual o saldo?", "Qual será meu fluxo de caixa daqui a 10 dias?", "Ver previsão de fechamento"
   Retorne: { "intent": "DATA_SEEKING", "action": "NAVIGATE", "target": "screen-id", "message": "...", "highlight": "valor/texto para destacar" }

7. ACTION_EXECUTION - Usuário quer executar uma ação específica
   Exemplos: "Criar entrada de R$ 1000", "Exportar relatório", "Filtrar por empresa X"
   Retorne: { "intent": "ACTION_EXECUTION", "action": "NAVIGATE", "target": "screen-id", "message": "..." }

8. LEARNING - Usuário está EXPLICITAMENTE ensinando uma regra ou comando NOVO.
   Exemplos válidos: "aprenda que o fluxo agora é X", "guarde este conhecimento: Y", "minha cor preferida é azul"
   NÃO USE para: "teste", "ola", perguntas ou correções simples.
   OBRIGATÓRIO: Defina o SCOPE:
   - 'USER': para gostos pessoais (cores, times, nomes).
   - 'DEPARTMENT': para regras de fluxo do setor.
   - 'PROJECT': para regras específicas deste projeto (ex: gerente, aprovações, datas).
   - 'SYSTEM': para verdades universais da empresa.
   Retorne: { "intent": "LEARNING", "action": "REPLY", "message": "Entendido! Guardei esse novo conhecimento e vou usá-lo quando você me perguntar." }
   IMPORTANTE: Só acione se o usuário estiver claramente instruindo você a aprender.

9. CLARIFICATION - Entradas curtas, ambíguas ou incompreensíveis
   - Exemplos: "e?", "hum", "ok", "entendi", "...", "a"
   - SE O INPUT FOR MENOR QUE 3 CARACTERES E NÃO FOR "SIM" OU "NÃO":
     Retorne: { "intent": "CLARIFICATION", "action": "REPLY", "message": "Como posso te ajudar com isso?" }
   - PROIBIDO usar para saudações ("Oi", "Olá") -> Use regra 1 (GREETING).
   - PROIBIDO ALUCINAR DADOS. Se não entender, pergunte.

IMPORTANTE: SEMPRE inclua o campo "intent" na sua resposta JSON!

REGRA DE CONTEXTO DE TELA:
- Se o usuário CONFIRMOU que está na tela certa (ex: "é nesta tela", "exatamente", "sim"), NÃO navegue para outra tela
- SEMPRE tente buscar os dados na tela atual PRIMEIRO antes de sugerir navegação
- Só sugira navegar para outra tela se:
  1. O usuário explicitamente pedir para ir para outra tela, OU
  2. Você tentou buscar na tela atual e NÃO encontrou o dado necessário
- Quando o dado existe na tela atual, use action: "REPLY" com a resposta baseada nos dados da tela

10. CICLO INFINITO DE AJUDA (CRÍTICO):
   - SEMPRE termine suas mensagens oferecendo ajuda adicional (exceto em despedidas).
   - Use: "Deseja ver mais detalhes?", "Posso ajudar com outra coisa?", "Quer navegar para outra tela?"
   - Se o usuário não disse explicitamente que acabou, assuma que ele quer continuar.

Siga rigorosamente as INSTRUÇÕES DE FLUXO DE EXECUÇÃO E DESCOBERTA enviadas pelo Context Builder.
`;


        const history = conversationHistory || [];
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant', // Map sender to role
                content: msg.text
            })),
            { role: 'user', content: message }
        ];

        console.log('[IVA Backend] ========== LLM REQUEST ==========');
        console.log('[IVA Backend] User message:', message);
        console.log('[IVA Backend] Current screen:', context?.screenContext?.screenId || 'none');
        console.log('[IVA Backend] History messages:', history.length);
        console.log('[IVA Backend] System prompt length:', systemPrompt.length, 'chars');
        console.log('[IVA Backend] Calling OpenAI...');

        // Call LLM with 60-second timeout protection
        const ivaFunctions = require('../config/iva-functions');

        const completion = await Promise.race([

            openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
                temperature: 0.3,
                response_format: { type: "json_object" },
                functions: ivaFunctions,
                function_call: 'auto'
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('OpenAI request timeout (60s)')), 60000)
            )
        ]);

        // Handle function calls from LLM
        const functionCall = completion.choices[0].message.function_call;

        console.log('[IVA Debug] LLM Finish Reason:', completion.choices[0].finish_reason);
        console.log('[IVA Debug] LLM Function Call Object:', functionCall ? JSON.stringify(functionCall) : 'null');

        if (functionCall) {
            console.log('[IVA Function Call] LLM requested function:', functionCall.name);
            console.log('[IVA Function Call] Arguments:', functionCall.arguments);

            const IvaUserPreferences = require('../services/IvaUserPreferences');

            try {
                const args = JSON.parse(functionCall.arguments);

                if (functionCall.name === 'save_preferred_name') {
                    await IvaUserPreferences.setPreferredName(user.id, args.name);
                    console.log(`[IVA Function Call] Γ£à Saved preferred name: "${args.name}"`);
                }

                if (functionCall.name === 'save_voice_settings') {
                    await IvaUserPreferences.setVoiceSettings(user.id, args);
                    console.log(`[IVA Function Call] Γ£à Saved voice settings:`, args);
                }

                if (functionCall.name === 'update_last_access') {
                    await IvaUserPreferences.updateLastAccess(user.id);
                    console.log(`[IVA Function Call] Γ£à Updated last access for user ${user.id}`);
                }

                if (functionCall.name === 'close_chat') {
                    console.log(`[IVA Function Call] 🚪 Close chat requested by LLM`);
                    req._ivaForceClose = true;
                }

                if (functionCall.name === 'contribute_knowledge') {
                    const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');

                    // Map 'rules' alias to 'custom_rules' to prevent errors if LLM hallucinates
                    let type = args.type;
                    if (type === 'rules') type = 'custom_rules';

                    // Prepare context for scoped knowledge
                    const knowledgeContext = {
                        userId: user.id,
                        userName: user.name, // Added for Audit
                        projectId: context.projectId, // Added project scope
                        scope: args.scope || 'USER', // Default to safe scope
                        department: user.department,
                        role: user.job_title
                    };

                    await IvaGlobalKnowledge.contribute(type, args.data, knowledgeContext);
                    console.log(`[IVA Function Call] ✅ Contributed new knowledge: ${type} (Scope: ${knowledgeContext.scope})`);
                }
            } catch (err) {
                console.error('[IVA Function Call] Γ¥î Error executing function:', err.message);
            }
        }

        const responseContent = completion.choices[0].message.content;

        console.log('[IVA Backend] ========== LLM RESPONSE ==========');
        console.log('[IVA Backend] Response length:', responseContent?.length, 'chars');
        console.log('[IVA Backend] Raw response:', responseContent?.substring(0, 200) + '...');
        console.log('[IVA Backend] Tokens used:', {
            prompt: completion.usage?.prompt_tokens,
            completion: completion.usage?.completion_tokens,
            total: completion.usage?.total_tokens
        });

        // If LLM returned only function_call without content, handle based on context
        if (!responseContent && functionCall) {
            console.log('[IVA Backend] ⚠️ LLM returned only function_call:', functionCall.name);

            // Check if this is a system action (silent mode)
            const isSystemAction = req.body.systemAction === true;
            const messageType = req.body.message || '';

            // CRITICAL: AUTO_GREETING should NEVER be silent, even if systemAction=true
            if (isSystemAction && messageType !== 'IVA_AUTO_GREETING') {
                // System actions should not return messages to user
                console.log('[IVA Backend] System action - no response needed');
                return res.json({
                    action: 'SILENT',
                    systemAction: true,
                    functionExecuted: functionCall.name
                });
            }

            // User-initiated actions should get appropriate response based on intent
            // Import classifier to determine proper intent
            const IvaIntentClassifier = require('../utils/ivaIntentClassifier');
            const intent = IvaIntentClassifier.classify(message, conversationHistory);

            let defaultMessage = 'Entendido!';
            let intentType = intent.type || 'GENERAL';

            let userUpdates = null;

            // Function-specific confirmations (Better UX than generic 'Entendido')
            if (functionCall.name === 'save_preferred_name') {
                const args = JSON.parse(functionCall.arguments);
                defaultMessage = `Combinado! Vou te chamar de ${args.name} a partir de agora.`;
                userUpdates = { preferred_name: args.name };
            } else if (functionCall.name === 'contribute_knowledge') {
                defaultMessage = 'Conhecimento registrado! 🧠 Ele passará por uma validação antes de entrar na base definitiva. Posso te ajudar com mais alguma coisa?';
            } else if (functionCall.name === 'save_voice_settings') {
                const args = JSON.parse(functionCall.arguments);
                defaultMessage = 'Configurações de voz atualizadas!';
                userUpdates = args;
            }

            // Customize message based on detected intent
            if (intent.type === 'GREETING') {
                const hour = parseInt(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()));
                const greeting = hour >= 5 && hour < 12 ? 'Bom dia' :
                    hour >= 12 && hour < 19 ? 'Boa tarde' : 'Boa noite';

                // Formality check
                const jobTitle = userData?.job_title?.toLowerCase() || '';
                const isExecutive = jobTitle.includes('diretor') || jobTitle.includes('ceo') || jobTitle.includes('presidente') || jobTitle.includes('head');
                const isFormal = isExecutive || (userData?.department === 'Diretoria');

                // Name logic (FIX: Prioritize Qdrant preferredName)
                const name = preferredName || userData?.preferred_name || userData?.name?.split(' ')[0] || '';
                const prefix = isFormal ? (userData?.gender === 'F' ? 'Sra.' : 'Sr.') : '';
                const displayName = isFormal ? `${prefix} ${name}` : name;

                // Message construction
                const emoji = isFormal ? '' : ' 😊';
                defaultMessage = `${greeting}, ${displayName}!${emoji} Como posso ajudar?`;
            } else if (intent.type === 'SOCIAL_THANKS') {
                defaultMessage = 'Por nada! Fico feliz em ajudar! 😊 Precisa de mais alguma coisa?';
            } else if (intent.type === 'SOCIAL_PRAISE') {
                defaultMessage = 'Oba! Que bom que gostou! 😊 Posso fazer mais alguma coisa?';
            } else if (intent.type === 'SOCIAL_CASUAL') {
                defaultMessage = 'Estou ótima, obrigada! E você? Em que posso ajudar?';
            } else if (intent.type === 'SOCIAL_FRUSTRATION') {
                defaultMessage = 'Opa, desculpa! Deixa eu te explicar melhor...';
            } else if (functionCall.name === 'close_chat') {
                defaultMessage = 'Até logo! Fechando janela.';
                intentType = 'FAREWELL';
            }

            const defaultAction = {
                action: 'REPLY',
                message: defaultMessage,
                intent: intentType,
                forceClose: req._ivaForceClose || false,
                userUpdates // Pass updates to frontend
            };
            return res.json(defaultAction);
        }

        if (!responseContent) {
            console.error('[IVA Backend] Γ¥î OpenAI returned empty response');
            throw new Error('OpenAI returned empty response');
        }

        try {
            let action = JSON.parse(responseContent);

            // Inject forceClose if requested by function call
            if (req._ivaForceClose) {
                action.forceClose = true;
            }

            console.log('[IVA Backend] ========== PARSED ACTION ==========');
            console.log('[IVA Backend] Action type:', action.action);
            console.log('[IVA Backend] Intent:', action.intent || 'NOT CLASSIFIED');
            console.log('[IVA Backend] Target:', action.target || action.screen || 'none');
            console.log('[IVA Backend] Has message:', !!action.message);
            console.log('[IVA Backend] =======================================');

            // NORMALIZE LLM OUTPUT
            // Handle { REPLY: "message" } format
            if (!action.action && action.REPLY) {
                action = { action: 'REPLY', message: action.REPLY };
            }

            // AUTO-UPDATE LAST ACCESS (Replacement for function call)
            // We update it silently for every meaningful interaction
            const IvaUserPreferences = require('../services/IvaUserPreferences');
            await IvaUserPreferences.updateLastAccess(user.id);
            // Handle { REPLY: "message" } format
            if (!action.action && action.REPLY) {
                action = { action: 'REPLY', message: action.REPLY };
            }
            // Handle { NAVIGATE: "screen" } format
            else if (!action.action && action.NAVIGATE) {
                action = { action: 'NAVIGATE', screen: action.NAVIGATE, target: action.NAVIGATE };
            }
            // Handle raw { action: "NAVIGATE", target: "screen" } vs { action: "NAVIGATE", screen: "screen" }
            else if (action.action === 'NAVIGATE' && !action.screen && action.target) {
                action.screen = action.target;
            }

            // Pass 'highlight' field if present (New Feature)
            if (action.highlight) {
                // Ensure target is preserved if this was a NAVIGATE action
                if (action.action === 'NAVIGATE') {
                    // It's already fine, frontend uses action object
                }
            }

            // --- LEARNING FALLBACK (Critical Fix) ---
            // If LLM says intent is LEARNING but didn't call the function, we do it manually
            if (action.intent === 'LEARNING') {
                console.log('[IVA Backend] 🧠 Learning Intent detected in JSON response (Fallback)');

                const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');
                const IvaIntentClassifier = require('../utils/ivaIntentClassifier');

                // Smart Scope Detection (same as line 378)
                const isPersonal = /(minha|meu|eu |gosto de|prefiro|sou|estou)/i.test(message);
                const scope = isPersonal ? 'USER' : 'SYSTEM';

                // Prevent duplicates if function call already handled it
                const alreadyHandled = !!functionCall && functionCall.name === 'contribute_knowledge';

                if (!alreadyHandled) {
                    try {
                        const description = message.replace(/(iva|aprenda|guarde|memorize|grave|registre|ensinar|conhecimento|que|para|:|"|')/gi, '').trim();

                        await IvaGlobalKnowledge.contribute('custom_rules', {
                            description: description,
                            keywords: IvaGlobalKnowledge.extractKeywords(description)
                        }, {
                            userId: user.id,
                            userName: user.name, // Added for Audit
                            scope: scope,
                            department: user.department,
                            role: user.job_title
                        });
                        console.log(`[IVA Fallback] ✅ Saved knowledge: "${description.substring(0, 30)}..." (Scope: ${scope})`);

                        // Override response if specific message needed
                        if (!action.message) {
                            action.message = "Entendido! Guardei esse novo conhecimento e vou usá-lo quando você me perguntar.";
                        }
                    } catch (err) {
                        console.error('[IVA Fallback] ❌ Error saving knowledge:', err);
                    }
                }
            }


            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.json(action);
        } catch (e) {
            console.error('Failed to parse IVA operate JSON:', e);
            res.status(500).json({
                error: 'Falha ao processar comando',
                raw: responseContent
            });
        }

    } catch (error) {
        console.error('IVA Operate Error:', error);
        console.error('Request Body Slice:', JSON.stringify(req.body).slice(0, 500)); // Log safe amount
        res.status(500).json({ error: 'Erro interno ao processar comando' });
    }
};


// --- TEMPORARY BACKFILL ENDPOINT ---
const backfillKnowledge = async (req, res) => {
    console.log('🚀 Starting Knowledge Backfill via Endpoint...');
    res.json({ message: 'Backfill started in background...' });

    try {
        const IvaKnowledgeGenerator = require('../services/IvaKnowledgeGenerator');

        // 1. Get all unique Departments
        const [departments] = await db.promise().query(
            "SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != ''"
        );
        console.log(`📊 Found ${departments.length} unique departments.`);

        for (const row of departments) {
            console.log(`Processing Department: ${row.department}`);
            await IvaKnowledgeGenerator.ensureContextRules('department', row.department);
            await new Promise(r => setTimeout(r, 1000));
        }

        // 2. Get all unique Job Titles (Roles)
        const [roles] = await db.promise().query(
            "SELECT DISTINCT job_title FROM users WHERE job_title IS NOT NULL AND job_title != ''"
        );
        console.log(`📊 Found ${roles.length} unique roles.`);

        for (const row of roles) {
            console.log(`Processing Role: ${row.job_title}`);
            await IvaKnowledgeGenerator.ensureContextRules('role', row.job_title);
            await new Promise(r => setTimeout(r, 1000));
        }
        console.log('✅ Backfill Complete!');
    } catch (error) {
        console.error('❌ Backfill failed:', error);
    }
};


// --- KNOWLEDGE AUDIT ENDPOINTS ---

const getPendingKnowledge = async (req, res) => {
    try {
        const { scope } = req.query;
        // If scope is provided, filter by it. If not, return all.
        // Frontend sends 'role' for layer filtering usually.
        const pending = await IvaGlobalKnowledge.getPendingKnowledge(scope);
        res.json(pending);
    } catch (error) {
        console.error('Error fetching pending knowledge:', error);
        res.status(500).json({ error: 'Erro ao buscar conhecimento pendente' });
    }
};

const approveKnowledge = async (req, res) => {
    try {
        const { id, refinedText } = req.body;
        if (!id) return res.status(400).json({ error: 'ID is required' });

        await IvaGlobalKnowledge.approveKnowledge(id, refinedText);
        res.json({ success: true, message: 'Conhecimento aprovado!' });
    } catch (error) {
        console.error('Error approving knowledge:', error);
        res.status(500).json({ error: 'Erro ao aprovar conhecimento' });
    }
};

const rejectKnowledge = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID is required' });

        await IvaGlobalKnowledge.rejectKnowledge(id);
        res.json({ success: true, message: 'Conhecimento rejeitado!' });
    } catch (error) {
        console.error('Error rejecting knowledge:', error);
        res.status(500).json({ error: 'Erro ao rejeitar conhecimento' });
    }
};


const getDebugContext = async (req, res) => {
    try {
        const user = req.user;
        const IvaUserPreferences = require('../services/IvaUserPreferences');
        const lastAccess = await IvaUserPreferences.getLastAccess(user.id);

        // FORCE FULL CONTEXT (isAutoGreeting = false) to show user what is making it heavy
        const context = await IvaContextBuilder.buildOperateContextWithQdrant(
            user,
            { name: 'DEBUG_PROJECT' },
            { screenId: 'DEBUG_MODE', pageTitle: 'Modo de Depuração' },
            [],
            'DEBUG',
            lastAccess,
            [],
            false // isAutoGreeting = false (Load EVERYTHING)
        );

        res.setHeader('Content-Type', 'text/plain');
        res.send(context);
    } catch (error) {
        console.error('Error generating debug context:', error);
        res.status(500).send('Erro ao gerar contexto: ' + error.message);
    }
};

module.exports = {
    chat,
    operate,
    backfillKnowledge,
    getPendingKnowledge,
    approveKnowledge,
    rejectKnowledge,
    getDebugContext
};


