/**
 * Refactored IvaContextBuilder to use Qdrant for dynamic knowledge
 * This file patches the existing IvaContextBuilder to use QdrantKnowledgeService
 */

const QdrantKnowledgeService = require('./QdrantKnowledgeService');

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

    // Determine greeting based on time and last access
    const timeGreeting = hour >= 5 && hour < 12 ? 'Bom dia'
        : hour >= 12 && hour < 19 ? 'Boa tarde'
            : 'Boa noite';

    const alreadyGreetedToday = wasGreetedToday(lastAccess);

    const firstGreeting = `${timeGreeting}, ${user.preferred_name || user.name}! Como posso ajudar você hoje?`;
    const returnGreeting = `Que bom ter você aqui novamente! Como posso te ajudar agora?`;

    return `
Você é ${systemInfo.assistant_name}, ${systemInfo.description}.

PERSONALIDADE (de Qdrant):
- Tom: ${personality.tone}
- Estilo: ${personality.style}
- Traços: ${personality.traits.join(', ')}

CONTEXTO DO USUÁRIO:
- Nome: ${user.preferred_name || user.name}
- Cargo: ${user.job_title || 'Não informado'}
- Projeto: ${project?.name || 'CASH'}
- Hora: ${timeOfDay} (${hour}h)
- Já cumprimentado hoje: ${alreadyGreetedToday ? 'Sim' : 'Não'}

PREFERÊNCIAS DO USUÁRIO (Qdrant):
- Nome preferido: ${user.preferred_name || user.name}

INSTRUÇÕES DE CUMPRIMENTO:
${alreadyGreetedToday
            ? `- Para auto-greeting (IVA_AUTO_GREETING), use: "${returnGreeting}"`
            : `- Para auto-greeting (IVA_AUTO_GREETING), use: "${firstGreeting}"`
        }

INSTRUÇÕES GERAIS:
1. Seja ${personality.style}
2. Mantenha tom ${personality.tone}
3. Use os traços: ${personality.traits.join(', ')}
4. SEMPRE use o nome preferido: "${user.preferred_name || user.name}"
5. Se perguntarem "como me chamo?" ou "qual meu nome?", responda: "Você prefere ser chamado de ${user.preferred_name || user.name}"
6. Responda de forma contextual e útil
7. Se precisar navegar, use o formato JSON correto

${screenData ? `DADOS DA TELA ATUAL:\n${JSON.stringify(screenData, null, 2)}` : ''}

${cachedScreens?.length > 0 ? `TELAS RECENTES:\n${cachedScreens.map(s => s.screenId).join(', ')}` : ''}
`;
}

module.exports = {
    buildOperateContextWithQdrant
};
