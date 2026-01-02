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
        const [userResult, projectResult] = await Promise.all([
            db.query('SELECT * FROM users WHERE id = $1', [user.id]),
            context.projectId ? db.query('SELECT * FROM projects WHERE id = $1', [context.projectId]) : Promise.resolve({ rows: [] })
        ]);

        const userData = userResult.rows[0] || user;
        const projectData = projectResult.rows[0] || {};

        // Build system prompt using 3-level architecture
        const systemPrompt = EvaContextBuilder.buildChatContext(userData, projectData, { isIntroduction });

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
FORMATO DE RESPOSTA(JSON OBRIGATÓRIO):
Retorne APENAS um objeto JSON válido.

                Exemplos:
            User: "Abra a tela de contas"
            JSON: { "action": "NAVIGATE", "target": "contas" }

            User: "Preencha o valor com 500"(Estando na tela de entrada)
            JSON: { "action": "FILL_FORM", "fields": { "income-valor": "500" } }
            (Nota: Use o ID exato dos campos listados no Contexto Local.Se o usuário falar "valor" e o ID for "income-valor", faça o mapeamento).

                User: "Salvar"
            JSON: { "action": "CLICK_ACTION", "selector": "#btn-save" } (Pegue o selector das ações locais)

            User: "Pode fazer um tour do sistema?"
            JSON: { "action": "START_TOUR", "mode": "full", "message": "Claro! Vou guiá-lo por todo o sistema. Escolha:\n1 - Visão Geral (2-3 min)\n2 - Tour Completo (10-15 min)" }

            User: "Mostre o sistema" / "Apresente as telas" / "Conhecer funcionalidades"
            JSON: { "action": "START_TOUR", "mode": "full", "message": "Com prazer! Posso mostrar:\n1 - Tour rápido (2-3 min)\n2 - Tour detalhado (10-15 min)\n\nDigite 1 ou 2." }

            User: "Pode falar mais rápido?"
            JSON: { "action": "SET_VOICE_RATE", "value": ${ Math.min(100, currentVoiceRate + 15) }, "message": "Claro! Aumentando velocidade (+15). 🚀" }

            User: "Muito mais rápido ainda"
            JSON: { "action": "SET_VOICE_RATE", "value": ${ Math.min(100, currentVoiceRate + 30) }, "message": "Entendido! Bem mais rápido agora (+30)." }

            User: "Volta um pouquinho/Mais devagar"
            JSON: { "action": "SET_VOICE_RATE", "value": ${ Math.max(0, currentVoiceRate - 10) }, "message": "OK! Diminuindo levemente (-10)." }

            User: "Fale normal"
            JSON: { "action": "SET_VOICE_RATE", "value": 50, "message": "Voltando para velocidade normal. 👍" }

            User: "Grave essa velocidade como padrão" / "Salve essa configuração"
            JSON: { "action": "REPLY", "message": "Pode deixar! Essa configuração já foi salva automaticamente no seu perfil. 😉" }

            User: "Prefiro voz masculina"
            JSON: { "action": "SET_VOICE_GENDER", "isMale": true, "message": "Perfeito! Mudando para voz masculina." }

            User: "Desative o áudio"
            JSON: { "action": "SET_VOICE_ENABLED", "enabled": false, "message": "Entendido! Responderei apenas com texto." }

            User: "Quantos usuários estão na tabela?"(Com dados visíveis)
            JSON: { "action": "REPLY", "message": "Há X usuários cadastrados, mostrando Y na tela." }

            User: "Como faço um pix?"
            JSON: { "action": "REPLY", "message": "Para fazer um pix, vá em Saídas e selecione o tipo PIX." }

Se o usuário pedir para preencher algo que não existe na tela atual, responda com REPLY explicando o erro.`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.1, // Low temperature for deterministic actions
            response_format: { type: "json_object" },
            max_tokens: 300
        });

        const actionJson = JSON.parse(response.choices[0].message.content);
        console.log('[EVA Operate] Decision:', actionJson);

        res.json(actionJson);

    } catch (error) {
        console.error('EVA Operate Error:', error);
        res.status(500).json({ error: 'Erro ao processar operação', details: error.message });
    }
};

module.exports = {
    chat,
    operate
};
