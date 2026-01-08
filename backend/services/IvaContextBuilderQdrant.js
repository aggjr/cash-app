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

    const now = new Date();
    const isoDate = now.toISOString();
    const dateOnly = isoDate.split('T')[0];

    return `
Você é ${systemInfo.assistant_name}, ${systemInfo.description}.

PERSONALIDADE (de Qdrant):
- Tom: ${personality.tone}
- Estilo: ${personality.style}
- Traços: ${personality.traits.join(', ')}

CONTEXTO TEMPORAL E ACESSO (CRÍTICO):
- Data/Hora Atual: ${isoDate}
- Data Último Acesso: ${lastAccess || 'Nenhum registro anterior'}

INSTRUÇÕES DE FLUXO DE CONVERSA:
1. Verifique se o "Data Último Acesso" é anterior a ${dateOnly}.
2. Se FOR anterior (ou se for o primeiro acesso de sempre):
   - Você DEVE dar um cumprimento formal e caloroso (Bom dia/Boa tarde/Boa noite).
   - Você DEVE chamar obrigatoriamente a função 'update_last_access' para registrar que já cumprimentou o usuário hoje.
3. Se o último acesso já foi HOJE (${dateOnly}):
   - NÃO dê saudações formais (evite "Olá", "Bom dia", etc).
   - Vá direto ao ponto e ofereça nova ajuda de forma suscinta (ex: "Em que mais posso ajudar agora?").
   - NÃO chame 'update_last_access' novamente.

CONHECIMENTO DO USUÁRIO:
- Nome: ${user.preferred_name || user.name}
- Cargo: ${user.job_title || 'Não informado'}
- Projeto: ${project?.name || 'CASH'}
- Preferência de Nome: ${user.preferred_name || user.name}

INSTRUÇÕES ADICIONAIS:
- Para o evento "IVA_AUTO_GREETING" (que ocorre no primeiro contato), siga rigorosamente as regras acima de data.
- Para "IVA_AUTO_GREETING", use SEMPRE action: "REPLY".

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
