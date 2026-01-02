const { createLLMRequest } = require('./utils/llmClient');

/**
 * Detect gender from name using LLM
 * @param {string} name - User's full name
 * @returns {Promise<'M'|'F'|null>} - M for male, F for female, null if uncertain
 */
async function detectGenderFromName(name) {
    try {
        const prompt = `Analise o nome "${name}" e determine o gênero provável da pessoa.

REGRAS:
- Se nome claramente masculino → responda apenas: MASCULINO
- Se nome claramente feminino → responda apenas: FEMININO
- Se nome ambíguo/neutro/desconhecido → responda apenas: NEUTRO

Responda com APENAS UMA PALAVRA (MASCULINO, FEMININO ou NEUTRO).`;

        const response = await createLLMRequest({
            messages: [
                { role: 'system', content: 'Você é um assistente especializado em análise de nomes brasileiros.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1, // Baixa criatividade, queremos consistência
            max_tokens: 10
        });

        const result = response.content.trim().toUpperCase();

        if (result.includes('MASCULINO')) return 'M';
        if (result.includes('FEMININO')) return 'F';

        return null; // Neutro ou incerto

    } catch (error) {
        console.error('[Gender Detection] Error:', error);
        return null;
    }
}

module.exports = { detectGenderFromName };
