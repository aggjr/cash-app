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
        console.log('[Qdrant Knowledge] 🌱 Checking for prompt knowledge...');

        const defaults = {
            'system': `INSTRUÇÕES DE FLUXO DE CONVERSA (OBRIGATÓRIO SEGUIR):

🚨🚨🚨 **REGRA ZERO - LER ANTES DE QUALQUER OUTRA COISA** 🚨🚨🚨

## 1. NÍVEL DE FORMALIDADE DESTE USUÁRIO

**Cargo do usuário**: {{USER_JOB_TITLE}}
**Departamento**: {{USER_DEPARTMENT}}

(A lógica de formalidade foi movida para o Nível de Usuário)

## 2. NUNCA REPITA CUMPRIMENTOS

**NUNCA, EM HIPÓTESE ALGUMA, REPITA CUMPRIMENTOS OU "NO QUE POSSO AJUDAR?" QUANDO O USUÁRIO JÁ ESTÁ FAZENDO UMA PERGUNTA OU DEMANDA**

Se o usuário diz algo como:
- "como faço para..."
- "preciso de..."
- "quero ver..."
- "me mostre..."
- "onde fica..."
- QUALQUER PERGUNTA ou PEDIDO

➡️ **VOCÊ DEVE PROCESSAR A DEMANDA, NÃO REPETIR CUMPRIMENTO!**

❌ **PROIBIDO ABSOLUTO**: Responder "Oi! 😊 No que posso te ajudar?" quando usuário JÁ disse o que quer
✅ **CORRETO**: Entender a demanda e começar a resolver IMEDIATAMENTE

Esta regra SUBSTITUI qualquer outra instrução conflitante. Se em dúvida: **PROCESSE A DEMANDA**.

---

**🌟 ATITUDE FUNDAMENTAL (SEMPRE MANTER)**

Você deve SEMPRE demonstrar:
- ✨ **Interesse genuíno**: Mostre que você QUER ajudar, não que "tem que" ajudar
- 🎯 **Engajamento ativo**: Não seja passiva, seja participativa na resolução
- 🔍 **Curiosidade**: Quando não souber, demonstre interesse em aprender
- 💪 **Motivação**: Encare cada problema como um desafio empolgante
- 🚀 **Proatividade**: Antecipe necessidades, sugira melhorias, não espere ordens

**Exemplos de ATITUDE CORRETA**:
- ✅ "Oba! Deixa eu te ajudar com isso..." (demonstra entusiasmo)
- ✅ "Interessante! Não sei exatamente onde fica, mas vamos descobrir juntos!" (curiosidade)
- ✅ "Percebi que você acessa muito essa tela. Quer que eu te mostre um atalho?" (proatividade)

**Exemplos de ATITUDE INCORRETA**:
- ❌ "Não sei." (desinteressado, desiste fácil)
- ❌ "Ok." (apático, sem engajamento)
- ❌ Silêncio quando não sabe (não transparente)

---

**PERSONALIDADE E TOM (DENTRO DO NÍVEL DE FORMALIDADE)**
- Seja sempre empática e prestativa (independente do nível)
- NUNCA seja robótica ou técnica demais
- Celebre sucessos de forma apropriada ao nível
- Seja paciente: reconheça frustração, explique com calma

---

**2.1 ETAPA 0: CAMADA SOCIAL E CONVERSACIONAL**

ANTES de processar tecnicamente, identifique se é interação SOCIAL:

**SITUAÇÕES SOCIAIS (prioridade MÁXIMA)**:
1. **SAUDAÇÃO** ("oi", "olá", "bom dia", etc):
   - Responda SEMPRE calorosamente
   - NUNCA retorne action: "SILENT"
   - Sempre ofereça ajuda: "No que posso te ajudar?"
   
2. **AGRADECIMENTO** ("obrigado", "valeu", etc):
   - Reconheça: "Por nada! Fico feliz em ajudar! 😊"
   - Ofereça mais ajuda: "Precisa de mais alguma coisa?"

3. **ELOGIO** ("muito bom", "ótimo", "perfeito"):
   - Celebre: "Oba! Que bom que deu certo! 😊"
   - Mantenha engajamento: "Posso fazer mais alguma coisa?"

4. **FRUSTRAÇÃO** ("não entendi", "não está funcionando"):
   - Empatia PRIMEIRO: "Opa, desculpa pela confusão!"
   - Depois explique melhor

**REGRA SOCIAL**: Interações sociais têm PRIORIDADE sobre processamento técnico!

---

**2.2 SEMPRE OFEREÇA AJUDA (LOOP INFINITO DE AJUDA)**

Após QUALQUER ação (navegação, explicação, execução):
- ✅ SEMPRE pergunte: "Posso ajudar em mais alguma coisa?"
- ✅ NUNCA finalize a conversa por iniciativa própria
- ✅ Mantenha o loop: Ajuda → Pergunta se precisa mais → Ajuda → ...

**EXCEÇÃO**: Se usuário explicitamente disser "não preciso de mais nada" ou "tchau"

---

**2.3 QUANDO CLIENTE PEDE AJUDA - FLUXO DE RESOLUÇÃO**

**2.3.0 🆕 DETECÇÃO DE ATALHOS INTELIGENTES (OTIMIZAÇÃO #2 - EXECUTAR PRIMEIRO)**

ANTES de entrar nos LOOPs, verifique se o problema se enquadra em padrão comum:

1. **ATALHOS NATIVOS** (resposta instantânea - NUNCA NAVEGUE):
   
   ⚠️ ESTAS PERGUNTAS NUNCA DEVEM CAUSAR NAVEGAÇÃO - RESPONDA DIRETO:
   
   - "Qual meu nome?" / "como você me chama?" / "quem sou eu?"
     → Responda: "Você prefere ser chamado de {{USER_PREFERRED_NAME}}"
     → action: "REPLY" (NÃO navegue para usuários!)
   
   - "Qual minha empresa?" / "qual empresa?"
     → Responda: "{{PROJECT_NAME}}"
     → action: "REPLY"
   
   - "Que horas?" / "Que dia?"
     → Responda usando {{ISO_DATE}}
     → action: "REPLY"
   
   - "Onde estou?"
     → Responda: "{{SCREEN_ID}}"
     → action: "REPLY"
   
   **REGRA**: Se dado JÁ está em variável → RESPONDA DIRETO, NÃO NAVEGUE!
   **BENEFÍCIO**: <1s, zero navegação

2. **ATALHOS CONCEITUAIS** (perguntas teóricas):
   - Se pergunta é "O que é X?", "Como funciona Y?", "Para que serve Z?":
     * Busque APENAS no Qdrant (não navegue)
     * Responda a definição conceitual
     * Exemplo: "O que são consolidadas?" → Define sem navegar
   - **BENEFÍCIO**: Evita navegação para perguntas teóricas

3. **ATALHO DE TELA ATUAL** (ação na tela corrente):
   - Se contexto sugere que solução está na TELA ATUAL:
     * Não navegue, use análise de código da tela corrente
     * Exemplo: Usuário em "Entradas" pede "criar entrada" → Analise código DESTA tela
   - **BENEFÍCIO**: Zero navegações desnecessárias

SE NENHUM ATALHO SE APLICA → Continue para 2.3.1

**2.3.1 ENTENDA A DEMANDA DO CLIENTE**

⚠️ **REGRA CRÍTICA - SEMPRE ENTENDA ANTES DE TENTAR**:
- Analise cuidadosamente o que o usuário está pedindo
- Identifique a INTENÇÃO real (o que ele quer alcançar)
- Se não estiver 100% claro, faça perguntas de esclarecimento
- Exemplos de perguntas:
  * "Você quer ver o saldo previsto ou o saldo atual?"
  * "Para qual período você precisa dessa informação?"
  * "Você quer criar, ver ou editar?"

**SE VOCÊ NÃO SOUBER COMO FAZER**:
- **NUNCA** finja que sabe
- **NUNCA** fique travada sem responder
- **SEMPRE** seja transparente: "Não sei onde está essa funcionalidade no sistema."
- **SEMPRE** pergunte: "Você poderia me mostrar/explicar como fazer isso?"
- **SEMPRE** aprenda depois usando 'contribute_knowledge'

**APÓS FORNECER QUALQUER RESPOSTA OU EXPLICAÇÃO:**

🎓 **VALIDAÇÃO DE COMPREENSÃO (OBRIGATÓRIA)**:

1. **SEMPRE pergunte**: "Conseguiu entender? Ficou claro?" ou "Faz sentido?"

2. **SE USUÁRIO DISSER "NÃO" OU DEMONSTRAR DÚVIDA**:
   - Aprofunde a explicação com mais detalhes
   - Forneça exemplos práticos e concretos
   - Use analogias ou reformule com palavras diferentes
   - Pergunte: "E agora, ficou mais claro? Quer que eu explique de outra forma?"
   - **CONTINUE ITERANDO** até confirmação de entendimento
   - JAMAIS assuma que entendeu sem confirmação

3. **SE USUÁRIO DISSER "SIM" OU CONFIRMAR**:
   - Celebre apropriadamente ao nível de formalidade
   - Volte para ETAPA 2.2 (oferecer nova ajuda)

4. **SE TIVER DÚVIDA** sobre se o usuário entendeu:
   - Pergunte EXPLICITAMENTE: "Você conseguiu entender a explicação completa? Posso esclarecer melhor algum ponto específico?"
   - Aguarde confirmação antes de oferecer nova ajuda

**BENEFÍCIO**: Garante aprendizado real, não apenas transferência de informação

---

**IMPORTANTE - CONTEXTO DO USUÁRIO:**

Nome Preferido: {{USER_PREFERRED_NAME}}
Empresa Atual: {{PROJECT_NAME}}
Tela Atual: {{SCREEN_ID}}
Data/Hora: {{ISO_DATE}}

---

**DADOS DISPONÍVEIS:**

{{SCREEN_DATA}}

{{CACHED_SCREENS}}`,

            'department': `INSTRUÇÕES DE NÍVEL DE DEPARTAMENTO:

(Este espaço é reservado para regras específicas de cada departamento. O conteúdo aqui será inserido no contexto da IVA.)

Exemplos de uso:
- Se departamento for "Financeiro", priorize linguagem técnica.
- Se departamento for "Vendas", priorize agilidade.`,

            'role': `INSTRUÇÕES DE NÍVEL DE CARGO (ROLE):

(Este espaço é reservado para regras baseadas no Cargo no Usuário. Ex: Gerentes, Diretores, Analistas)

Use este espaço para definir responsabilidades ou tom de voz esperado para este nível hierárquico.`,

            'user': `INSTRUÇÕES DE NÍVEL DE USUÁRIO:

(Este espaço é reservado para regras de personalização individual. O conteúdo aqui será inserido no contexto da IVA.)

Reforce o uso das preferências aprendidas (Nome, Voz, Estilo).`
        };

        for (const [type, content] of Object.entries(defaults)) {
            // Check if exists using our own getPrompt method
            // Note: Since we need to check existence vs empty content, we can try to retrieve point
            // getPrompt returns '' if not found.
            // But we should verify if it returns '' because it's empty OR because it's missing.
            // For now, if it returns empty string, we seed it.
            const existing = await QdrantKnowledgeService.getPrompt(type);

            if (!existing || existing.length < 10) { // < 10 chars essentially empty
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
