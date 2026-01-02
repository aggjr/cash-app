const systemPrompts = require('../config/eva-system-prompts');

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
     * @param {Object} options - Additional options (isIntroduction, etc)
     * @returns {string} Complete system prompt
     */
    static buildChatContext(user, project, options = {}) {
        const { isIntroduction = false } = options;

        // Level 1: System base
        const systemBase = systemPrompts.chat.base;
        const capabilities = systemPrompts.chat.capabilities.join('\n- ');

        // Level 2: Project context
        const projectContext = project?.eva_context || {};
        const businessType = projectContext.business_type || 'general';
        const tone = projectContext.tone || 'formal';
        const projectInstructions = projectContext.custom_instructions || '';

        // Level 3: User preferences
        const userPrefs = user?.eva_preferences || {};
        const communicationStyle = userPrefs.communication_style || 'padrão';
        const expertiseLevel = userPrefs.expertise_level || 'intermediário';
        const userInstructions = userPrefs.custom_instructions || '';

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
- Primeira interação: SIM

CONTEXTO DO PROJETO:
- Tipo de negócio: ${businessType}
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
- Tom de comunicação: ${tone}
${projectInstructions ? `- Instruções específicas: ${projectInstructions}` : ''}

PREFERÊNCIAS DO USUÁRIO:
- Nome: ${user?.name || 'Não informado'}
- Nome preferido: ${user?.preferred_name || 'Não definido'}
- Primeira interação: ${!evaIntroduced ? 'SIM - Apresente-se!' : 'NÃO - Já se apresentou'}
- Período do dia: ${timeOfDay}
- Estilo de comunicação: ${communicationStyle}
- Nível de expertise: ${expertiseLevel}
${userInstructions ? `- Instruções personalizadas: ${userInstructions}` : ''}

INSTRUÇÕES IMPORTANTES:
- Se primeira interação, apresente-se de forma natural e use saudação apropriada ao período
- Converse naturalmente com ${user?.preferred_name || user?.name || 'o usuário'}, inferindo tratamento apropriado
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
     * @returns {string} Complete system prompt for operations
     */
    static buildOperateContext(user, project, screenContext, voiceSettings = {}, availableScreens = [], currentScreen = null) {
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
        const currentVoiceEnabled = voiceSettings.evaVoiceEnabled !== 0;

        // Format screen context
        let screenContextText = '';
        if (screenContext) {
            if (screenContext.title) screenContextText += `TELA ATUAL: ${screenContext.title}\n`;

            if (screenContext.tables) {
                screenContextText += `TABELAS:\n`;
                screenContext.tables.forEach((table, idx) => {
                    screenContextText += `Tabela ${idx + 1}:\n`;
                    screenContextText += `Colunas: ${table.headers.join(' | ')}\n`;
                    screenContextText += `Total de ${table.totalRows} registros (mostrando ${table.rows.length})\n`;
                    if (table.rows.length > 0) {
                        screenContextText += `Primeiras linhas:\n`;
                        table.rows.slice(0, 3).forEach((row, ridx) => {
                            screenContextText += `  ${ridx + 1}: ${row.join(' | ')}\n`;
                        });
                    }
                    screenContextText += `\n`;
                });
            }

            if (screenContext.forms) {
                screenContextText += `FORMULÁRIOS:\n`;
                screenContext.forms.forEach((form, idx) => {
                    screenContextText += `Form ${idx + 1}:\n`;
                    form.fields.forEach(f => {
                        screenContextText += `  - ${f.label}: ${f.value || '(vazio)'}\n`;
                    });
                    screenContextText += `\n`;
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
- Projeto: ${project?.name || 'CASH'}

IMPORTANTE:
- Se primeira interação, apresente-se de forma natural e use saudação apropriada ao período
- Converse naturalmente com ${user?.preferred_name || user?.name || 'o usuário'}, inferindo tratamento e gênero apropriados

CONFIGURAÇÕES DE VOZ:
- Velocidade: ${currentVoiceRate} (0=Muito Lento, 50=Normal, 100=Muito Rápido)
- Gênero da voz: ${currentVoiceGender === 'M' ? 'Masculina' : 'Feminina'}
- Áudio: ${currentVoiceEnabled ? 'Ativado' : 'Desativado'}

CONTEXTO GLOBAL (Telas disponíveis):
${JSON.stringify(availableScreens?.map(s => ({ id: s.id, name: s.name, keywords: s.keywords })) || [])}

CONTEXTO LOCAL (Tela atual):
${currentScreen ? JSON.stringify({ id: currentScreen.id, description: currentScreen.description, fields: currentScreen.fields, actions: currentScreen.actions }) : "Nenhuma tela aberta (Dashboard)"}

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
