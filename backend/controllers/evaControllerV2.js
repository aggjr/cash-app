const OpenAI = require('openai');
const db = require('../config/database');
const EvaContextBuilder = require('../services/EvaContextBuilder');
const EvaIntentValidator = require('../utils/evaIntentValidator');
const EvaDataFetcher = require('../services/EvaDataFetcher');
const EvaScreenCache = require('../services/EvaScreenCache');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

console.log('✅ EVA Controller loaded successfully');

const chat = async (req, res, next) => {
    try {
        const { message, conversationHistory, context, isIntroduction } = req.body;
        const user = req.user;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        // Validate intent before calling LLM (security layer)
        const validation = EvaIntentValidator.validate(message);
        if (!validation.valid) {
            console.log(`[EVA Security] Blocked ${validation.reason}:`, message.substring(0, 50));
            return res.json({
                reply: validation.response,
                validationError: validation.reason
            });
        }

        // ========================================
        // DEBUG: User Data Loading
        // ========================================
        console.log('[EVA Chat] Step 1 - req.user:', JSON.stringify({
            id: user?.id,
            name: user?.name,
            email: user?.email,
            preferred_name: user?.preferred_name
        }));

        // Fetch hierarchical context from DB
        const [userResult, projectResult] = await Promise.all([
            db.query('SELECT * FROM users WHERE id = ?', [user.id]),
            context.projectId ? db.query('SELECT * FROM projects WHERE id = ?', [context.projectId]) : Promise.resolve([[]])
        ]);

        console.log('[EVA Chat] Step 2 - DB Query Result:', JSON.stringify({
            userResultLength: userResult?.length,
            userResultFirstLength: userResult?.[0]?.length,
            userData: userResult?.[0]?.[0] ? {
                id: userResult[0][0].id,
                name: userResult[0][0].name,
                preferred_name: userResult[0][0].preferred_name,
                job_title: userResult[0][0].job_title,
                department: userResult[0][0].department
            } : 'NO DATA'
        }));

        const userData = userResult[0][0] || user;
        const projectData = projectResult[0][0] || {};

        console.log('[EVA Chat] Step 3 - Final userData:', JSON.stringify({
            id: userData?.id,
            name: userData?.name,
            preferred_name: userData?.preferred_name,
            job_title: userData?.job_title,
            department: userData?.department
        }));

        // Build dynamic profile
        const dynamicProfile = await EvaContextBuilder.buildDynamicBusinessProfile(db, context.projectId);

        // Build system prompt
        const systemPrompt = await EvaContextBuilder.buildChatContext(userData, projectData, dynamicProfile, { isIntroduction });

        console.log('[EVA Chat] Step 4 - System Prompt Length:', systemPrompt?.length);
        console.log('[EVA Chat] Step 4 - Prompt contains name?', systemPrompt?.includes(userData?.name || 'NOTFOUND'));

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

        // Call OpenAI API with 60-second timeout
        const response = await Promise.race([
            openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                temperature: 0.7,
                max_tokens: 500,
                presence_penalty: 0.1,
                frequency_penalty: 0.1
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('OpenAI request timeout (60s)')), 60000)
            )
        ]);

        const llmResponse = response.choices[0].message.content;

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
        console.error('EVA Chat Error:', error);

        if (error.code === 'insufficient_quota') {
            return res.status(429).json({ error: 'Limite de uso da API OpenAI atingido' });
        }

        if (error.code === 'invalid_api_key') {
            return res.status(500).json({ error: 'Chave API OpenAI inválida' });
        }

        res.status(500).json({ error: 'Erro ao processar mensagem' });
    }
};

const operate = async (req, res) => {
    try {
        const { message, conversationHistory, context, screenContext, currentScreen, availableScreens, userSettings } = req.body;
        const user = req.user;

        // EXTENSIVE DEBUG LOGGING
        console.log('[EVA Operate] ========== REQUEST DEBUG ==========');
        console.log('[EVA Operate] Processing:', message);
        console.log('[EVA Operate] req.body keys:', Object.keys(req.body));
        console.log('[EVA Operate] context:', JSON.stringify(context, null, 2));
        console.log('[EVA Operate] screenContext (root):', screenContext?.screenId);
        console.log('[EVA Operate] context.screenContext:', context?.screenContext?.screenId);
        console.log('[EVA Operate] currentScreen:', currentScreen?.id);
        console.log('[EVA Operate] req.user:', JSON.stringify({
            id: user?.id,
            name: user?.name,
            preferred_name: user?.preferred_name
        }));
        console.log('[EVA Operate] Has activeScreenContext:', !!req.body.activeScreenContext);
        console.log('[EVA Operate] ====================================');

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        // Validate intent before calling LLM (security layer)
        const validation = EvaIntentValidator.validate(message);
        if (!validation.valid) {
            console.log(`[EVA Security] Blocked ${validation.reason}:`, message.substring(0, 50));
            return res.json({
                action: { action: 'REPLY' },
                message: validation.response,
                validationError: validation.reason
            });
        }

        // Extract user voice settings
        const currentVoiceRate = userSettings?.evaVoiceRate || 88;
        const currentVoiceGender = userSettings?.evaVoiceMale ? 'M' : 'F';
        const currentVoiceEnabled = userSettings?.evaVoiceEnabled !== 0;

        // Get state and time context
        const evaIntroduced = user?.eva_introduced || false;
        const now = new Date();
        const hour = now.getHours();
        const timeOfDay = hour >= 5 && hour < 12 ? 'manhã' : hour >= 12 && hour < 19 ? 'tarde' : 'noite';

        // ========================================
        // DEBUG: User Data Loading (Operate)
        // ========================================
        console.log('[EVA Operate] Step 1 - req.user:', JSON.stringify({
            id: user?.id,
            name: user?.name,
            email: user?.email,
            preferred_name: user?.preferred_name
        }));

        // Fetch User and Project Data from DB
        const [userResult, projectResult] = await Promise.all([
            db.query('SELECT * FROM users WHERE id = ?', [user.id]),
            context?.projectId ? db.query('SELECT * FROM projects WHERE id = ?', [context.projectId]) : Promise.resolve([[]])
        ]);

        console.log('[EVA Operate] Step 2 - DB Query Result:', JSON.stringify({
            userResultLength: userResult?.length,
            userResultFirstLength: userResult?.[0]?.length,
            userData: userResult?.[0]?.[0] ? {
                id: userResult[0][0].id,
                name: userResult[0][0].name,
                preferred_name: userResult[0][0].preferred_name,
                job_title: userResult[0][0].job_title,
                department: userResult[0][0].department
            } : 'NO DATA'
        }));

        const userData = userResult[0][0] || user;
        const projectData = projectResult[0][0] || {};

        console.log('[EVA Operate] Step 3 - Final userData:', JSON.stringify({
            id: userData?.id,
            name: userData?.name,
            preferred_name: userData?.preferred_name,
            job_title: userData?.job_title,
            department: userData?.department
        }));

        // ========================================
        // SCREEN CONTEXT: Fetch complete data based on filters
        // ========================================
        let screenData = null;
        let cachedScreens = [];

        if (context?.screenContext) {
            console.log('[EVA Operate] Screen Context Received:', {
                screenId: context.screenContext.screenId,
                filters: context.screenContext.filters
            });

            try {
                // Fetch complete data from DB with same filters
                screenData = await EvaDataFetcher.fetchScreenData(
                    db,
                    context.screenContext.screenId,
                    context.screenContext.filters,
                    context.projectId
                );

                // Cache the data
                if (screenData) {
                    EvaScreenCache.set(user.id, context.projectId, screenData.screenId, screenData);
                    console.log('[EVA Operate] Cached screen data:', screenData.screenId);
                }

                // Get most accessed screens for cross-analysis
                cachedScreens = EvaScreenCache.getMostAccessed(user.id, context.projectId, 3);
                console.log('[EVA Operate] Most accessed screens:', cachedScreens.map(s => s.screenId));

            } catch (error) {
                console.error('[EVA Operate] Error fetching screen data:', error);
                // Continue without screen data
            }
        }

        // Build dynamic profile
        const dynamicProfile = await EvaContextBuilder.buildDynamicBusinessProfile(db, context?.projectId);

        // Build screen data context
        const screenDataContext = EvaContextBuilder.buildScreenDataContext(screenData, cachedScreens);

        // Build operate system prompt
        const systemPrompt = await EvaContextBuilder.buildOperateContext(
            userData,
            projectData,
            screenContext,
            userSettings,
            availableScreens,
            currentScreen || null,
            dynamicProfile,
            req.body.activeScreenContext || null,
            db, // Pass db connection for unified context
            screenDataContext // NEW: Screen data formatted for LLM
        );

        const history = conversationHistory || [];
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant', // Map sender to role
                content: msg.text
            })),
            { role: 'user', content: message }
        ];

        // Call LLM with 60-second timeout protection
        const completion = await Promise.race([
            openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
                temperature: 0.3, // Lower temperature for actions
                response_format: { type: "json_object" }
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('OpenAI request timeout (60s)')), 60000)
            )
        ]);

        const responseContent = completion.choices[0].message.content;
        console.log('EVA Operate Response:', responseContent);

        if (!responseContent) {
            throw new Error('OpenAI returned empty response');
        }

        try {
            let action = JSON.parse(responseContent);

            // NORMALIZE LLM OUTPUT
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

            res.json(action);
        } catch (e) {
            console.error('Failed to parse EVA operate JSON:', e);
            res.status(500).json({
                error: 'Falha ao processar comando',
                raw: responseContent
            });
        }

    } catch (error) {
        console.error('EVA Operate Error:', error);
        console.error('Request Body Slice:', JSON.stringify(req.body).slice(0, 500)); // Log safe amount
        res.status(500).json({ error: 'Erro interno ao processar comando' });
    }
};


module.exports = {
    chat,
    operate
};
