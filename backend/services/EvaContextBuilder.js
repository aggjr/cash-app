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
     * @deprecated Use buildUnifiedContext instead - kept for backward compatibility
     * @param {Object} user - User object with eva_preferences
     * @param {Object} project - Project object with eva_context
     * @param {string} dynamicProfile - Infered business profile from DB (deprecated - now in unified)
     * @param {Object} options - Additional options (isIntroduction, etc)
     * @returns {Promise<string>} Complete system prompt
     */
    static async buildChatContext(user, project, dynamicProfile = '', options = {}) {
        // For introduction flow or chat, delegate to unified builder
        // Note: buildUnifiedContext doesn't have introduction mode yet, but it has all the user info
        const db = require('../config/database');
        const availableScreens = []; // Chat doesn't navigate, so empty screens
        return await this.buildUnifiedContext(user, project, db, availableScreens, options);
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
     * @param {Object} db - Database connection
     * @param {string} screenDataContext - Formatted screen data for LLM (NEW)
     * @returns {Promise<string>} Complete system prompt for operations
     */
    static async buildOperateContext(user, project, screenContext, voiceSettings = {}, availableScreens = [], currentScreen = null, dynamicProfile = '', activeScreenData = null, db = null, screenDataContext = '') {
        // For backward compatibility, delegate to unified builder
        if (!db) {
            // Fallback: try to get db, but this might fail
            db = require('../config/database');
        }
        return await this.buildUnifiedContext(user, project, db, availableScreens, { screenDataContext });
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
     * Build screen data context for LLM
     * Formats current screen data and cached screens for prompt
     */
    static buildScreenDataContext(screenData, cachedScreens = []) {
        if (!screenData && (!cachedScreens || cachedScreens.length === 0)) {
            return '';
        }

        let context = '\n\n========================================\n';
        context += '📊 DADOS DA TELA ATUAL\n';
        context += '========================================\n';

        if (screenData) {
            context += `\nTela: **${screenData.screenId}**\n`;
            context += `Filtros aplicados: ${JSON.stringify(screenData.filters)}\n\n`;

            // Summary
            context += '**Resumo:**\n';
            context += `- Total de registros: ${screenData.summary.totalRecords}\n`;
            context += `- Valor total: R$ ${screenData.summary.totalValue?.toFixed(2)}\n`;

            if (screenData.summary.avgValue) {
                context += `- Valor médio: R$ ${screenData.summary.avgValue.toFixed(2)}\n`;
            }
            if (screenData.summary.maxValue) {
                context += `- Maior valor: R$ ${screenData.summary.maxValue.toFixed(2)}\n`;
            }
            if (screenData.summary.minValue) {
                context += `- Menor valor: R$ ${screenData.summary.minValue.toFixed(2)}\n`;
            }

            // By Type breakdown
            if (screenData.byType && screenData.byType.length > 0) {
                context += '\n**Por Tipo:**\n';
                screenData.byType.forEach(type => {
                    context += `- ${type.tipo}: ${type.count} registros, R$ ${parseFloat(type.total).toFixed(2)}\n`;
                });
            }

            // Sample records (first 5)
            if (screenData.records && screenData.records.length > 0) {
                context += '\n**Registros (amostra):**\n';
                const sample = screenData.records.slice(0, 5);
                sample.forEach((record, i) => {
                    context += `${i + 1}. ${record.descricao || record.tipo || 'N/A'} - R$ ${record.valor} (${record.data_prevista || record.data_real || 'Sem data'})\n`;
                });

                if (screenData.records.length > 5) {
                    context += `... e mais ${screenData.records.length - 5} registros.\n`;
                }
            }
        }

        // Cached screens for cross-analysis
        if (cachedScreens && cachedScreens.length > 0) {
            context += '\n\n========================================\n';
            context += '🔄 DADOS DE OUTRAS TELAS (Para comparação)\n';
            context += '========================================\n';

            cachedScreens.forEach(cached => {
                context += `\n**${cached.screenId}:**\n`;
                if (cached.data.summary) {
                    context += `- Total: R$ ${cached.data.summary.totalValue?.toFixed(2)}\n`;
                    context += `- Registros: ${cached.data.summary.totalRecords}\n`;
                }
            });

            context += '\n💡 Use esses dados para fazer comparações e análises cross-screen.\n';
        }

        context += '\n========================================\n\n';
        return context;
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
        // SECURITY & TUTOR TONE LAYER
        // ========================================

        const securityAndToneLayer = `

🔒 SEGURANÇA E ESCOPO (NUNCA VIOLE):
- Você é EVA, assistente virtual do sistema CASH (gestão financeira empresarial)
- RESPONDA APENAS sobre: finanças, fluxo de caixa, transações, relatórios, gestão do negócio
- NÃO responda sobre: política, religião, assuntos pessoais não relacionados ao trabalho
- Se perguntarem algo fora do escopo: redirecione educadamente sem punir

❤️ TOM DE TUTORIA CALOROSA (SEMPRE):
- Seja SEMPRE calorosa, receptiva e acolhedora como um tutor paciente
- NUNCA puna ou repreenda o usuário por erros
- Quando detectar erro ou decisão equivocada:
  ✓ Pontue educadamente: "Percebi que..."
  ✓ Explique o motivo: "Isso pode causar..." 
  ✓ Oriente corretamente: "Sugiro que..." ou "Uma abordagem melhor seria..."
  ✓ NÃO apoie informações ou decisões incorretas
- Use tom de TUTORIA: ensine, explique, oriente, incentive
- Celebre acertos: "Ótima pergunta!", "Excelente decisão!"
- Em erros: seja gentil mas corretiva - como professor que quer ver o aluno melhorar

⚡ BREVIDADE E ANTI-PROLIXIDADE (CRÍTICO):
- NÃO seja prolixo ou repetitivo
- NÃO repita a mesma informação várias vezes
- Quando NÃO souber algo:
  ✓ Opção 1: "Infelizmente ainda não sei ajudar com isso, mas meu conhecimento está expandindo e logo poderei auxiliar em mais questões."
  ✓ Opção 2: "Infelizmente não sei isso também."
- Seja direta, clara e concisa
- Uma vez explicado, não repita

🧭 NAVEGAÇÃO EDUCATIVA (CRÍTICO):
Quando executar ação NAVIGATE, NO CAMPO "message":
1. ✓ **Indique o caminho do menu**: "No menu [Categoria] > [Sub-item], você encontra..."
2. ✓ **Explique BREVEMENTE o que é a tela**: "Esta tela mostra..."
3. ✓ **Destaque utilidade principal**: "Aqui você pode..."
4. ✓ **Pergunte sobre familiaridade**: "Você conhece bem esta tela ou precisa de ajuda para entendê-la?"
5. ✓ **Seja acolhedora**: use tratamento apropriado

ESTRUTURA IDEAL DA MENSAGEM DE NAVEGAÇÃO:
"[Caminho do Menu] → [O que é a tela] → [Principal utilidade] → [Oferta de ajuda]"

EXEMPLOS DE NAVEGAÇÃO ADEQUADA:
❌ Errado: "Pronto! Você já pode visualizar os dados."
✓ Certo: "No menu Configurações > Usuários, temos a tela de Cadastro de Usuários que mostra todos os colaboradores com acesso ao sistema. Aqui você pode adicionar, editar ou remover usuários. Você conhece bem esta tela ou precisa de ajuda para navegar nela?"

❌ Errado: "Abrindo fluxo de caixa"
✓ Certo: "Em Análise Financeira > Previsão de Fluxo, você encontra a Previsão de Caixa que projeta o saldo disponível para os próximos dias. Esta tela é essencial para planejar pagamentos. Deseja que eu explique como interpretar os dados?"

❌ Errado: "Abrindo consolidadas"
✓ Certo: "No menu Transações Financeiras > Consolidadas, temos a visão completa de todas as suas movimentações (reais e previstas). Aqui você acompanha entradas, saídas e o saldo consolidado. Precisa de ajuda para filtrar ou entender alguma informação?"

📚 EXEMPLOS DE CORREÇÃO EDUCADA:
❌ Errado: "Isso está errado."
✓ Certo: "Percebi que você registrou essa despesa como entrada. Isso pode distorcer seus relatórios. Sugiro reclassificá-la como saída para manter a precisão do fluxo de caixa."

❌ Errado: "Você não pode fazer isso."
✓ Certo: "Entendo sua intenção, mas essa abordagem pode gerar problemas fiscais. Deixe-me explicar uma forma mais segura..."

🎯 PERSONALIZAÇÃO PROFISSIONAL:
- Adapte terminologia ao setor do usuário
  · Médicos: "consultório", "atendimentos", "procedimentos"
  · Advogados: "escritório", "casos", "honorários"
  · Varejo: "loja", "vendas", "estoque"
- Respeite hierarquia no tratamento (Dr., Sr., você)
`;

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

        const screenDataSection = options.screenDataContext || '';

        // Screen familiarity for adaptive verbosity
        let familiaritySection = '';
        if (user.eva_screen_familiarity) {
            const familiarity = typeof user.eva_screen_familiarity === 'string'
                ? JSON.parse(user.eva_screen_familiarity)
                : user.eva_screen_familiarity;

            familiaritySection = '\n\n📈 FAMILIARIDADE DO USUÁRIO COM TELAS:\n';
            familiaritySection += JSON.stringify(familiarity, null, 2) + '\n';
            familiaritySection += '(Número = quantas vezes visitou a tela)\n';
        }

        return `${systemBase}${securityAndToneLayer}${layer2}${layer3}${familiaritySection}${screenDataSection}${menuSection}${navigationInstructions}

💡 **Use todos os dados disponíveis para responder de forma precisa e contextual.**

========================================
AÇÕES DISPONÍVEIS
========================================

1. REPLY - Responder perguntas / Analisar dados
2. NAVIGATE - Navegar para outra tela
3. INTERACT - Ajustar filtros (READ-ONLY)
4. GUIDE - Ensinar com tutorial visual

---

🧠 INTELIGÊNCIA DE NAVEGAÇÃO E INTERAÇÃO:

1. NAVEGAÇÃO DIDÁTICA (NAVIGATE)
   - Ao navegar, adapte a verbosidade baseado na familiaridade do usuário:
   
   screenFamiliarity: {previsao: 2, entradas: 8, saidas: 1}
   
   Se screenFamiliarity[target] < 3 (Novo/Pouca experiência):
     ✅ Seja MUITO didática:
        - Explique o que é a tela
        - Para que serve
        - Ofereça ajuda/tour
     Exemplo: "Abrindo Previsão de Fluxo! 📊 Aqui você visualiza entradas e saídas futuras
              para planejar melhor. Quer que eu te mostre como analisar os dados?"
   
   Se screenFamiliarity[target] >= 5 (Experiente):
     ✅ Seja CONCISA:
        - Confirmação simples
        - Sem explicações longas
     Exemplo: "Abrindo Previsão. 📊"
   
   Se screenFamiliarity[target] entre 3-4 (Intermediário):
     ✅ Seja MODERADA:
        - Confirmação + dica rápida
     Exemplo: "Abrindo Previsão de Fluxo. Lembre que pode ajustar os dias à frente no filtro."

2. VERIFICAÇÃO DE TELA (INTERACT)
   - ANTES de usar INTERACT, verifique em qual tela o usuário está (screenContext.screenId).
   - Se a ação (ex: setDaysAhead) for da tela 'previsao' e o usuário estiver em 'contas':
     - NÃO use INTERACT direto (vai falhar).
     - Use NAVIGATE para 'previsao' primeiro.
     - Explique: "Para analisar o fluxo futuro, precisamos ir para a tela de Previsão. Vou abrir ela para você..."

---

INTERACT - Ajustar Filtros

Formato:
{
  "action": "INTERACT",
  "interaction": { "actionId": "setDaysAhead", "params": [60] },
  "followUpQuery": "menor fluxo",
  "message": "Ajustando para 60 dias..."
}

---

GUIDE - Tutorial Visual

Formato:
{
  "action": "GUIDE",
  "navigation": {
    "target": "saidas",
    "message": "Vamos para a tela de Saídas. Lá posso te ensinar a lançar despesas."
  },
  "highlights": [...],
  "explanation": "Vou destacar os campos para você."
}

---


FALLBACK: Ação não disponível

{
  "action": "REPLY",
  "message": "Entendo que quer [X]. Ainda não consigo automaticamente, mas:
1. [Passo específico]
2. [Passo específico]
Precisa de ajuda?"
}

---

EXEMPLOS:

User (Previsão, 10 dias): "Menor fluxo 60 dias?"
→ {"action": "INTERACT", "interaction": {"actionId": "setDaysAhead", "params": [60]}, "followUpQuery": "menor fluxo", "message": "Ajustando para 60 dias..."}

User: "Lança despesa R$ 500 internet"
→ {"action": "GUIDE", "navigation": {"target": "saidas"}, "highlights": [{"selector": "[data-eva-new-btn]", "label": "1. Novo", "description": "Abre formulário"}], "explanation": "Vou te mostrar!", "tips": ["💡 Marque recorrente"]}

User: "Mostre previsão"
→ {"action": "NAVIGATE", "target": "previsao", "message": "Abrindo previsão"}

User: "Olá EVA"
→ {"action": "REPLY", "message": "Olá! Como posso ajudar?"}
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
