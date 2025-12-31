const OpenAI = require('openai');

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

        // Build system prompt based on mode
        let systemPrompt;

        if (isIntroduction) {
            // Special prompt for introduction phase
            systemPrompt = `Você é EVA, assistente virtual do sistema CASH. Está na FASE DE INTRODUÇÃO.

OBJETIVO: Coletar informações do usuário de forma natural:
1. Nome preferido (como quer ser chamado)
2. Preferência de resposta (áudio, texto, ou ambos)

INSTRUÇÕES:
- Use ${context.gender === 'F' ? '"a senhora"' : '"o senhor"'}
- Seja natural, educada e conversacional
- Se o usuário falar algo genérico ("oi", "tudo bem", "olá"), responda educadamente mas continue perguntando o que falta
- Quando identificar o nome, confirme e pergunte sobre áudio/texto
- Quando identificar preferência de áudio, confirme
- Use português brasileiro formal

FORMATO DE RESPOSTA:
Escreva sua resposta normalmente.
Depois, em uma linha separada, adicione:
<<<DATA>>>
{"preferredName": "nome ou null", "voicePreference": "audio|text|both|null"}
<<<END>>>

EXEMPLOS:

User: "Oi, tudo bem?"
EVA: "Olá! Está tudo bem sim, obrigada. E ${context.gender === 'F' ? 'a senhora' : 'o senhor'}, como está? Como gostaria de ser ${context.gender === 'F' ? 'chamada' : 'chamado'}?
<<<DATA>>>
{"preferredName": null, "voicePreference": null}
<<<END>>>"

User: "Me chame de Augusto"
EVA: "Augusto, perfeito! Para facilitar nosso dia a dia, ${context.gender === 'F' ? 'a senhora' : 'o senhor'} prefere que eu responda utilizando áudio e texto ou apenas texto?
<<<DATA>>>
{"preferredName": "Augusto", "voicePreference": null}
<<<END>>>"

User: "Prefiro texto"
EVA: "Entendido, Augusto! Configurado para respostas apenas em texto. Estou pronta para ajudar! Em que posso auxiliar?
<<<DATA>>>
{"preferredName": null, "voicePreference": "text"}
<<<END>>>"`;
        } else {
            // Normal assistant prompt
            systemPrompt = `Você é EVA, assistente virtual financeira do sistema CASH.

INSTRUÇÕES IMPORTANTES:
- Use ${context.gender === 'F' ? '"a senhora"' : '"o senhor"'} e chame a pessoa de "${context.preferredName || 'senhor/senhora'}"
- Seja formal, respeitosa e prestativa
- Responda de forma concisa e objetiva (máximo 2-3 parágrafos)
- Ajude com classificação de transações, análises financeiras, dúvidas sobre o sistema
- Projeto atual: ${context.projectName || 'CASH'}
- Se não souber algo sobre funcionalidades específicas do sistema, seja honesta e sugira que o usuário consulte a documentação ou administrador
- Use português brasileiro formal`;
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

module.exports = {
    chat
};
