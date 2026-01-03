const systemPrompts = require('../config/eva-system-prompts');
const financialKnowledge = require('../config/eva-financial-knowledge');
const systemMap = require('../config/eva-system-map');

/**
 * EVA Context Builder Service
 * Merges 3 levels of context into final prompts:
 * Level 1: System (global)
 * Level 2: Project (business-specific)
 * Level 3: User (personal preferences)
 */

class EvaContextBuilder {
    /**
     * Build complete chat context
     * @param {Object} user - User object with eva_preferences
     * @param {Object} project - Project object with eva_context
     * @param {string} dynamicProfile - Infered business profile from DB
     * @param {Object} options - Additional options (isIntroduction, etc)
     * @returns {string} Complete system prompt
     */
    static buildChatContext(user, project, dynamicProfile = '', options = {}) {
        const { isIntroduction = false } = options;

        // Level 1: System base
        const systemBase = systemPrompts.chat.base;
        const capabilities = systemPrompts.chat.capabilities.join('\n- ');

        // Level 2: Project context
        const projectContext = project?.eva_context || {};
        const businessType = projectContext.business_type || 'general';
        const tone = projectContext.tone || 'formal';
        const projectInstructions = projectContext.custom_instructions || '';

        // Level 3: User preferences & Role
        const userPrefs = user?.eva_preferences || {};
        const communicationStyle = userPrefs.communication_style || 'padrão';
        const expertiseLevel = userPrefs.expertise_level || 'intermediário';
        const userInstructions = userPrefs.custom_instructions || '';

        // User Role Context
        const jobTitle = user?.job_title ? `Cargo: ${user.job_title}` : '';
        const department = user?.department ? `Departamento: ${user.department}` : '';
        const roleContext = (jobTitle || department) ? `${jobTitle} | ${department}` : 'Usuário padrão';

        // Get time context
        const now = new Date();
        const hour = now.getHours();
        const timeOfDay = hour >= 5 && hour < 12 ? 'manhã' : hour >= 12 && hour < 19 ? 'tarde' : 'noite';
        const evaIntroduced = user?.eva_introduced || false;

        // Build final prompt
        if (isIntroduction) {
            return `${systemBase}

FASE: INTRODUÇÃO
${systemPrompts.introduction.objective}

Passos:
${systemPrompts.introduction.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Abordagem: ${systemPrompts.introduction.approach}

INFORMAÇÕES DO USUÁRIO:
- Nome completo: ${user?.name || 'Não informado'}
- Papel no sistema: ${roleContext}
- Primeira interação: SIM

CONTEXTO DO PROJETO:
- Tipo de negócio: ${businessType}
- Perfil Inferido: ${dynamicProfile}
- Tom preferido: ${tone}

INSTRUÇÕES:
- Converse naturalmente, inferindo gênero e tratamento do nome
- ${systemPrompts.common.language}
- ${systemPrompts.common.uncertainty}`;
        }

        // Normal chat context
        return `${systemBase}

CAPACIDADES:
- ${capabilities}

CONTEXTO DO PROJETO:
- Tipo de negócio: ${businessType}
- Setor: ${projectContext.industry || 'geral'}
- Perfil de Negócio (Inferido): ${dynamicProfile}
- Tom de comunicação: ${tone}
${projectInstructions ? `- Instruções específicas: ${projectInstructions}` : ''}

PREFERÊNCIAS DO USUÁRIO:
- Nome: ${user?.name || 'Não informado'}
- Nome preferido: ${user?.preferred_name || 'Não definido'}
- Papel Profissional: ${roleContext}
- Primeira interação: ${!evaIntroduced ? 'SIM - Apresente-se!' : 'NÃO - Já se apresentou'}
- Período do dia: ${timeOfDay}
- Estilo de comunicação: ${communicationStyle}
- Nível de expertise: ${expertiseLevel}
${userInstructions ? `- Instruções personalizadas: ${userInstructions}` : ''}

INSTRUÇÕES IMPORTANTES:
- Se primeira interação, apresente-se de forma natural e use saudação apropriada ao período
- Converse naturalmente com ${user?.preferred_name || user?.name || 'o usuário'}, inferindo tratamento apropriado
- Adapte a resposta ao cargo do usuário (ex: mais estratégico para gerentes, mais operacional para analistas)
- Leve em conta o Perfil de Negócio inferido para dar respostas contextualizadas
- Seja ${tone === 'casual' ? 'mais descontraída' : 'formal'}, respeitosa e prestativa
- ${systemPrompts.common.response_length}
- Projeto atual: ${project?.name || 'CASH'}
- ${systemPrompts.common.uncertainty}
- ${systemPrompts.common.language}`;
    }

    /**
     * Build complete operate context
     * @param {Object} user - User object
     * @param {Object} project - Project object
     * @param {Object} screenContext - Current screen context
     * @param {Object} voiceSettings - Voice configuration
     * @param {Array} availableScreens - List of available screens
     * @param {Object} currentScreen - Current screen detailed definition
     * @param {string} dynamicProfile - Inferred business profile
     * @returns {string} Complete system prompt for operations
     */
    static buildOperateContext(user, project, screenContext, voiceSettings = {}, availableScreens = [], currentScreen = null, dynamicProfile = '', activeScreenData = null) {
        const systemBase = systemPrompts.operate.base;

        // Project context
        const projectContext = project?.eva_context || {};
        const businessType = projectContext.business_type || 'general';

        // User context
        const userPrefs = user?.eva_preferences || {};
        const evaIntroduced = user?.eva_introduced || false;

        // Time context
        const now = new Date();
        const hour = now.getHours();
        const timeOfDay = hour >= 5 && hour < 12 ? 'manhã' : hour >= 12 && hour < 19 ? 'tarde' : 'noite';

        // Voice settings
        const currentVoiceRate = voiceSettings.evaVoiceRate || 88;
        const currentVoiceGender = voiceSettings.evaVoiceMale ? 'M' : 'F';
        const currentVoiceEnabled = voiceSettings?.evaVoiceEnabled !== 0;

        // Format SEMANTIC screen data (The Eyes - High Fidelity)
        let activeScreenDataText = '';
        if (activeScreenData) {
            activeScreenDataText = `\n[DADOS VIVOS DA TELA ATUAL (Prioridade Alta)]:\n${JSON.stringify(activeScreenData, null, 2)}\n`;
        }

        // Format LEGACY screen context (The Eyes - DOM Scraper)
        let screenContextText = '';
        if (screenContext) {
            // Only add legacy context if semantic data is sparse, to save tokens
            // or keep it as backup.
            if (screenContext.title) screenContextText += `TELA (Contexto Visual): ${screenContext.title}\n`;
            // ... (keep legacy formatting logic derived from previous content)
            if (screenContext.tables) {
                screenContextText += `TABELAS (Visual):\n`;
                screenContext.tables.forEach((table, idx) => {
                    screenContextText += `Tabela ${idx + 1}: ${table.headers.join(' | ')}\n`;
                    // Limit rows to avoid token overload if semantic data exists
                    const rowLimit = activeScreenData ? 2 : 5;
                    screenContextText += `(Mostrando ${Math.min(table.rows.length, rowLimit)} de ${table.totalRows} linhas)\n`;
                    if (table.rows.length > 0) {
                        table.rows.slice(0, rowLimit).forEach((row, ridx) => {
                            screenContextText += `  ${ridx + 1}: ${row.join(' | ')}\n`;
                        });
                    }
                });
            }
        }

        return `${systemBase}

INFORMAÇÕES DO USUÁRIO:
- Nome completo: ${user?.name || 'Não informado'}
- Nome preferido: ${user?.preferred_name || 'Não definido'}
- Primeira interação: ${!evaIntroduced ? 'SIM - Apresente-se!' : 'NÃO - Já se apresentou'}
- Período do dia: ${timeOfDay}

CONTEXTO DO PROJETO:
- Tipo de negócio: ${businessType}
- Perfil Inferido: ${dynamicProfile}
- Projeto: ${project?.name || 'CASH'}

MAPA DO SISTEMA (Onde você pode buscar informações):
${systemMap.screens.map(s => `- [${s.name}]: ${s.description} (Rota: ${s.route})`).join('\n')}

DIRETRIZES DE ANÁLISE (METODOLOGIA FOCCUS):
${financialKnowledge.principles.map(p => `[${p.severity}] ${p.topic}: ${p.rule} -> ${p.action_if_violated || ''}`).join('\n')}

IMPORTANTE:
- Se primeira interação, apresente-se de forma natural e use saudação apropriada ao período
- Converse naturalmente com ${user?.preferred_name || user?.name || 'o usuário'}, inferindo tratamento e gênero apropriados
- Adapte suas ações ao Perfil Inferido do negócio quando relevante (ex: foco financeiro vs. operacional)
- USE O MAPA DO SISTEMA: Se o usuário perguntar algo que você não sabe, verifique qual tela pode ter a resposta e NAVEGUE até ela.
- USE AS DIRETRIZES: Ao analisar dados, sempre confronte com as regras da FOCCUS.

CONFIGURAÇÕES DE VOZ:
- Velocidade: ${currentVoiceRate} (0=Muito Lento, 50=Normal, 100=Muito Rápido)
- Gênero da voz: ${currentVoiceGender === 'M' ? 'Masculina' : 'Feminina'}
- Áudio: ${currentVoiceEnabled ? 'Ativado' : 'Desativado'}

CONTEXTO GLOBAL (Telas disponíveis):
${JSON.stringify(availableScreens?.map(s => ({ id: s.id, name: s.name, keywords: s.keywords })) || [])}

CONTEXTO LOCAL (Tela atual):
${currentScreen ? JSON.stringify({ id: currentScreen.id, description: currentScreen.description, fields: currentScreen.fields, actions: currentScreen.actions }) : "Nenhuma tela aberta (Dashboard)"}

${activeScreenDataText}

${screenContextText}

AÇÕES DISPONÍVEIS:
${Object.entries(systemPrompts.operate.actions).map(([key, desc]) => `- ${key}: ${desc}`).join('\n')}

**AJUSTES DE VELOCIDADE** - Escala Linear (0 a 100), onde 50 é NORMAL:
- "mais rápido" / "acelera" → Soma +10 (Ex: ${currentVoiceRate} -> ${Math.min(100, currentVoiceRate + 10)})
- "muito mais rápido" → Soma +25 (Ex: ${currentVoiceRate} -> ${Math.min(100, currentVoiceRate + 25)})
- "só um pouquinho mais rápido" → Soma +5 (Ex: ${currentVoiceRate} -> ${Math.min(100, currentVoiceRate + 5)})
- "mais devagar" / "desacelera" → Subtrai -10 (Ex: ${currentVoiceRate} -> ${Math.max(0, currentVoiceRate - 10)})
- "muito mais devagar" → Subtrai -25 (Ex: ${currentVoiceRate} -> ${Math.max(0, currentVoiceRate - 25)})
- "velocidade normal" → Define para 50

REGRAS:
${systemPrompts.operate.rules.map(r => `- ${r}`).join('\n')}`;
    }

    /**
     * Build dynamic business profile based on transaction data
     * @param {Object} db - Database connection
     * @param {number} projectId - Project ID
     * @returns {Promise<string>} Natural language business description
     */
    static async buildDynamicBusinessProfile(db, projectId) {
        if (!projectId) return "Projeto sem dados suficientes para inferência.";

        try {
            // 1. Analyze Income Types (What generates money?)
            const [incomeTypes] = await db.query(`
                SELECT DISTINCT t.nome 
                FROM entradas e 
                JOIN tipo_entrada t ON e.tipo_entrada_id = t.id 
                WHERE e.project_id = ? 
                LIMIT 5
            `, [projectId]);

            // 2. Analyze Production/Resale Types (What do they sell?)
            const [prodTypes] = await db.query(`
                SELECT DISTINCT t.label 
                FROM producao_revenda p 
                JOIN tipo_producao_revenda t ON p.tipo_id = t.id 
                WHERE p.project_id = ? 
                LIMIT 5
            `, [projectId]);

            // 3. Analyze Expense Types (Where does money go?)
            const [expenseTypes] = await db.query(`
                SELECT DISTINCT t.label 
                FROM saidas s 
                JOIN tipo_saida t ON s.tipo_saida_id = t.id 
                WHERE s.project_id = ? 
                LIMIT 5
            `, [projectId]);

            const incomes = incomeTypes.map(r => r.nome).join(', ');
            const products = prodTypes.map(r => r.label).join(', ');
            const expenses = expenseTypes.map(r => r.label).join(', ');

            let profile = "";

            if (incomes) profile += `Fontes de receita: ${incomes}. `;
            if (products) profile += `Comercializa/Produz: ${products}. `;
            if (expenses) profile += `Principais despesas: ${expenses}.`;

            if (!profile) return "Projeto novo ou sem dados históricos suficientes.";

            return `PERFIL DO NEGÓCIO (Inferido dos dados): ${profile}`;

        } catch (error) {
            console.error('Error building business profile:', error);
            return "Erro ao analisar perfil do negócio.";
        }
    }

    /**
     * Get business type description for context
     */
    static getBusinessTypeContext(businessType) {
        const contexts = {
            services: 'Empresa de serviços - Foco em receitas recorrentes, contratos e análise de rentabilidade por projeto',
            personal: 'Gestão financeira familiar - Foco em orçamento doméstico, controle de despesas e planejamento',
            retail: 'Comércio/Varejo - Foco em estoque, margem de lucro e fluxo de caixa',
            manufacturing: 'Indústria - Foco em custos de produção, matéria-prima e eficiência operacional',
            general: 'Gestão financeira geral'
        };

        return contexts[businessType] || contexts.general;
    }
}

module.exports = EvaContextBuilder;
