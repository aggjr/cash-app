const OpenAI = require('openai');
const AppError = require('../utils/AppError');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

exports.chat = async (req, res, next) => {
    try {
        const { message, conversationHistory, context } = req.body;
        const user = req.user;

        if (!message || !message.trim()) {
            throw new AppError('VAL-002', 'Mensagem é obrigatória');
        }

        // Build system prompt with context
        const systemPrompt = `Você é EVA, assistente virtual financeira do sistema CASH.

INSTRUÇÕES IMPORTANTES:
- Use ${context.gender === 'F' ? '"a senhora"' : '"o senhor"'} e chame a pessoa de "${context.preferredName || 'senhor/senhora'}"
- Seja formal, respeitosa e prestativa
- Responda de forma concisa e objetiva (máximo 2-3 parágrafos)
- Ajude com classificação de transações, análises financeiras, dúvidas sobre o sistema
- Projeto atual: ${context.projectName || 'CASH'}
- Se não souber algo sobre funcionalidades específicas do sistema, seja honesta e sugira que o usuário consulte a documentação ou administrador
- Use português brasileiro formal`;

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

        res.json({
            reply: response.choices[0].message.content,
            usage: {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens
            }
        });

    } catch (error) {
        console.error('EVA Chat Error:', error);

        if (error.code === 'insufficient_quota') {
            return next(new AppError('EXT-001', 'Limite de uso da API OpenAI atingido'));
        }

        if (error.code === 'invalid_api_key') {
            return next(new AppError('CONFIG-001', 'Chave API OpenAI inválida'));
        }

        next(error);
    }
};
