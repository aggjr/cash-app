const OpenAI = require('openai');
const QdrantKnowledgeService = require('./QdrantKnowledgeService');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

class IvaKnowledgeGenerator {

    /**
     * Ensure context rules exist for a specific context (Role or Department).
     * If not, generate them via LLM and save to Qdrant.
     * @param {string} type - 'role' or 'department'
     * @param {string} value - The specific name (e.g. "Gerente de Logística", "Logística")
     * @returns {Promise<string>} The generated or retrieved knowledge
     */
    static async ensureContextRules(type, value) {
        if (!value || value.length < 3) return '';

        // Normalize ID: role_gerente_de_logistica
        const normalizedValue = value.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^a-z0-9]/g, "_"); // replace non-alphanumeric with _

        const promptId = `${type}_${normalizedValue}`;

        // 1. Check if already exists in Qdrant
        const existing = await QdrantKnowledgeService.getPrompt(promptId);
        if (existing && existing.length > 20) {
            // console.log(`[IVA Generator] ✅ Found existing context for ${promptId}`);
            return existing;
        }

        // 2. If not, Generate via LLM
        console.log(`[IVA Generator] 🧠 Generating NEW knowledge for ${type}: "${value}"...`);

        try {
            const knowledge = await this.generateKnowledge(type, value);

            if (knowledge) {
                // 3. Save to Qdrant
                await QdrantKnowledgeService.savePrompt(promptId, knowledge);
                console.log(`[IVA Generator] 💾 Saved new context rules for ${promptId}`);
                return knowledge;
            }
        } catch (error) {
            console.error(`[IVA Generator] ❌ Failed to generate context for ${value}:`, error);
        }

        return '';
    }

    static async generateKnowledge(type, value) {
        let systemPrompt = "Você é um especialista em Gestão Empresarial e ERPs.";
        let userPrompt = "";

        if (type === 'department') {
            userPrompt = `
            Descreva resumidamente (max 5 linhas) quais são os principais:
            1. KPIs (Indicadores de Desempenho)
            2. Preocupações de Negócio
            3. Foco Analítico

            Para um departamento de "${value}" em uma empresa.
            
            Formato de resposta:
            "CONTEXTO [NOME DO DEPARTAMENTO]:
            - Foco: ...
            - KPIs Importantes: ...
            - Análises Críticas: ..."
            `;
        } else if (type === 'role') {
            userPrompt = `
            Descreva resumidamente (max 5 linhas) o perfil para o cargo "${value}".
            Foque em:
            1. Nível de decisão (Estratégico, Tático ou Operacional)
            2. Que tipo de informação é vital para esse cargo
            
            Formato de resposta:
            "PERFIL [NOME DO CARGO]:
            - Nível: ...
            - Informação Vital: ...
            - Expectativa de Resposta: ..."
            `;
        } else {
            return null;
        }

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 300
            });

            return completion.choices[0].message.content.trim();
        } catch (e) {
            console.error("[IVA Generator] LLM Error:", e);
            throw e;
        }
    }
}

module.exports = IvaKnowledgeGenerator;
