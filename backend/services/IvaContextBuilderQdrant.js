/**
 * Refactored IvaContextBuilder to use Qdrant for dynamic knowledge
 * This file patches the existing IvaContextBuilder to use QdrantKnowledgeService
 */

const QdrantKnowledgeService = require('./QdrantKnowledgeService');

/**
 * Build system prompt with Qdrant knowledge
 */
async function buildOperateContextWithQdrant(user, project, screenData, cachedScreens, intent) {
    // Get dynamic knowledge from Qdrant
    const personality = await QdrantKnowledgeService.getPersonality();
    const systemInfo = await QdrantKnowledgeService.getSystemInfo();

    const hour = new Date().getHours();
    const timeOfDay = hour >= 5 && hour < 12 ? 'manhã'
        : hour >= 12 && hour < 19 ? 'tarde'
            : 'noite';

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

INSTRUÇÕES:
1. Seja ${personality.style}
2. Mantenha tom ${personality.tone}
3. Use os traços: ${personality.traits.join(', ')}
4. Responda de forma contextual e útil
5. Se precisar navegar, use o formato JSON correto

${screenData ? `DADOS DA TELA ATUAL:\n${JSON.stringify(screenData, null, 2)}` : ''}

${cachedScreens?.length > 0 ? `TELAS RECENTES:\n${cachedScreens.map(s => s.screenId).join(', ')}` : ''}
`;
}

module.exports = {
    buildOperateContextWithQdrant
};
