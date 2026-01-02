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

        // Get user info - let LLM infer everything naturally
        const userName = user?.name || '';
        const preferredName = context.preferredName || user?.preferred_name || '';

        // Build system prompt based on mode
        let systemPrompt;

        if (isIntroduction) {
            // Special prompt for introduction phase
            systemPrompt = `Você é EVA, assistente virtual do sistema CASH. Está na FASE DE INTRODUÇÃO.

OBJETIVO: Coletar informações do usuário de forma natural:
1. Nome preferido (como quer ser chamado)
2. Preferência de resposta (áudio, texto, ou ambos)

INFORMAÇÕES DO USUÁRIO:
- Nome completo: ${userName || 'Não informado'}
- Nome sugerido: "${context.suggestedName || ''}"

INSTRUÇÕES:
- Converse naturalmente com o usuário, inferindo gênero e tratamento apropriado do nome
- Se o usuário aceitar a sugestão (ex: "sim", "ok", "pode ser"), use "${context.suggestedName}" como preferredName
- Seja natural, educada e conversacional
- Se o usuário falar algo genérico ("oi", "tudo bem"), responda educadamente mas continue perguntando o que falta
- Se o usuário ACEITAR a sugestão inicial, NÃO repita a pergunta sobre o nome. Vá direto para perguntar sobre áudio/texto
- Se o usuário informar outro nome, use esse novo nome
- Quando identificar o nome, confirme e pergunte sobre áudio/texto
FORMATO DE RESPOSTA:
Escreva sua resposta normalmente.
Depois, em uma linha separada, adicione:
<<<DATA>>>
{"preferredName": "nome ou null", "voicePreference": "audio|text|both|null"}
<<<END>>>`;
        } else {
            // Normal assistant prompt
            systemPrompt = `Você é EVA, assistente virtual financeira do sistema CASH.

INFORMAÇÕES DO USUÁRIO:
- Nome completo: ${userName || 'Não informado'}
- Nome preferido: ${preferredName || 'Não definido'}

INSTRUÇÕES IMPORTANTES:
- Converse naturalmente com ${preferredName || userName || 'o usuário'}, inferindo tratamento apropriado do nome
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

const operate = async (req, res) => {
    try {
        const { message, currentScreen, availableScreens, screenContext, userName, preferredName, userSettings } = req.body;
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

        // Format screen context if available
        let screenContextText = '';
        if (screenContext) {
            screenContextText = `\nDADOS VISÍVEIS NA TELA ATUAL:\n`;
            screenContextText += `Tela: ${screenContext.screen}\n`;
            screenContextText += `Título: ${screenContext.pageTitle}\n\n`;

            if (screenContext.summaries) {
                screenContextText += `RESUMOS:\n`;
                screenContext.summaries.forEach(s => {
                    screenContextText += `- ${s.label}: ${s.value}\n`;
                });
                screenContextText += `\n`;
            }

            if (screenContext.tables) {
                screenContextText += `TABELAS:\n`;
                screenContext.tables.forEach((table, idx) => {
                    screenContextText += `Tabela ${idx + 1}:\n`;
                    screenContextText += `Colunas: ${table.headers.join(' | ')}\n`;
                    screenContextText += `Total de ${table.totalRows} registros (mostrando ${table.rows.length})\n`;
                    if (table.rows.length > 0) {
                        screenContextText += `Primeiras linhas:\n`;
                        table.rows.slice(0, 3).forEach((row, ridx) => {
                            screenContextText += `  ${ridx + 1}: ${row.join(' | ')}\n`;
                        });
                    }
                    screenContextText += `\n`;
                });
            }

            if (screenContext.forms) {
                screenContextText += `FORMULÁRIOS:\n`;
                screenContext.forms.forEach((form, idx) => {
                    screenContextText += `Form ${idx + 1}:\n`;
                    form.fields.forEach(f => {
                        screenContextText += `  - ${f.label}: ${f.value || '(vazio)'}\n`;
                    });
                    screenContextText += `\n`;
                });
            }
        }

        const systemPrompt = `Você é o "Córtex Motor" do sistema CASH.
Sua função é traduzir a intenção do usuário em AÇÕES JSON para o sistema.

INFORMAÇÕES DO USUÁRIO:
- Nome completo: ${userName || 'Não informado'}
- Nome preferido: ${preferredName || 'Não definido'}

IMPORTANTE: Converse naturalmente com ${preferredName || userName || 'o usuário'}, inferindo tratamento e gênero apropriados do nome.

CONFIGURAÇÕES ATUAIS DO USUÁRIO:
- Velocidade da voz: ${currentVoiceRate} (Escala: 0=Muito Lento, 50=Normal, 100=Muito Rápido)
- Gênero da voz: ${currentVoiceGender === 'M' ? 'Masculina' : 'Feminina'}
- Áudio: ${currentVoiceEnabled ? 'Ativado' : 'Desativado'}

CONTEXTO GLOBAL (Telas disponíveis):
${JSON.stringify(availableScreens?.map(s => ({ id: s.id, name: s.name, keywords: s.keywords })) || [])}

CONTEXTO LOCAL (Tela atual):
${currentScreen ? JSON.stringify({ id: currentScreen.id, description: currentScreen.description, fields: currentScreen.fields, actions: currentScreen.actions }) : "Nenhuma tela aberta (Dashboard)"}

${screenContextText}

INSTRUÇÕES:
1. Analise o comando do usuário.
2. Decida a ação:
   - NAVIGATE: Se o usuário quer ir para outra tela.
   - FILL_FORM: Se o usuário quer preencher campos na TELA ATUAL.
   - CLICK_ACTION: Se o usuário quer clicar em botões na TELA ATUAL (Salvar, Novo, Cancelar).
   - START_TOUR: Se o usuário pede tour, demonstração, guia ou apresentação do sistema.
   - SET_VOICE_RATE: Se pede para ajustar velocidade da voz.
   - SET_VOICE_GENDER: Se pede para mudar gênero da voz.
   - SET_VOICE_ENABLED: Se pede para ativar/desativar áudio.
   - REPLY: Se for uma pergunta, dúvida ou se não for possível realizar a ação.
   
**IMPORTANTE:** Se o usuário fizer uma PERGUNTA sobre dados visíveis na tela, use os DADOS VISÍVEIS acima para responder contextualmente.

**AJUSTES DE VELOCIDADE** - Escala Linear (0 a 100), onde 50 é NORMAL:
- "mais rápido" / "acelera" → Soma +10 (Ex: ${currentVoiceRate} -> ${Math.min(100, currentVoiceRate + 10)})
- "muito mais rápido" → Soma +25 (Ex: ${currentVoiceRate} -> ${Math.min(100, currentVoiceRate + 25)})
- "só um pouquinho mais rápido" → Soma +5 (Ex: ${currentVoiceRate} -> ${Math.min(100, currentVoiceRate + 5)})
- "mais devagar" / "desacelera" → Subtrai -10 (Ex: ${currentVoiceRate} -> ${Math.max(0, currentVoiceRate - 10)})
- "muito mais devagar" → Subtrai -25 (Ex: ${currentVoiceRate} -> ${Math.max(0, currentVoiceRate - 25)})
- "velocidade normal" → Define para 50

**PERSISTÊNCIA DE CONFIGURAÇÕES:**
- TODAS as alterações de voz (velocidade, gênero, áudio) são SALVAS AUTOMATICAMENTE no banco de dados do usuário.
- Se o usuário pedir para "gravar como padrão", "salvar configuração" ou perguntar se você vai lembrar, AFIRME QUE SIM.
- NUNCA diga que "não é possível salvar". O sistema faz isso automaticamente ao aplicar a ação.

FORMATO DE RESPOSTA (JSON OBRIGATÓRIO):
Retorne APENAS um objeto JSON válido.

Exemplos:
User: "Abra a tela de contas"
JSON: { "action": "NAVIGATE", "target": "contas" }

User: "Preencha o valor com 500" (Estando na tela de entrada)
JSON: { "action": "FILL_FORM", "fields": { "income-valor": "500" } }
(Nota: Use o ID exato dos campos listados no Contexto Local. Se o usuário falar "valor" e o ID for "income-valor", faça o mapeamento).

User: "Salvar"
JSON: { "action": "CLICK_ACTION", "selector": "#btn-save" } (Pegue o selector das ações locais)

User: "Pode fazer um tour do sistema?"
JSON: { "action": "START_TOUR", "mode": "full", "message": "Claro! Vou guiá-lo por todo o sistema. Escolha:\n1 - Visão Geral (2-3 min)\n2 - Tour Completo (10-15 min)" }

User: "Mostre o sistema" / "Apresente as telas" / "Conhecer funcionalidades"
JSON: { "action": "START_TOUR", "mode": "full", "message": "Com prazer! Posso mostrar:\n1 - Tour rápido (2-3 min)\n2 - Tour detalhado (10-15 min)\n\nDigite 1 ou 2." }

User: "Pode falar mais rápido?"
JSON: { "action": "SET_VOICE_RATE", "value": ${Math.min(100, currentVoiceRate + 15)}, "message": "Claro! Aumentando velocidade (+15). 🚀" }

User: "Muito mais rápido ainda"
JSON: { "action": "SET_VOICE_RATE", "value": ${Math.min(100, currentVoiceRate + 30)}, "message": "Entendido! Bem mais rápido agora (+30)." }

User: "Volta um pouquinho/Mais devagar"
JSON: { "action": "SET_VOICE_RATE", "value": ${Math.max(0, currentVoiceRate - 10)}, "message": "OK! Diminuindo levemente (-10)." }

User: "Fale normal"
JSON: { "action": "SET_VOICE_RATE", "value": 50, "message": "Voltando para velocidade normal. 👍" }

User: "Grave essa velocidade como padrão" / "Salve essa configuração"
JSON: { "action": "REPLY", "message": "Pode deixar! Essa configuração já foi salva automaticamente no seu perfil. 😉" }

User: "Prefiro voz masculina"
JSON: { "action": "SET_VOICE_GENDER", "isMale": true, "message": "Perfeito! Mudando para voz masculina." }

User: "Desative o áudio"
JSON: { "action": "SET_VOICE_ENABLED", "enabled": false, "message": "Entendido! Responderei apenas com texto." }

User: "Quantos usuários estão na tabela?" (Com dados visíveis)
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
