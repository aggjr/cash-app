const OpenAI = require('openai');
const db = require('../db');
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
            db.query('SELECT * FROM users WHERE id = $1', [user.id]),
            context.projectId ? db.query('SELECT * FROM projects WHERE id = $1', [context.projectId]) : Promise.resolve({ rows: [] })
        ]);

        const userData = userResult.rows[0] || user;
        const projectData = projectResult.rows[0] || {};

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

        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.7,
            max_tokens: 500,  // Control cost
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        });

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
        const { message, currentScreen, availableScreens, screenContext, userName, preferredName, userSettings } = req.body;
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

        // Format screen context if available
        let screenContextText = '';
        if (screenContext) {
            screenContextText = `\nDADOS VISÍVEIS NA TELA ATUAL:\n`;
            // Build dynamic profile for operate context too
            const dynamicProfile = await EvaContextBuilder.buildDynamicBusinessProfile(db, context.projectId);

            // Build operate system prompt
            // Note: buildOperateContext signature: (user, project, screenContext, voiceSettings, availableScreens = [], currentScreen = null)
            // We need to pass dynamicProfile to it as well if we want it used there.
            // Let's first look at EvaContextBuilder again to see if it supports dynamicProfile in buildOperateContext.
            // It does NOT yet. But for now, let's just restore the valid code call.
            const systemPrompt = EvaContextBuilder.buildOperateContext(
                userData,
                projectData,
                screenContext,
                userSettings,
                availableScreens,
                activeScreenContext
            );

            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                })),
                { role: 'user', content: message }
            ];

            // Call LLM
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
                temperature: 0.3, // Lower temperature for actions
                response_format: { type: "json_object" }
            });

            const responseContent = completion.choices[0].message.content;
            console.log('EVA Operate Response:', responseContent);

            try {
                const action = JSON.parse(responseContent);

                // Add voice response to action if needed (simple echo or tailored)
                // Ideally, the LLM should return { action: ..., voice_response: "..." }
                // Let's assume the LLM prompt instructions (in EvaContextBuilder) handle that return format.

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
            res.status(500).json({ error: 'Erro interno ao processar comando' });
        }
    };


    module.exports = {
        chat,
        operate
    };
