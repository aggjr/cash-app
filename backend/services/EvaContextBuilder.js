const systemPrompts = require('../config/eva-system-prompts');
const financialKnowledge = require('../config/eva-financial-knowledge');
const systemMap = require('../config/eva-system-map');
const EvaSecurityValidator = require('../utils/evaSecurityValidator');

/**
 * EVA Context Builder Service - Version 2.0
 * Unified 3-layer architecture with security, caching, and preference hierarchy:
 * 
 * Layer 1: System (global personality and capabilities)
 * Layer 2: Project/Business (eva_context + inferred profile from transactions)
 * Layer 3: User (eva_preferences + job_title/department)
 * 
 * Improvements:
 * - Versioned JSON schemas
 * - Cached business profile inference
 * - Clear preference hierarchy (user override > inference > LLM default)
 * - Input validation and sanitization
 * - Prompt injection protection
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
     * @deprecated Use buildUnifiedContext instead - kept for backward compatibility
     * @param {Object} user - User object
     * @param {Object} project - Project object
     * @param {Object} screenContext - Current screen context (not used in unified)
     * @param {Object} voiceSettings - Voice configuration (not used in unified)
     * @param {Array} availableScreens - List of available screens
     * @param {Object} currentScreen - Current screen detailed definition (not used in unified)
     * @param {string} dynamicProfile - Inferred business profile (deprecated - now cached in DB)
     * @param {Object} activeScreenData - Active screen data (not used in unified)
     * @returns {Promise<string>} Complete system prompt for operations
     */
    static async buildOperateContext(user, project, screenContext, voiceSettings = {}, availableScreens = [], currentScreen = null, dynamicProfile = '', activeScreenData = null) {
        // For backward compatibility, delegate to unified builder
        // Note: We need db connection which isn't passed here, so we'll need to get it
        const db = require('../config/database');
        return await this.buildUnifiedContext(user, project, db, availableScreens, {});
    }
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
    try {
        // Circular reference handler
        const seen = new WeakSet();
        const jsonStr = JSON.stringify(activeScreenData, (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) return "[Circular]";
                seen.add(value);
            }
            return value;
        }, 2);

        const maxLength = 2000; // 2000 chars max for now
        const truncated = jsonStr.length > maxLength ? jsonStr.substring(0, maxLength) + '\n... (truncated)' : jsonStr;
        activeScreenDataText = `\n[DADOS VIVOS DA TELA ATUAL (Prioridade Alta)]:\n${truncated}\n`;
    } catch (e) {
        console.error('[EvaContextBuilder] Error stringifying activeScreenData:', e);
        activeScreenDataText = '\n[DADOS DA TELA: Erro ao processar]\n';
    }
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
- Nome: ${user?.preferred_name || user?.name || 'Usuário'}
- Período: ${timeOfDay}
${user?.job_title ? `- Cargo: ${user.job_title}` : ''}
${user?.department ? `- Departamento: ${user.department}` : ''}

ADAPTAÇÃO DE COMUNICAÇÃO:
Adapte DINAMICAMENTE sua comunicação ao perfil do usuário acima:
- **Pronomes de tratamento**: Escolha entre "Dr.", "Sr.", "Sra.", "você", etc., baseado no cargo
- **Nível de formalidade**: Ajuste entre formal, profissional ou casual conforme apropriado
- **Vocabulário**: Use termos técnicos ou simplificados conforme o contexto do cargo/departamento
- **Tom**: Estratégico, analítico, prático, educativo - decida dinamicamente

Seja natural e apropriado. Não force formalidade desnecessária nem seja casual demais.
${dynamicProfile}
ÁRVORE DE MENUS DO SISTEMA:
${this.formatMenuTree(availableScreens)}

INSTRUÇÕES PARA NAVEGAÇÃO:
1. Quando o usuário pedir para ver algo, analise a ÁRVORE DE MENUS acima
2. Encontre o item do menu mais apropriado
3. Use o ID EXATO do menu no campo "target" (ex: "previsao", não "fluxo-caixa")
4. Priorize correspondência de palavras-chave (keywords)

AÇÕES DISPONÍVEIS:
- REPLY: Responder perguntas simples
- NAVIGATE: Abrir uma tela (use target: {id do menu})

FORMATO DE RESPOSTA (JSON):
{
  "action": "REPLY" ou "NAVIGATE",
  "message": "explicação para o usuário",
  "target": "id-exato-do-menu" (apenas se NAVIGATE)
}

EXEMPLOS:
Usuário: "mostre a previsão de caixa"
Resposta: {"action": "NAVIGATE", "target": "previsao", "message": "Abrindo previsão de fluxo de caixa"}

Usuário: "você consegue me ouvir?"
Resposta: {"action": "REPLY", "message": "Sim, consigo te ouvir perfeitamente!"}
`;
    }

    /**
     * Format menu tree for LLM understanding (RECURSIVE - supports infinite nesting)
     * Includes ALL metadata: id, label, description, route, keywords, submenus
     */
    static formatMenuTree(screens, depth = 0) {
    if (!screens || !Array.isArray(screens)) return 'Nenhum menu disponível';

    const indent = '  '.repeat(depth); // 2 spaces per level

    return screens.map(screen => {
        // Build metadata string with ALL available information
        const parts = [];

        // Always include ID and label
        parts.push(`${indent}- **${screen.label}** (id: "${screen.id}")`);

        // Add description if available
        if (screen.description) {
            parts.push(`${indent}  Descrição: ${screen.description}`);
        }

        // Add route if available
        if (screen.route) {
            parts.push(`${indent}  Rota: ${screen.route}`);
        }

        // Add keywords if available
        if (screen.keywords && screen.keywords.length > 0) {
            parts.push(`${indent}  Keywords: ${screen.keywords.join(', ')}`);
        }

        // Recursively process submenus (INFINITE DEPTH)
        if (screen.submenu && Array.isArray(screen.submenu) && screen.submenu.length > 0) {
            parts.push(`${indent}  Submenus:`);
            parts.push(this.formatMenuTree(screen.submenu, depth + 2)); // Recursive call
        }

        return parts.join('\n');
    }).join('\n\n'); // Double newline between root-level items for clarity
}

    /**
     * Build dynamic business profile based on transaction data
     * Returns structured data for LLM to infer business context dynamically
     * @param {Object} db - Database connection
     * @param {number} projectId - Project ID
     * @returns {Promise<string>} Structured business context for LLM inference
     */
    static async buildDynamicBusinessProfile(db, projectId) {
    if (!projectId) return "";

    try {
        // 1. Analyze Income Types (What generates money?)
        const [incomeTypes] = await db.query(`
                SELECT DISTINCT t.nome 
                FROM entradas e 
                JOIN tipo_entrada t ON e.tipo_entrada_id = t.id 
                WHERE e.project_id = ? AND e.active = 1
                ORDER BY t.nome
                LIMIT 10
            `, [projectId]);

        // 2. Analyze Production/Resale Types (What do they sell/produce?)
        const [prodTypes] = await db.query(`
                SELECT DISTINCT t.label 
                FROM producao_revenda p 
                JOIN tipo_producao_revenda t ON p.tipo_id = t.id 
                WHERE p.project_id = ? AND p.active = 1
                ORDER BY t.label
                LIMIT 10
            `, [projectId]);

        // 3. Analyze Expense Types (Where does money go?)
        const [expenseTypes] = await db.query(`
                SELECT DISTINCT t.label 
                FROM saidas s 
                JOIN tipo_saida t ON s.tipo_saida_id = t.id 
                WHERE s.project_id = ? AND s.active = 1
                ORDER BY t.label
                LIMIT 10
            `, [projectId]);

        // Format for LLM understanding
        let context = "\n\nCONTEXTO DO NEGÓCIO (Análise Dinâmica):\n";

        if (incomeTypes.length > 0) {
            context += `TIPOS DE ENTRADA (Fontes de receita):\n`;
            context += incomeTypes.map(r => `  - ${r.nome}`).join('\n') + '\n\n';
        }

        if (prodTypes.length > 0) {
            context += `TIPOS DE PRODUÇÃO/REVENDA (O que comercializa):\n`;
            context += prodTypes.map(r => `  - ${r.label}`).join('\n') + '\n\n';
        }

        if (expenseTypes.length > 0) {
            context += `TIPOS DE SAÍDA (Principais despesas):\n`;
            context += expenseTypes.map(r => `  - ${r.label}`).join('\n') + '\n\n';
        }

        if (!incomeTypes.length && !prodTypes.length && !expenseTypes.length) {
            return ""; // No data to infer from
        }

        context += `INSTRUÇÃO: Com base nos tipos de transações acima, infira dinamicamente:\n`;
        context += `- O ramo de atuação desta empresa (ex: consultoria, varejo, indústria, serviços)\n`;
        context += `- O segmento específico\n`;
        context += `- O modelo de negócio (recorrente, projeto, produto)\n`;
        context += `- Adapte seu vocabulário, sugestões e análises para esse contexto específico\n`;

        return context;

    } catch (error) {
        console.error('Error building business profile:', error);
        return "";
    }
}

    /**
     * Build unified context for EVA (all 3 layers with security)
     * This is the main function that combines everything
     * @param {Object} user - User object
     * @param {Object} project - Project object
     * @param {Object} db - Database connection (for dynamic profile)
     * @param {Array} availableScreens - Menu structure
     * @param {Object} options - Additional options
     * @returns {Promise<string>} Complete unified prompt
     */
    static async buildUnifiedContext(user, project, db, availableScreens = [], options = {}) {
    const systemBase = systemPrompts.operate?.base || systemPrompts.chat?.base;

    // Get time context
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay = hour >= 5 && hour < 12 ? 'manhã' : hour >= 12 && hour < 19 ? 'tarde' : 'noite';

    // ========================================
    // LAYER 2: PROJECT/BUSINESS CONTEXT
    // ========================================

    // Validate and sanitize project context
    const rawProjectContext = project?.eva_context || {};
    const projectContext = EvaSecurityValidator.validateEvaContext(rawProjectContext);

    // Check if we need to refresh cached profile
    const needsRefresh = !projectContext.inferred_profile ||
        EvaSecurityValidator.needsMigration(projectContext);

    let businessContext = '';

    // Use cached inference if available and fresh
    if (projectContext.inferred_profile && !needsRefresh) {
        businessContext = projectContext.inferred_profile;
    } else if (db && project?.id) {
        // Generate fresh inference from transaction types
        businessContext = await this.buildDynamicBusinessProfile(db, project.id);
        // Note: Cache update should be done separately to avoid blocking
    }

    // Build Layer 2 prompt section
    let layer2 = '\n\nCAMADA 2 - CONTEXTO DO NEGÓCIO:\n';

    if (projectContext.business_type) {
        layer2 += `Tipo de negócio (salvo): ${projectContext.business_type}\n`;
    }

    if (projectContext.industry) {
        layer2 += `Setor: ${projectContext.industry}\n`;
    }

    if (businessContext) {
        layer2 += businessContext; // Dynamic inference from transactions
    }

    if (projectContext.custom_instructions) {
        layer2 += `\nInstruções específicas do projeto: ${projectContext.custom_instructions}\n`;
    }

    if (projectContext.tone) {
        layer2 += `Tom preferido (salvo): ${projectContext.tone}\n`;
    } else {
        layer2 += `Tom: Escolha o mais adequado dinamicamente\n`;
    }

    // ========================================
    // LAYER 3: USER PREFERENCES & PROFILE
    // ========================================

    // Validate and sanitize user preferences
    const rawUserPrefs = user?.eva_preferences || {};
    const userPrefs = EvaSecurityValidator.validateEvaPreferences(rawUserPrefs);

    // Clear preference hierarchy implementation
    const communicationStyle = this.getCommunicationStyle(user, userPrefs);
    const expertiseLevel = this.getExpertiseLevel(user, userPrefs);
    const formalityLevel = this.getFormalityLevel(user, userPrefs);

    let layer3 = '\nCAMADA 3 - PERFIL DO USUÁRIO:\n';
    layer3 += `- Nome: ${user?.preferred_name || user?.name || 'Usuário'}\n`;
    layer3 += `- Período: ${timeOfDay}\n`;

    if (user?.job_title) {
        layer3 += `- Cargo: ${user.job_title}\n`;
    }

    if (user?.department) {
        layer3 += `- Departamento: ${user.department}\n`;
    }

    layer3 += '\nADAPTAÇÃO DE COMUNICAÇÃO:\n';
    layer3 += 'Adapte DINAMICAMENTE sua comunicação ao perfil do usuário:\n';
    layer3 += `- **Pronomes de tratamento**: ${formalityLevel}\n`;
    layer3 += `- **Estilo de comunicação**: ${communicationStyle}\n`;
    layer3 += `- **Nível de expertise**: ${expertiseLevel}\n`;
    layer3 += '- **Vocabulário**: Use termos apropriados ao cargo/departamento\n';
    layer3 += '- **Tom**: Estratégico, analítico, prático ou educativo conforme contexto\n\n';
    layer3 += 'Seja natural e apropriado. Não force formalidade desnecessária nem seja casual demais.\n';

    if (userPrefs.custom_instructions) {
        layer3 += `\nPreferências pessoais: ${userPrefs.custom_instructions}\n`;
    }

    // ========================================
    // MENU STRUCTURE
    // ========================================

    let menuSection = '\n\nÁRVORE DE MENUS DO SISTEMA:\n';
    menuSection += this.formatMenuTree(availableScreens);

    let navigationInstructions = '\n\nINSTRUÇÕES PARA NAVEGAÇÃO:\n';
    navigationInstructions += '1. Quando o usuário pedir para ver algo, analise a ÁRVORE DE MENUS acima\n';
    navigationInstructions += '2. Encontre o item do menu mais apropriado\n';
    navigationInstructions += '3. Use o ID EXATO do menu no campo "target" (ex: "previsao", não "fluxo-caixa")\n';
    navigationInstructions += '4. Priorize correspondência de palavras-chave (keywords)\n';

    // ========================================
    // FINAL ASSEMBLY
    // ========================================

    return `${systemBase}${layer2}${layer3}${menuSection}${navigationInstructions}

AÇÕES DISPONÍVEIS:
- REPLY: Responder perguntas simples
- NAVIGATE: Abrir uma tela (use target: {id do menu})

FORMATO DE RESPOSTA (JSON):
{
  "action": "REPLY" ou "NAVIGATE",
  "message": "explicação para o usuário",
  "target": "id-exato-do-menu" (apenas se NAVIGATE)
}

EXEMPLOS:
Usuário: "mostre a previsão de caixa"
Resposta: {"action": "NAVIGATE", "target": "previsao", "message": "Abrindo previsão de fluxo de caixa"}

Usuário: "você consegue me ouvir?"
Resposta: {"action": "REPLY", "message": "Sim, consigo te ouvir perfeitamente!"}
`;
}

    /**
     * Get communication style with clear hierarchy
     * Priority: user override > inferred from job > LLM default
     */
    static getCommunicationStyle(user, sanitizedPrefs) {
    // Priority 1: User explicit preference
    if (sanitizedPrefs.communication_style) {
        return `${sanitizedPrefs.communication_style} (preferência salva do usuário)`;
    }

    // Priority 2: Infer from job title
    const title = (user?.job_title || '').toLowerCase();
    if (title.includes('diretor') || title.includes('ceo') || title.includes('gerente')) {
        return 'Estratégico/Executivo (inferido do cargo)';
    }
    if (title.includes('analista') || title.includes('contador')) {
        return 'Técnico/Analítico (inferido do cargo)';
    }
    if (title.includes('vendedor') || title.includes('operacional')) {
        return 'Prático/Operacional (inferido do cargo)';
    }

    // Priority 3: LLM decides
    return 'Adapte dinamicamente ao contexto da conversa';
}

    /**
     * Get expertise level with clear hierarchy
     */
    static getExpertiseLevel(user, sanitizedPrefs) {
    // Priority 1: User explicit preference
    if (sanitizedPrefs.expertise_level) {
        return `${sanitizedPrefs.expertise_level} (preferência salva)`;
    }

    // Priority 2: Infer from job title
    const title = (user?.job_title || '').toLowerCase();
    if (title.includes('diretor') || title.includes('gerente') || title.includes('senior')) {
        return 'Avançado (inferido do cargo)';
    }
    if (title.includes('junior') || title.includes('assistente')) {
        return 'Intermediário (inferido do cargo)';
    }

    // Priority 3: LLM decides
    return 'Avalie dinamicamente pelas perguntas do usuário';
}

    /**
     * Get formality level for pronoun selection
     */
    static getFormalityLevel(user, sanitizedPrefs) {
    const title = (user?.job_title || '').toLowerCase();

    // High formality for executives
    if (title.includes('diretor') || title.includes('ceo') || title.includes('presidente')) {
        return 'Use "Sr./Sra." ou "Dr./Dra." (cargo executivo)';
    }

    // Medium formality for managers and professionals
    if (title.includes('gerente') || title.includes('coordenador') || title.includes('consultor')) {
        return 'Use "Sr./Sra." ou "você" profissionalmente (cargo de gestão)';
    }

    // Casual for operational roles
    if (title.includes('vendedor') || title.includes('operador') || title.includes('assistente')) {
        return 'Use "você" de forma amigável (cargo operacional)';
    }

    // Default: LLM decides
    return 'Escolha entre "Dr.", "Sr.", "Sra.", "você" baseado no contexto';
}
}

module.exports = EvaContextBuilder;
