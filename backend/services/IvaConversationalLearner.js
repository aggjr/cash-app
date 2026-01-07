/**
 * IVA Conversational Learner
 * 
 * Sistema de aprendizado conversacional ativo com lógica de primeira ordem.
 * 
 * Quando a IVA falha em completar uma tarefa, ela:
 * 1. Analisa o contexto da falha (raciocínio lógico)
 * 2. Faz perguntas inteligentes ao usuário
 * 3. Extrai conhecimento das respostas
 * 4. Registra o aprendizado
 * 5. Tenta novamente com o novo conhecimento
 */

const IvaKnowledgeManager = require('./IvaKnowledgeManager');

class IvaConversationalLearner {

    /**
     * Estados de aprendizado
     */
    static STATES = {
        CONFIDENT: 'CONFIDENT',           // Sabe o que fazer
        EXPLORING: 'EXPLORING',           // Tentando descobrir
        SEEKING_GUIDANCE: 'SEEKING_GUIDANCE',  // Precisa de ajuda
        GUIDED_LEARNING: 'GUIDED_LEARNING'     // Aprendendo com usuário
    };

    /**
     * Lidar com falha na extração de dados
     */
    async handleDataExtractionFailure(context) {
        const { userQuery, currentScreen, attemptedExtraction, screenConfirmed } = context;

        // LÓGICA DE PRIMEIRA ORDEM
        const reasoning = this.analyzeFailure(context);

        /*
        Raciocínio:
        Premissa 1: Usuário confirmou que estamos na tela certa
        Premissa 2: Tentei extrair dado mas falhei
        Conclusão: Não sei COMO extrair o dado desta tela
        Ação: PERGUNTAR ao usuário
        */

        if (reasoning.screenConfirmed && reasoning.dataNotFound) {
            return await this.askForGuidance({
                query: userQuery,
                screen: currentScreen,
                whatITried: attemptedExtraction
            });
        }

        // Se não confirmou tela, perguntar sobre navegação
        if (!reasoning.screenConfirmed) {
            return await this.askAboutNavigation(userQuery);
        }

        return null;
    }

    /**
     * Analisar falha com lógica de primeira ordem
     */
    analyzeFailure(context) {
        return {
            screenConfirmed: context.screenConfirmed === true,
            dataNotFound: context.attemptedExtraction && context.attemptedExtraction.success === false,
            hasAttempts: context.attemptedExtraction && context.attemptedExtraction.attempts > 0,
            errorType: context.attemptedExtraction?.error || 'unknown'
        };
    }

    /**
     * Fazer pergunta inteligente sobre como encontrar dado
     */
    async askForGuidance({ query, screen, whatITried }) {
        const question = this.buildIntelligentQuestion({
            userIntent: query,
            currentLocation: screen,
            failedAttempts: whatITried?.attempts || []
        });

        return {
            mode: this.STATES.SEEKING_GUIDANCE,
            question: question,
            awaitingUserResponse: true,
            learningContext: {
                original_query: query,
                screen_id: screen,
                knowledge_type: 'DATA',
                partial_knowledge: whatITried
            }
        };
    }

    /**
     * Fazer pergunta sobre navegação
     */
    async askAboutNavigation(query) {
        return {
            mode: this.STATES.SEEKING_GUIDANCE,
            question: `Tentei encontrar a tela para "${query}", mas não consegui. Você sabe em qual menu ela está?`,
            awaitingUserResponse: true,
            learningContext: {
                original_query: query,
                knowledge_type: 'NAVIGATION'
            }
        };
    }

    /**
     * Construir pergunta inteligente baseada no contexto
     */
    buildIntelligentQuestion({ userIntent, currentLocation, failedAttempts }) {
        let question = `Estamos na tela ${currentLocation}, mas não encontrei "${userIntent}".\n\n`;

        if (failedAttempts && failedAttempts.length > 0) {
            question += `Tentei procurar em:\n`;
            failedAttempts.forEach(attempt => {
                question += `- ${attempt.location} (sem sucesso)\n`;
            });
            question += `\n`;
        }

        question += `Você pode me explicar como encontrar essa informação?\n\n`;
        question += `Por exemplo:\n`;
        question += `- "Está na tabela, coluna X, linha Y"\n`;
        question += `- "Está no card de resumo no topo"\n`;
        question += `- "Precisa aplicar filtro Z primeiro"`;

        return question;
    }

    /**
     * Processar resposta do usuário e extrair conhecimento
     */
    async processUserGuidance(userResponse, learningContext, userId) {
        // Entrar em modo de aprendizado guiado
        const extractedKnowledge = await this.extractKnowledgeFromGuidance(
            userResponse,
            learningContext
        );

        if (!extractedKnowledge) {
            return {
                status: 'FAILED',
                message: 'Não consegui entender a explicação. Pode reformular?'
            };
        }

        // Registrar conhecimento
        const result = await IvaKnowledgeManager.learn({
            layer_type: 'MODULE',
            module_code: 'CASH',
            knowledge_type: learningContext.knowledge_type,
            knowledge_key: this.generateKnowledgeKey(learningContext.original_query),
            knowledge_value: extractedKnowledge,
            source: 'GUIDED_LEARNING'
        }, userId);

        if (result.status === 'SUCCESS') {
            return {
                status: 'LEARNED',
                message: 'Entendi! Vou lembrar disso para a próxima vez.',
                knowledge: extractedKnowledge,
                shouldRetry: true
            };
        }

        return result;
    }

    /**
     * Extrair conhecimento estruturado da resposta do usuário
     */
    async extractKnowledgeFromGuidance(userResponse, context) {
        const response = userResponse.toLowerCase();

        // Detectar tipo de localização
        if (response.includes('tabela') || response.includes('coluna') || response.includes('linha')) {
            return this.extractTableKnowledge(userResponse, context);
        }

        if (response.includes('card') || response.includes('topo') || response.includes('resumo')) {
            return this.extractCardKnowledge(userResponse, context);
        }

        if (response.includes('botão') || response.includes('clicar')) {
            return this.extractActionKnowledge(userResponse, context);
        }

        if (response.includes('filtro') || response.includes('filtrar')) {
            return this.extractFilterKnowledge(userResponse, context);
        }

        // Conhecimento genérico
        return {
            type: 'generic',
            description: userResponse,
            screen_id: context.screen_id
        };
    }

    /**
     * Extrair conhecimento sobre localização em tabela
     */
    extractTableKnowledge(response, context) {
        // Padrões comuns:
        // "coluna X, linha Y"
        // "procure na coluna data = hoje + 10, linha saldo final"

        const knowledge = {
            type: 'table',
            screen_id: context.screen_id,
            extraction_method: 'table_cell'
        };

        // Extrair coluna
        const columnMatch = response.match(/coluna\s+([^,\n]+)/i);
        if (columnMatch) {
            knowledge.column_selector = columnMatch[1].trim();
        }

        // Extrair linha
        const rowMatch = response.match(/linha\s+([^,\n]+)/i);
        if (rowMatch) {
            knowledge.row_selector = rowMatch[1].trim();
        }

        // Extrair fórmula de data (ex: "hoje + 10")
        const dateFormulaMatch = response.match(/(hoje|today)\s*\+\s*(\d+)/i);
        if (dateFormulaMatch) {
            knowledge.date_formula = {
                base: 'today',
                offset: parseInt(dateFormulaMatch[2])
            };
        }

        return knowledge;
    }

    /**
     * Extrair conhecimento sobre card/resumo
     */
    extractCardKnowledge(response, context) {
        return {
            type: 'card',
            screen_id: context.screen_id,
            location: response.includes('topo') ? 'top' : 'unknown',
            extraction_method: 'card_value'
        };
    }

    /**
     * Extrair conhecimento sobre ação/botão
     */
    extractActionKnowledge(response, context) {
        const buttonMatch = response.match(/botão\s+([^,\n]+)/i);

        return {
            type: 'action',
            screen_id: context.screen_id,
            button_text: buttonMatch ? buttonMatch[1].trim() : null,
            action_type: 'click'
        };
    }

    /**
     * Extrair conhecimento sobre filtro
     */
    extractFilterKnowledge(response, context) {
        return {
            type: 'filter',
            screen_id: context.screen_id,
            requires_filter: true,
            filter_description: response
        };
    }

    /**
     * Gerar chave de conhecimento a partir da query
     */
    generateKnowledgeKey(query) {
        // Normalizar query para criar chave consistente
        return query
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 100);
    }

    /**
     * Perguntas contextuais por tipo de falha
     */
    getContextualQuestion(failureType, context) {
        const questions = {
            navigation_failed: `Tentei encontrar a tela de "${context.target}", mas não consegui. Você sabe em qual menu ela está?`,

            action_failed: `Estou na tela ${context.screen}, mas não encontrei o botão para "${context.action}". Onde fica esse botão?`,

            data_not_found: `Estamos na tela ${context.screen}, mas não encontrei o dado "${context.data}". Você pode me mostrar onde ele está? (Ex: 'na tabela, coluna Z', 'no card do topo', etc)`,

            rule_unknown: `Não sei se posso fazer "${context.action}" nesta situação. Existe alguma regra ou restrição que eu deva saber?`
        };

        return questions[failureType] || 'Não consegui completar a tarefa. Pode me ajudar?';
    }
}

module.exports = new IvaConversationalLearner();
