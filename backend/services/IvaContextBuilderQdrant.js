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
function wasGreetedToday(lastAccess) {
   if (!lastAccess) return false;

   const lastDate = new Date(lastAccess);
   const today = new Date();

   return lastDate.getDate() === today.getDate() &&
      lastDate.getMonth() === today.getMonth() &&
      lastDate.getFullYear() === today.getFullYear();
}

/**
 * Build system prompt with Qdrant knowledge
 */
async function buildOperateContextWithQdrant(user, project, screenData, cachedScreens, intent, lastAccess, conversationHistory) {
   // Get dynamic knowledge from Qdrant
   const personality = await QdrantKnowledgeService.getPersonality();
   const systemInfo = await QdrantKnowledgeService.getSystemInfo();

   // Fetch Learned Rules for all scopes in PARALLEL
   const [globalRules, deptRules, roleRules, personalRules] = await Promise.all([
      QdrantKnowledgeService.getLearnedRules('SYSTEM', {}),
      user.department ? QdrantKnowledgeService.getLearnedRules('DEPARTMENT', { department: user.department }) : Promise.resolve([]),
      user.job_title ? QdrantKnowledgeService.getLearnedRules('ROLE', { role: user.job_title }) : Promise.resolve([]),
      QdrantKnowledgeService.getLearnedRules('USER', { userId: user.id })
   ]);

   const hour = new Date().getHours();
   const timeOfDay = hour >= 5 && hour < 12 ? 'manhã'
      : hour >= 12 && hour < 19 ? 'tarde'
         : 'noite';

   const now = new Date();
   const isoDate = now.toISOString();
   const dateOnly = isoDate.split('T')[0];

   // Load system prompt from file
   const systemPromptTemplate = await loadPrompt('system');

   // Load optional level prompts (fail safe)
   let modulePrompt = '';
   let companyPrompt = '';
   let departmentPrompt = '';
   let rolePrompt = '';
   let userPrompt = '';
   try { modulePrompt = await loadPrompt('module'); } catch (e) { }
   try { companyPrompt = await loadPrompt('company'); } catch (e) { }
   try { departmentPrompt = await loadPrompt('department'); } catch (e) { }
   try { rolePrompt = await loadPrompt('role'); } catch (e) { }
   try { userPrompt = await loadPrompt('user'); } catch (e) { }

   // Detect formality level
   // Detect formality level
   const jt = (user.job_title || '').toLowerCase();
   const dp = (user.department || '').toLowerCase();
   const pn = (user.preferred_name || '').trim();

   // Check for Honorifics in preferred name (Dr, Sr, Prof, etc)
   // Regex checks for "Dr.", "Sr.", "Professor" at start of name
   const hasFormalHonorific = /^(Dr|Dra|Sr|Sra|Prof|Professor|Professora)(\.|\s)/i.test(pn);

   // Linguistic Analysis of recent user messages
   const recentUserMessages = (conversationHistory || [])
      .filter(m => m.sender === 'user')
      .slice(-5)
      .map(m => m.text.toLowerCase())
      .join(' ');

   const formalMarkers = [
      'auxiliar', 'solicito', 'gentileza', 'grato', 'agradeço',
      'prezado', 'efetuar', 'realizar', 'proceder', 'verificar',
      'poderia', 'gostaria', 'informar', 'questão', 'devido'
   ];

   let formalScore = 0;
   formalMarkers.forEach(word => {
      if (recentUserMessages.includes(word)) formalScore++;
   });

   // High formality in text overrides job title
   const hasFormalStyle = formalScore >= 1;

   const isFormal =
      hasFormalHonorific ||
      hasFormalStyle ||
      (jt.includes('consult') && (jt.includes('sênior') || jt.includes('senior'))) ||
      dp.includes('board') || dp.includes('diretoria');

   const formalityLevel = isFormal ? '✅ FORMAL (Alta liderança detectada)' : '⚠️ PROFISSIONAL/AMIGÁVEL';
   const formalityInstructions = isFormal
      ? `INSTRUÇÕES OBRIGATÓRIAS (NÍVEL FORMAL):
- Tom: Respeitoso, executivo, direto
- Saudações: "Bom dia", "Boa tarde", "Boa noite" (SEM emoji 😊)
- Respostas: "Como posso auxiliá-lo?", "Posso ajudar em algo mais?"
- Emojis: RARAMENTE (apenas 🎯 ✅ ⚠️ para status)
- PROIBIDO: gírias, "Oi!", "E aí!", "Opa!", "😊"`
      : `INSTRUÇÕES (NÍVEL PROFISSIONAL AMIGÁVEL):
- Tom: Profissional mas acessível (NUNCA informal demais)
- Saudações permitidas: "Olá", "Oi", "Bom dia"
- Emojis: MODERADO (máximo 1 ou 2 para tom amigável)
- PROIBIDO: Gírias excessivas ("E aí", "Beleza", "Top", "Massa", "Cara")
- Mantenha postura de assistente corporativo eficiente`;

   // Formality Logic (Moved to User Level)
   // We now append the instructions specifically to the USER section
   const formalitySection = `
INSTRUCÕES DE FORMALIDADE DETECTADAS (Auto-ajuste):
Nível: ${formalityLevel}

${formalityInstructions}
`;

   // Append to user prompt
   userPrompt = userPrompt ? `${userPrompt}\n${formalitySection}` : formalitySection;

   // --- DYNAMIC KNOWLEDGE GENERATION (ACTIVE LEARNING) ---
   // Research specific rules if this specific department/role is new
   let dynamicDeptRules = '';
   let dynamicRoleRules = '';

   try {
      if (user.department) {
         dynamicDeptRules = await IvaKnowledgeGenerator.ensureContextRules('department', user.department);
      }
      if (user.job_title) {
         dynamicRoleRules = await IvaKnowledgeGenerator.ensureContextRules('role', user.job_title);
      }
   } catch (err) {
      console.error('[ContextBuilder] Error generating dynamic rules:', err);
   }

   // Replace placeholders in template (Clean up system prompt if placeholders exist)
   const systemPrompt = systemPromptTemplate
      .replace(/\{\{\s*USER_JOB_TITLE\s*\}\}/g, user.job_title || 'Não informado')
      .replace(/\{\{\s*USER_DEPARTMENT\s*\}\}/g, user.department || 'Não informado')
      .replace(/\{\{\s*FORMALITY_LEVEL\s*\}\}/g, '') // Remove from system
      .replace(/\{\{\s*FORMALITY_INSTRUCTIONS\s*\}\}/g, '') // Remove from system
      .replace(/\{\{\s*USER_PREFERRED_NAME\s*\}\}/g, user.preferred_name || user.name || 'você')
      .replace(/\{\{\s*PROJECT_NAME\s*\}\}/g, project.name || 'projeto atual')
      .replace(/\{\{\s*SCREEN_ID\s*\}\}/g, screenData?.screenId || 'tela não identificada')
      .replace(/\{\{\s*ISO_DATE\s*\}\}/g, isoDate)
      .replace(/\{\{\s*SCREEN_DATA\s*\}\}/g, screenData ? `DADOS DA TELA ATUAL:\n${JSON.stringify(screenData, null, 2)}` : 'Nenhum dado disponível')
      .replace(/\{\{\s*CACHED_SCREENS\s*\}\}/g, cachedScreens?.length > 0 ? `TELAS RECENTES:\n${cachedScreens.map(s => s.screenId).join(', ')}` : '');

   return `
DIRETRIZ MESTRA (MAPEAR & APRENDER):
1. SEU OBJETIVO PRIMÁRIO é construir um mapa mental vivo da empresa.
2. ANTES de executar qualquer ação, verifique se você sabe ONDE e COMO fazer.
3. Se NÃO souber (informação não está no contexto abaixo):
   - PERGUNTE ao usuário ou PESQUISE nas telas.
   - Ao descobrir, USE A FUNÇÃO 'contribute_knowledge' para gravar.
   - "Não sei" é uma oportunidade de aprender.
4. MANTENHA O MAPA ATUALIZADO:
   - User mudou de cargo? Grave.
   - Regra mudou? Grave.
5. POSTURA PRESTATIVA (OBRIGATÓRIO):
   - NUNCA encerre com apenas "OK" ou "Entendido".
   - SEMPRE termine oferecendo ajuda: "O que mais posso fazer?", "Deseja ver algo específico?", "Como posso ajudar agora?".
   - EXCEÇÃO: Apenas se o usuário disser "Tchau" ou "Obrigado, só isso".

IDENTIDADE I.V.A (Inteligência Virtual Autônoma):
- Nome: ${systemInfo.assistant_name}
- Missão: ${systemInfo.description}
- Personalidade: ${personality.tone} (${personality.style})
- Traços: ${personality.traits.join(', ')}

CONTEXTO TEMPORAL E ACESSO (CRÍTICO):
- Data/Hora Atual: ${isoDate}
- Data Último Acesso: ${lastAccess || 'Nenhum registro anterior'}
- Último acesso foi hoje? ${wasGreetedToday(lastAccess) ? 'SIM' : 'NÃO'}

${systemPrompt}

========================================
NÍVEL MÓDULO (CASH):
${modulePrompt || '(Sem instruções específicas)'}
${globalRules.length > 0 ? '\n--- CONHECIMENTO APRENDIDO (GLOBAL):\n' + globalRules.map(r => `• ${r}`).join('\n') : ''}

========================================
NÍVEL EMPRESA (${project.name || 'Cliente'}):
${companyPrompt || '(Sem instruções específicas)'}

========================================
NÍVEL DEPARTAMENTO:
${departmentPrompt || '(Sem instruções específicas)'}

${dynamicDeptRules ? `--- CONTEXTO ESPECÍFICO DEPARTAMENTO (${user.department}):\n${dynamicDeptRules}` : ''}
${deptRules.length > 0 ? '\n--- REGRAS APRENDIDAS (DEPARTAMENTO):\n' + deptRules.map(r => `• ${r}`).join('\n') : ''}

========================================
NÍVEL CARGO (Job Title: ${user.job_title || 'N/A'}):
${rolePrompt || '(Sem instruções específicas)'}

${dynamicRoleRules ? `--- CONTEXTO ESPECÍFICO CARGO (${user.job_title}):\n${dynamicRoleRules}` : ''}
${roleRules.length > 0 ? '\n--- REGRAS APRENDIDAS (CARGO):\n' + roleRules.map(r => `• ${r}`).join('\n') : ''}

========================================
NÍVEL USUÁRIO:
${userPrompt || '(Sem instruções específicas)'}
${personalRules.length > 0 ? '\n--- SUAS NOTAS PESSOAIS APRENDIDAS:\n' + personalRules.map(r => `• ${r}`).join('\n') : ''}
`;
}

module.exports = {
   buildOperateContextWithQdrant
};