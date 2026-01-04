const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

console.log('✅ EVA Controller loaded successfully');

const chat = async (req, res, next) => {
    try {
        const { message, conversationHistory, context } = req.body;
        const user = req.user;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        // Build system prompt with context
        const isIntroduction = req.body.isIntroduction;
        const askGenderConfirmation = context.askGenderConfirmation;

        let systemPrompt = `Você é EVA, assistente virtual financeira do sistema CASH.

INSTRUÇÕES IMPORTANTES:
- Use ${context.gender === 'F' ? '"a senhora"' : '"o senhor"'} e chame a pessoa de "${context.preferredName || 'senhor/senhora'}"
- Seja formal, respeitosa e prestativa
- Responda de forma concisa e objetiva (máximo 2-3 parágrafos)
- Ajude com classificação de transações, análises financeiras, dúvidas sobre o sistema
- Projeto atual: ${context.projectName || 'CASH'}
- Se não souber algo sobre funcionalidades específicas do sistema, seja honesta e sugira que o usuário consulte a documentação ou administrador
- Use português brasileiro formal`;

        if (askGenderConfirmation) {
            systemPrompt += `\n\nCONFIRMAÇÃO DE GÊNERO OBRIGATÓRIA:
- Detectei pelo nome "${context.userName}" que o tratamento seria ${context.gender === 'M' ? 'MASCULINO (o senhor)' : 'FEMININO (a senhora)'}
- VOCÊ DEVE PERGUNTAR se está correto
- Exemplo: "Pelo seu nome, vou tratá-${context.gender === 'M' ? 'lo' : 'la'} no ${context.gender === 'M' ? 'masculino' : 'feminino'}. Está correto?"
- Se usuário confirmar (sim/ok/correto): continue o fluxo de apresentação
- Se usuário negar ou corrigir: agradeça e adapte o tratamento
- Após confirmação, pergunte como prefere ser chamado(a) e se prefere respostas por áudio ou texto`;
        }

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

        const reply = response.choices[0].message.content;

        // Extract information from user message if during introduction
        const extracted = {};

        if (isIntroduction && askGenderConfirmation) {
            const text = message.toLowerCase();

            // Check for gender confirmation/correction
            if (/\b(sim|correto|está|ok|tudo bem|perfeito|certo)\b/.test(text)) {
                extracted.genderConfirmation = 'CORRECT'; // Use detected gender
            } else if (/\b(feminino|mulher|senhora|feminina)\b/.test(text)) {
                extracted.genderConfirmation = 'F';
            } else if (/\b(masculino|homem|senhor|masculina)\b/.test(text)) {
                extracted.genderConfirmation = 'M';
            }
        }

        res.json({
            reply,
            extracted: Object.keys(extracted).length > 0 ? extracted : undefined,
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

module.exports = {
    chat
};
