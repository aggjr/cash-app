/**
 * Refactored IvaContextBuilder to use Qdrant for dynamic knowledge
 * This file patches the existing IvaContextBuilder to use QdrantKnowledgeService
 */

const QdrantKnowledgeService = require('./QdrantKnowledgeService');
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
async function buildOperateContextWithQdrant(user, project, screenData, cachedScreens, intent, lastAccess) {
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
   let departmentPrompt = '';
   let userPrompt = '';
   try { departmentPrompt = await loadPrompt('department'); } catch (e) { }
   try { userPrompt = await loadPrompt('user'); } catch (e) { }

   // Detect formality level
   const jt = (user.job_title || '').toLowerCase();
   const dp = (user.department || '').toLowerCase();
   const isFormal = jt.includes('consult') && (jt.includes('sênior') || jt.includes('senior')) ||
      dp.includes('board') || dp.includes('diretoria');

   const formalityLevel = isFormal ? '✅ FORMAL (Alta liderança detectada)' : '⚠️ INFORMAL/SEMIFORMAL';
   const formalityInstructions = isFormal
      ? `INSTRUÇÕES OBRIGATÓRIAS (NÍVEL FORMAL):
- Tom: Respeitoso, profissional
- Saudações: "Bom dia", "Boa tarde", "Boa noite" (SEM emoji 😊)
- Respostas: "Como posso auxiliá-lo?", "Posso ajudar em algo mais?"
- Emojis: RARAMENTE (apenas 🎯 ✅ ⚠️)
- PROIBIDO: "Oi!", "E aí!", "Opa!", "😊"`
      : `INSTRUÇÕES (NÍVEL INFORMAL):
- Pode usar: "Oi! 😊", "No que posso te ajudar?"
- Emojis liberados`;

   // Replace placeholders in template
   const systemPrompt = systemPromptTemplate
      .replace(/\{\{USER_JOB_TITLE\}\}/g, user.job_title || 'Não informado')
      .replace(/\{\{USER_DEPARTMENT\}\}/g, user.department || 'Não informado')
      .replace(/\{\{FORMALITY_LEVEL\}\}/g, formalityLevel)
      .replace(/\{\{FORMALITY_INSTRUCTIONS\}\}/g, formalityInstructions)
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

CONTEXTO TEMPORAL E ACESSO (CRÃTICO):
- Data/Hora Atual: ${isoDate}
- Data Ãšltimo Acesso: ${lastAccess || 'Nenhum registro anterior'}
- Ãšltimo acesso foi hoje? ${wasGreetedToday(lastAccess) ? 'SIM' : 'NÃƒO'}

${systemPrompt}

========================================
NÍVEL DEPARTAMENTO:
${departmentPrompt || '(Sem instruções específicas)'}

========================================
NÍVEL USUÁRIO:
${userPrompt || '(Sem instruções específicas)'}
`;
}

module.exports = {
   buildOperateContextWithQdrant
};