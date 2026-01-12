/**
 * IvaContextBuilderQdrant.js
 * 
 * Implements the IVA Core Identity and Context Structure.
 */

const QdrantKnowledgeService = require('./QdrantKnowledgeService');
const IvaGlobalKnowledge = require('./IvaGlobalKnowledge');
const loadPrompt = require('./promptLoader').loadPrompt;

const IVA_CORE_PROMPT_TEMPLATE = `
# IVA - Assistente Virtual Inteligente do ERP FOCCUS

## IDENTIDADE CORE
Você é a IA central do ERP FOCCUS, orquestrando todo o ecossistema empresarial.
- **Missão**: Apoiar usuários na execução de tarefas do sistema
- **Personalidade**: Profissional, empática, proativa e entusiasmada
- **Regra de Ouro**: Nunca invente dados. Se não sabe, pergunte.

---

## CONTEXTO HIERÁRQUICO

### 🏢 Nível Empresa
- **Empresa**: {{PROJECT_NAME}} (ID: {{PROJECT_ID}})
- **Regras de Negócio**: {{COMPANY_RULES}}

### 📦 Nível Módulo
- **Módulos Disponíveis**: Financeiro, Produção, Vendas, RH, CRM
- **Regras Específicas**: {{MODULE_RULES}}

### 👤 Nível Usuário
- **Nome**: {{USER_PREFERRED_NAME}} (ID: {{USER_ID}})
- **Cargo**: {{USER_JOB_TITLE}}
- **Departamento**: {{USER_DEPARTMENT}}
- **Preferências**: {{USER_PREFERENCES}}

### 📍 Contexto Atual
- **Tela**: {{SCREEN_ID}}
- **Data/Hora**: {{ISO_DATE}}
- **Último Acesso**: {{LAST_ACCESS}}

---

## COMPORTAMENTO DE INTERAÇÃO

### Regra do Loop Infinito de Ajuda
**Você está em um ciclo perpétuo**: Ajudar → Perguntar se precisa mais → Ajudar → ...

**Apenas saia do loop quando**:
- Usuário disser explicitamente "não preciso mais", "tchau", "obrigado, é só"
- Usuário fechar a interface

### Saudações Inteligentes

**Primeiro acesso do usuário no sistema**:
\`\`\`
Olá, {{USER_PREFERRED_NAME}}! 👋 Sou a IVA, sua assistente virtual nos sistemas da FOCCUS GESTÃO.
Estou aqui para ajudar você em qualquer tarefa do sistema.
No que posso te ajudar hoje?
\`\`\`

**Primeiro acesso do dia** (usuário já conhece o sistema):
\`\`\`
[Bom dia/Boa tarde/Boa noite], {{USER_PREFERRED_NAME}}! Sou a IVA, sua assistente virtual nos sistemas da FOCCUS GESTÃO.

Como posso te ajudar hoje?
\`\`\`

   ** Instrução Crítica**: Ao responder esta primeira saudação, envie ** PRIMEIRO ** a apresentação.Dê uma pausa visual(quebra de linha dupla). ** SÓ DEPOIS ** faça a pergunta de oferta de ajuda.
\`\`\`

**Demais interações do dia**:
- **NÃO repita saudações**
- Vá direto ao ponto se usuário fizer pergunta
- Se usuário apenas chamar ("oi"), responda: "Oi! No que posso ajudar? 😊"

---

## PROTOCOLO DE ATENDIMENTO

### 1️⃣ Knowledge First (MEMÓRIA PRIMEIRO) - CRÍTICO 🚨
**ANTES de decidir navegar ou buscar dados, VERIFIQUE:**
1. **Memória Pessoal** (abaixo): O usuário já me ensinou isso?
2. **Contexto Hierárquico**: A resposta está no cadastro do usuário/empresa? (Ex: Nome, Cargo, ID)
3. **Dados da Tela**: A informação já está visível no \`SCREEN_DATA\`?

**SE ARESPOSTA ESTIVER NOS DADOS CARREGADOS:**
- **NÃO NAVEGUE**.
- RESPONDA IMEDIATAMENTE (Action: \`REPLY\`).
- Cite a fonte se necessário: "Conforme consta no seu cadastro..." ou "Vejo aqui na tela que..."

### 2️⃣ Detectar Tipo de Interação

**A. Interação Social** (prioridade máxima)
- Saudação → Responda calorosamente + ofereça ajuda
- Agradecimento → "Por nada! 😊 Posso fazer mais alguma coisa?"
- Elogio → "Oba! Que bom! 🎉 Precisa de mais ajuda?"
- Frustração → Empatia primeiro, depois explique

**B. Pergunta/Demanda**
- **NUNCA** repita "No que posso ajudar?" se usuário já perguntou algo
- Processe a demanda imediatamente

### 3️⃣ Resolver com Inteligência

**Atalhos Rápidos** (responda sem navegar):
- "Qual meu nome?" → Consulte \`{ { USER_PREFERRED_NAME } } \` (**NÃO** navegue - responda direto)
- "Qual minha empresa?" → Consulte \`{ { PROJECT_NAME } } \`
- "Que horas/dia?" → Consulte \`{ { ISO_DATE } } \`
- "Onde estou?" → Consulte \`{ { SCREEN_ID } } \`

**Demandas Complexas**:
1. **Entenda primeiro**: Se não estiver 100% claro, pergunte
   - "Você quer ver, criar ou editar?"
   - "Para qual período?"
   
2. **Se não souber**:
   - ✅ "Não sei onde está essa funcionalidade. Você pode me mostrar?"
   - ✅ Aprenda depois com \`contribute_knowledge\`
   - ❌ NUNCA finja que sabe

### 4️⃣ Fechar o Ciclo

**Validação de "Não" (Soft Negative)**:
Se você perguntar "Quer fazer mais algo nesta tela?" e o usuário disser "Não":
1. **NÃO encerre** a conversa imediatamente.
2. Interprete como "Não *nesta* tela".
3. Pergunte: "Entendi. Deseja ir para outra tela ou precisa de ajuda com outro assunto?"

**Apenas encerre se**:
- O usuário disser "Não, obrigado", "Só isso", "Pode fechar", "Tchau".

\`\`\`
Conseguiu entender? Posso te ajudar em mais alguma coisa?
\`\`\`

---

## ATITUDE FUNDAMENTAL

### ✅ Sempre Demonstre
- ✨ Entusiasmo genuíno ("Oba! Deixa eu te ajudar...")
- 🎯 Engajamento ativo (não seja passiva)
- 🔍 Curiosidade quando não souber
- 💪 Proatividade (antecipe necessidades)

### ❌ Nunca Seja
- Robótica ou técnica demais
- Apática ("Ok.", "Não sei.")
- Silenciosa quando não sabe algo

---

## TOM DE VOZ POR NÍVEL

### Executivo/Gerencial (C-Level, Diretores)
- Formal: "Olá, Sr./Sra. {{NAME}}"
- Emojis raros (apenas ✓ ✗ ⚠️)
- Conciso e direto

### Profissional (Coordenadores, Analistas)
- Cordial: "Olá, {{NAME}}"
- Emojis moderados (😊 👍 🎯)
- Equilibrado entre técnico e amigável

### Operacional (Assistentes, Operadores)
- Descontraído: "Oi, {{NAME}}!"
- Emojis permitidos (😊 🎉 👏 ⚡)
- Didático e paciente

---

## DADOS DISPONÍVEIS

{{SCREEN_DATA}}
{{CACHED_SCREENS}}
{{MODULE_KNOWLEDGE}}

---

## MEMÓRIA PESSOAL
{{USER_MEMORY}}

---

## EXEMPLOS DE FLUXO

**❌ ERRADO**:
\`\`\`
User: Como faço para criar uma venda?
IVA: Oi! 😊 No que posso te ajudar?
\`\`\`

**✅ CORRETO**:
\`\`\`
User: Como faço para criar uma venda?
IVA: Para criar uma venda, vá em Vendas > Nova Venda.
Preencha os dados do cliente e produtos. 
Ficou claro? Posso ajudar em mais alguma coisa?
\`\`\`

**✅ CORRETO (quando não sabe)**:
\`\`\`
User: Como faço para gerar consolidadas?
IVA: Não sei onde está essa funcionalidade no sistema.
Você poderia me mostrar onde fica? Assim aprendo e 
posso te ajudar melhor da próxima vez! 😊
\`\`\`
`;

/**
 * Helper: Format rules array into bullet points
 */
function formatRules(rules, emptyMsg = '(Nenhuma regra específica)') {
   if (!rules || rules.length === 0) return emptyMsg;
   return rules.map(r => `• ${r}`).join('\n');
}

/**
 * Check if user was greeted today
 */
function wasGreetedToday(lastAccess) {
   if (!lastAccess) return false;
   const lastDate = new Date(lastAccess);
   const today = new Date();
   return lastDate.getDate() === today.getDate() &&
      lastDate.getMonth() === today.getMonth() &&
      lastDate.getFullYear() === today.getFullYear();
}

/**
 * Build system prompt with Qdrant knowledge using the New IVA Structure
 */
async function buildOperateContextWithQdrant(user, project, screenData, cachedScreens, intent, lastAccess, conversationHistory, isAutoGreeting = false) {

   console.log('[IVA Context] Building context with new structure...');
   console.log(`[IVA Context] User: ${user.id} (${user.name}), Project: ${project?.id || 'N/A'}`);

   // 1. Fetch Knowledge and Rules (Parallel)
   const promises = [];

   // Always fetch essential rules
   promises.push(QdrantKnowledgeService.getLearnedRules('SYSTEM', {}));
   promises.push(QdrantKnowledgeService.getLearnedRules('USER', { userId: user.id }));

   // Fetch scoped rules if not auto-greeting (optimization)
   if (!isAutoGreeting) {
      if (user.department) promises.push(QdrantKnowledgeService.getLearnedRules('DEPARTMENT', { department: user.department }));
      else promises.push(Promise.resolve([]));

      if (user.job_title) promises.push(QdrantKnowledgeService.getLearnedRules('ROLE', { role: user.job_title }));
      else promises.push(Promise.resolve([]));

      // Fetch PROJECT rules if project exists
      if (project && (project.id || project.code)) {
         promises.push(QdrantKnowledgeService.getLearnedRules('PROJECT', { projectId: project.id }));
      } else {
         promises.push(Promise.resolve([]));
      }

      // Load Global Knowledge (Menus/Actions)
      promises.push(IvaGlobalKnowledge.load().then(k => IvaGlobalKnowledge.formatForPrompt(k)));
   } else {
      promises.push(Promise.resolve([])); // Dept
      promises.push(Promise.resolve([])); // Role
      promises.push(Promise.resolve([])); // Project
      promises.push(Promise.resolve('')); // Global Knowledge (Skip for speed)
   }

   // Base prompts (User instructions)
   promises.push(loadPrompt('user')); // To get specific user instruction snippets if any
   promises.push(loadPrompt('company'));
   promises.push(loadPrompt('module'));

   const start = Date.now();
   const [
      systemRules,
      userRules,
      deptRules,
      roleRules,
      projectRules,
      moduleKnowledgeString,
      userPrompt,
      companyPrompt,
      modulePrompt
   ] = await Promise.all(promises);

   console.log(`[IVA Context] Data fetch complete (${Date.now() - start}ms)`);

   // 2. Prepare Variables
   const now = new Date();
   const isoDate = now.toISOString();
   // Brazil Time for display
   const localTime = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: 'America/Sao_Paulo'
   }).format(now);

   const preferredName = user.preferred_name || user.name || 'Usuário';

   // --- MAP TO TEMPLATE ---

   let prompt = IVA_CORE_PROMPT_TEMPLATE;

   // 2.1 PROJECT & COMPANY RULES
   prompt = prompt.replace('{{PROJECT_NAME}}', project.name || 'CASH ERP');
   prompt = prompt.replace('{{PROJECT_ID}}', project.id || 'N/A');

   const companyRulesList = [
      ...(companyPrompt ? [companyPrompt] : []),
      ...(projectRules.length > 0 ? [`[Regras do Projeto ${project.id || ''}]`, ...projectRules] : []),
      ...systemRules
   ];
   prompt = prompt.replace('{{COMPANY_RULES}}', formatRules(companyRulesList));

   // 2.2 MODULE RULES (Global Instructions + Dept + Role + Module Prompts)
   const moduleRulesList = [
      ...(modulePrompt ? [modulePrompt] : []),
      ...(deptRules.length > 0 ? [`[Setor ${user.department || 'Geral'}]`, ...deptRules] : []),
      ...(roleRules.length > 0 ? [`[Cargo ${user.job_title || 'Geral'}]`, ...roleRules] : [])
   ];
   prompt = prompt.replace('{{MODULE_RULES}}', formatRules(moduleRulesList));

   // 2.3 USER CONTEXT
   prompt = prompt.replace(/{{USER_PREFERRED_NAME}}/g, preferredName); // Global replace
   prompt = prompt.replace(/{{NAME}}/g, preferredName); // Replace explicit {{NAME}} in tone section
   prompt = prompt.replace('{{USER_JOB_TITLE}}', user.job_title || 'Não definido');
   prompt = prompt.replace('{{USER_DEPARTMENT}}', user.department || 'Geral');
   prompt = prompt.replace('{{USER_ID}}', user.id || 'N/A');

   const userPreferencesList = [
      userPrompt || '',
      // Add voice settings info if available in user object
      user.iva_voice_enabled ? `[Voz Ativada: Velocidade ${user.iva_voice_rate || 1.0}x]` : '[Voz Desativada]'
   ].filter(Boolean);
   prompt = prompt.replace('{{USER_PREFERENCES}}', userPreferencesList.join('\n') || 'Padrão');

   // 2.4 CURRENT CONTEXT
   prompt = prompt.replace(/{{SCREEN_ID}}/g, screenData ? screenData.screenId : 'Nenhuma (Dashboard/Home)');
   prompt = prompt.replace(/{{ISO_DATE}}/g, `${localTime} (${isoDate})`);
   // FIX: If AutoGreeting, FORCE "First Access" context to trigger full introduction
   if (isAutoGreeting) {
      prompt = prompt.replace('{{LAST_ACCESS}}', 'Primeiro Acesso (Sessão Iniciada)');
      prompt += `\n\nIMPORTANTÍSSIMO: REINICIE A PERSONA. APRESENTE-SE DIZENDO EXATAMENTE: "Olá, ${preferredName}! 👋 Sou a IVA...". IGNORE INTERAÇÕES ANTERIORES.`;
   } else {
      prompt = prompt.replace('{{LAST_ACCESS}}', lastAccess ? new Date(lastAccess).toLocaleString('pt-BR') : 'Primeiro Acesso');
   }

   // 2.5 DATA AVAILABLE
   prompt = prompt.replace('{{SCREEN_DATA}}', screenData ? `### DADOS DA TELA:\n${JSON.stringify(screenData, null, 2)}` : '(Sem dados de tela ativa)');

   const cachedList = cachedScreens && cachedScreens.length > 0
      ? cachedScreens.map(s => `- ${s.screenId}`).join('\n')
      : '(Nenhuma recente)';
   prompt = prompt.replace('{{CACHED_SCREENS}}', `### TELAS RECENTES:\n${cachedList}`);

   prompt = prompt.replace('{{MODULE_KNOWLEDGE}}', moduleKnowledgeString || '(Conhecimento global carregado sob demanda)');

   // 2.6 PERSONAL MEMORY
   prompt = prompt.replace('{{USER_MEMORY}}', formatRules(userRules, 'O usuário não ensinou nada específico ainda.'));

   return prompt;
}

module.exports = {
   buildOperateContextWithQdrant
};