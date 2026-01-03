const OpenAI = require('openai');
const db = require('../config/database');
const EvaContextBuilder = require('../services/EvaContextBuilder');

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

        // Fetch hierarchical context from DB
        // 1. User preferences (Level 3)
        // 2. Project context (Level 2)
        // 3. Dynamic Business Profile (Inferred)
        const [userResult, projectResult] = await Promise.all([
            db.query('SELECT * FROM users WHERE id = ?', [user.id]),
            context.projectId ? db.query('SELECT * FROM projects WHERE id = ?', [context.projectId]) : Promise.resolve([[]])
        ]);

        const userData = userResult[0][0] || user;
        const projectData = projectResult[0][0] || {};

        // Build dynamic profile purely from transaction data (NEW)
        const dynamicProfile = await EvaContextBuilder.buildDynamicBusinessProfile(db, context.projectId);

        // Build system prompt using 3-level architecture + Dynamic Profile
        const systemPrompt = EvaContextBuilder.buildChatContext(userData, projectData, dynamicProfile, { isIntroduction });

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
        const { message, currentScreen, availableScreens, screenContext, userName, preferredName, userSettings, context, conversationHistory } = req.body;
        const user = req.user;

        console.log('[EVA Operate] Processing:', message);
        console.log('[EVA Operate] Screen:', currentScreen?.id);
        console.log('[EVA Operate] User:', userName, preferredName);
        console.log('[EVA Operate] Has screen context:', !!screenContext);

        if (!message) {
            return res.status(400).json({ error: 'Mensagem e contexto são obrigatórios' });
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

        // Fetch User and Project Data for Context
        // Similar to chat, we ideally need projectData. 
        // For now, let's assume partial data is fine or fetch it if needed. 
        // Given we need project name etc in generic context, let's fetch strictly if context.projectId exists.

        let projectData = {};
        let userData = user;

        if (context?.projectId) {
            const [rows] = await db.query('SELECT * FROM projects WHERE id = ?', [context.projectId]);
            projectData = rows[0] || {};
        }

        // Build dynamic profile for operate context
        const dynamicProfile = await EvaContextBuilder.buildDynamicBusinessProfile(db, context?.projectId);

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
            db // Pass db connection for unified context
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
