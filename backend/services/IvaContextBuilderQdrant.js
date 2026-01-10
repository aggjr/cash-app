/**
 * Refactored IvaContextBuilder to use Qdrant for dynamic knowledge
 * This file patches the existing IvaContextBuilder to use QdrantKnowledgeService
 */

const QdrantKnowledgeService = require('./QdrantKnowledgeService');
const IvaKnowledgeGenerator = require('./IvaKnowledgeGenerator');
const { loadPrompt } = require('./promptLoader');

/**
 * Check if user was greeted today
 */
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
 * Build system prompt with Qdrant knowledge (Clean Text approach)
 */
async function buildOperateContextWithQdrant(user, project, screenData, cachedScreens, intent, lastAccess, conversationHistory, isAutoGreeting = false) {
   // 1. Fetch Core Knowledge (Parallel)
   const [personality, systemInfo, globalRules] = await Promise.all([
      QdrantKnowledgeService.getPersonality(),
      QdrantKnowledgeService.getSystemInfo(),
      !isAutoGreeting ? QdrantKnowledgeService.getLearnedRules('SYSTEM', {}) : Promise.resolve([])
   ]);

   // 2. Fetch Scoped Knowledge (Parallel - Conditional)
   const promises = [];

   if (!isAutoGreeting) {
      console.log('[ContextBuilder] Fetching scoped rules...');
      if (user.department) promises.push(QdrantKnowledgeService.getLearnedRules('DEPARTMENT', { department: user.department }));
      else promises.push(Promise.resolve([]));

      if (user.job_title) promises.push(QdrantKnowledgeService.getLearnedRules('ROLE', { role: user.job_title }));
      else promises.push(Promise.resolve([]));
   } else {
      console.log('[ContextBuilder] Skipping scoped rules for Auto-Greeting');
      promises.push(Promise.resolve([])); // Dept
      promises.push(Promise.resolve([])); // Role
   }

   // Always fetch user rules for personal preferences (like "Don't verify things")
   promises.push(QdrantKnowledgeService.getLearnedRules('USER', { userId: user.id }));

   const rulesStart = Date.now();
   const [deptRules, roleRules, personalRules] = await Promise.all(promises);
   console.log(`[ContextBuilder] Scoped Rules Fetched (${Date.now() - rulesStart}ms)`);

   // 3. Load Base Prompts (Qdrant)

   // OPTIMIZATION: For Auto-Greeting, we ONLY load 'system' (for basic ID) and 'user' (for preferences)
   // We SKIP Module, Company, Dept, Role prompts which are huge.

   let systemPromptTemplate = '';
   let moduleInst = '', companyInst = '', deptInst = '', roleInst = '', userInst = '';

   if (!isAutoGreeting) {
      [systemPromptTemplate, moduleInst, companyInst, deptInst, roleInst, userInst] = await Promise.all([
         loadPrompt('system'),
         loadPrompt('module'),
         loadPrompt('company'),
         loadPrompt('department'),
         loadPrompt('role'),
         loadPrompt('user')
      ]);
   } else {
      console.log('[ContextBuilder] Skipping heavy prompts for Auto-Greeting');
      // Load minimal context for greeting
      [systemPromptTemplate, userInst] = await Promise.all([
         loadPrompt('system'), // Need system for basic ID
         loadPrompt('user')    // Need user for style preferences
      ]);
   }

   // 4. PREPARE CONTEXT VARIABLES
   const now = new Date();
   // FIX: Force Brazil Timezone (UTC-3) for correct greeting
   const hour = parseInt(new Intl.DateTimeFormat('pt-BR', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Sao_Paulo'
   }).format(now));

   // Also format isoDate to show local time in the prompt if useful,
   // but ISO is usually fine. We'll keep ISO for machine parsing,
   // but maybe add a "Local Time" field for the LLM to understand context better.
   const localTime = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: 'America/Sao_Paulo'
   }).format(now);

   const isoDate = now.toISOString();
   const isToday = wasGreetedToday(lastAccess);

   // Formality Analysis
   const pn = (user.preferred_name || '').trim();
   const jt = (user.job_title || '').toLowerCase();
   const dp = (user.department || '').toLowerCase();

   // Heuristic: Honorifics
   const hasFormalHonorific = /^(Dr|Dra|Sr|Sra|Prof|Professor|Professora)(\.|\s)/i.test(pn);

   // Heuristic: Executive Roles
   const isExecutive = jt.includes('diretor') || jt.includes('ceo') || jt.includes('presidente') ||
      dp.includes('board') || dp.includes('diretoria');

   const isFormal = hasFormalHonorific || isExecutive;

   const formalityLevel = isFormal ? 'FORMAL' : 'PROFISSIONAL';
   const formalityInstruction = isFormal
      ? 'Tom: Respeitoso, executivo. "Bom dia Sr/Sra". Evite emojis.'
      : 'Tom: Profissional mas acessível. "Olá", "Oi". Emojis moderados permitidos.';

   // 5. BUILD PROMPT SECTIONS (Array Builder Pattern)
   const sections = [];

   // --- HEADER & IDENTITY ---
   sections.push(`DIRETRIZ MESTRA ID: ${systemInfo.assistant_name}
Missão: ${systemInfo.description}
Personalidade: ${personality.tone} (${personality.style})
Traços: ${personality.traits.join(', ')}`);

   // --- USER CONTEXT ---
   sections.push(`CONTEXTO DO USUÁRIO:
Nome Preferido: ${user.preferred_name || user.name || 'User'}
Cargo: ${user.job_title || 'N/A'}
Departamento: ${user.department || 'N/A'}
--
Formalidade Detectada: ${formalityLevel}
Instrução: ${formalityInstruction}`);

   // --- TEMPORAL CONTEXT ---
   sections.push(`TEMPO:
Agora: ${isoDate}
Último Acesso: ${lastAccess || 'Nunca'} (Hoje? ${isToday ? 'SIM' : 'NÃO'})`);

   // --- BASE INSTRUCTIONS (System Prompt) ---
   if (systemPromptTemplate) {
      sections.push(`INSTRUÇÕES DO SISTEMA:\n${systemPromptTemplate}`);
   }

   // --- KNOWLEDGE LAYERS (Only add if content exists) ---

   // MODULE LEVEL
   if (moduleInst || globalRules.length > 0) {
      let block = `NÍVEL MÓDULO (GLOBAL):`;
      if (moduleInst) block += `\n${moduleInst}`;
      if (globalRules.length > 0) block += `\n\nREGRAS GLOBAIS APRENDIDAS:\n${globalRules.map(r => `• ${r}`).join('\n')}`;
      sections.push(block);
   }

   // COMPANY LEVEL
   if (companyInst) {
      sections.push(`NÍVEL EMPRESA (${project.name || 'Atual'}):\n${companyInst}`);
   }

   // DEPARTMENT LEVEL
   if (user.department && (deptInst || deptRules.length > 0)) {
      let block = `NÍVEL DEPARTAMENTO (${user.department}):`;
      if (deptInst) block += `\n${deptInst}`;
      if (deptRules.length > 0) block += `\n\nREGRAS DO SETOR:\n${deptRules.map(r => `• ${r}`).join('\n')}`;
      sections.push(block);
   }

   // ROLE LEVEL
   if (user.job_title && (roleInst || roleRules.length > 0)) {
      let block = `NÍVEL CARGO (${user.job_title}):`;
      if (roleInst) block += `\n${roleInst}`;
      if (roleRules.length > 0) block += `\n\nREGRAS DO CARGO:\n${roleRules.map(r => `• ${r}`).join('\n')}`;
      sections.push(block);
   }

   // USER LEVEL
   if (userInst || personalRules.length > 0) {
      let block = `NÍVEL PESSOAL (PREFERÊNCIAS):`;
      if (userInst) block += `\n${userInst}`;
      if (personalRules.length > 0) block += `\n\nMEMÓRIA PESSOAL:\n${personalRules.map(r => `• ${r}`).join('\n')}`;
      sections.push(block);
   }

   // --- SCREEN CONTEXT (Current Visual) ---
   if (screenData) {
      sections.push(`DADOS DA TELA ATUAL (${screenData.screenId}):
${JSON.stringify(screenData, null, 2)}`);
   } else {
      sections.push(`(Nenhuma tela ativa analisada no momento)`);
   }

   // --- CACHED CONTEXT ---
   if (cachedScreens && cachedScreens.length > 0) {
      sections.push(`TELAS RECENTES:\n${cachedScreens.map(s => s.screenId).join(', ')}`);
   }

   // --- SPECIAL INSTRUCTION FOR AUTO-GREETING ---
   if (isAutoGreeting) {
      const screenTitle = screenData ? screenData.pageTitle : null;

      let greetingInstruction = `
INSTRUÇÃO DE SAUDAÇÃO (PRIORIDADE MÁXIMA):
O usuário acabou de abrir o chat.
1. Inicie com um cumprimento caloroso usando o Nome Preferido.`;

      if (screenTitle) {
         greetingInstruction += `
2. Mencione explicitamente que percebeu que ele está na tela "${screenTitle}".
3. Pergunte: "Deseja ajuda com esta tela ou gostaria de tratar de outro assunto?"`;
      } else {
         greetingInstruction += `
2. Coloque-se à disposição para ajudar com qualquer módulo do sistema (Financeiro, Vendas, etc).`;
      }

      greetingInstruction += `
4. NÃO use pronomes vagos como "com isso". Seja específico.`;

      sections.push(greetingInstruction);
   }

   // 6. JOIN SECTIONS
   // Filter out empty strings just in case, and join with double format
   return sections.filter(Boolean).join('\n\n========================================\n\n');
}

module.exports = {
   buildOperateContextWithQdrant
};