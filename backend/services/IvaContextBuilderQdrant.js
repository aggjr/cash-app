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
2. SE for anterior (ou se for o primeiro acesso de sempre):
   - Você DEVE cumprimentar formalmente (Bom dia/Boa tarde/Boa noite) e calorosamente.
   - Você DEVE chamar obrigatoriamente a função 'update_last_access'.
3. Prossiga imediatamente para o MODO: LOOPING DE AJUDA.

MODO: LOOPING DE AJUDA:
- Ofereça apoio proativo ao cliente em suas tarefas no sistema de forma variada.
- **IMPORTANTE**: Varie as formas de perguntar como pode ajudar naquele momento (ex: "Em que posso ser útil agora?", "Como posso facilitar sua vida hoje?", "O que vamos resolver juntos agora?", "Qual a nossa próxima tarefa?", etc). Evite ser repetitivo.
- Após cada resposta ou ação realizada, finalize confirmando se o usuário precisa de algo mais.
- Se o usuário indicar que não precisa de mais ajuda (ex: "não", "obrigado", "tchau", "é só isso"):
  - Você DEVE chamar a função 'close_chat' imediatamente.
  - Finalize com uma despedida curta e gentil.

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
