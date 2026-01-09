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
      .replace(/\{\{USER_JOB_TITLE\}\}/g, user.job_title || 'Não informado')
      .replace(/\{\{USER_DEPARTMENT\}\}/g, user.department || 'Não informado')
      .replace(/\{\{FORMALITY_LEVEL\}\}/g, '') // Remove from system
      .replace(/\{\{FORMALITY_INSTRUCTIONS\}\}/g, '') // Remove from system
      .replace(/\{\{USER_PREFERRED_NAME\}\}/g, user.preferred_name || user.name || 'você')
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name || 'projeto atual')
      .replace(/\{\{SCREEN_ID\}\}/g, screenData?.screenId || 'tela não identificada')
      .replace(/\{\{ISO_DATE\}\}/g, isoDate)
      .replace(/\{\{SCREEN_DATA\}\}/g, screenData ? `DADOS DA TELA ATUAL:\n${JSON.stringify(screenData, null, 2)}` : 'Nenhum dado disponível')
      .replace(/\{\{CACHED_SCREENS\}\}/g, cachedScreens?.length > 0 ? `TELAS RECENTES:\n${cachedScreens.map(s => s.screenId).join(', ')}` : '');

   return `
VocÃª Ã© ${systemInfo.assistant_name}, ${systemInfo.description}.

PERSONALIDADE (de Qdrant):
- Tom: ${personality.tone}
- Estilo: ${personality.style}
- TraÃ§os: ${personality.traits.join(', ')}

CONTEXTO TEMPORAL E ACESSO (CRÃ TICO):
- Data/Hora Atual: ${isoDate}
- Data Ãšltimo Acesso: ${lastAccess || 'Nenhum registro anterior'}
- Ãšltimo acesso foi hoje? ${wasGreetedToday(lastAccess) ? 'SIM' : 'NÃƒO'}

${systemPrompt}

========================================
NÍVEL MÓDULO (CASH):
${modulePrompt || '(Sem instruções específicas)'}

========================================
NÍVEL EMPRESA (${project.name || 'Cliente'}):
${companyPrompt || '(Sem instruções específicas)'}

========================================
NÍVEL DEPARTAMENTO:
${departmentPrompt || '(Sem instruções específicas)'}

${dynamicDeptRules ? `--- CONTEXTO ESPECÍFICO DEPARTAMENTO (${user.department}):\n${dynamicDeptRules}` : ''}

========================================
NÍVEL CARGO (Job Title: ${user.job_title || 'N/A'}):
${rolePrompt || '(Sem instruções específicas)'}

${dynamicRoleRules ? `--- CONTEXTO ESPECÍFICO CARGO (${user.job_title}):\n${dynamicRoleRules}` : ''}

========================================
NÍVEL USUÁRIO:
${userPrompt || '(Sem instruções específicas)'}
`;
}

module.exports = {
   buildOperateContextWithQdrant
};