/**
 * IVA Intent Classifier
 * Classifies user intent BEFORE calling LLM to provide better context
 */

const IntentClassifier = {
    /**
     * Classify user message intent
     * @param {string} message - User message
     * @param {Array} conversationHistory - Recent conversation
     * @returns {Object} - { type, priority, context }
     */
    classify(message, conversationHistory = []) {
        const msg = message.toLowerCase().trim();
        const lastUserMessage = conversationHistory
            .filter(m => m.sender === 'user')
            .slice(-1)[0]?.text?.toLowerCase() || '';

        // 1. GREETINGS & FAREWELLS (High Priority)
        if (/^(oi|olá|ola|hey|e aí|eai|bom dia|boa tarde|boa noite|iva_auto_greeting)(\s|$|,|!)/i.test(msg)) {
            return {
                type: 'GREETING',
                priority: 'HIGH',
                context: 'User is greeting, respond warmly and briefly'
            };
        }

        if (/^(tchau|até|adeus|falou|flw|até logo|até mais|vou indo)(\s|$|,|!)/i.test(msg)) {
            return {
                type: 'FAREWELL',
                priority: 'HIGH',
                context: 'User is saying goodbye, respond briefly'
            };
        }

        // 1.5 DISMISSAL (Recusa de ajuda - Alta Prioridade)
        if (/(não preciso|não quero|não precisa|só isso|obrigado por enquanto|obrigado não|obrigada não|nada mais)(\s|$|,|!|.)/i.test(msg)) {
            return {
                type: 'DISMISSAL',
                priority: 'HIGH',
                context: 'User is dismissing further help or indicating satisfaction. SHOULD CLOSE CHAT.'
            };
        }

        // 1.6 TEST/PING (Common dev behavior)
        if (/^(teste|testando|test|123|pisca)(\s|$|,|!|\.)/i.test(msg)) {
            return {
                type: 'CONFIRMATION', // Use existing type to avoid breaking consumers
                priority: 'HIGH',
                context: 'User is testing connectivity. Respond: "Estou ouvindo! O sistema está operante. Em que posso ajudar?"',
                isTest: true
            };
        }

        // 1.6 SOCIAL INTERACTIONS (Prioridade MÁXIMA para humanizar)

        // Agradecimentos simples (NÃO são dismissal)
        if (/^(obrigad[oa]|valeu|obg|brigad[oa]|agradeço)(\\s|$|,|!)/i.test(msg) && !/por enquanto|não|nada mais/i.test(msg)) {
            return {
                type: 'SOCIAL_THANKS',
                priority: 'HIGHEST',
                context: 'User is thanking. Respond warmly: "Por nada! Fico feliz em ajudar. Precisa de mais alguma coisa?"'
            };
        }

        // Elogios e feedback positivo
        if (/(muito bom|excelente|perfeito|ótimo|legal|adorei|top|massa|show|bacana|maravilha|incrível)(\\s|$|,|!)/i.test(msg)) {
            return {
                type: 'SOCIAL_PRAISE',
                priority: 'HIGHEST',
                context: 'User is praising. Respond enthusiastically: "Que bom que gostou! 😊 Posso fazer mais alguma coisa?"'
            };
        }

        // Conversa casual
        if (/(como você está|tudo bem|como vai|e você|e tu)(\\?|$|,|!)/i.test(msg)) {
            return {
                type: 'SOCIAL_CASUAL',
                priority: 'HIGHEST',
                context: 'User is being casual. Respond warmly: "Estou ótima, obrigada! E você? Em que posso ajudar?"'
            };
        }

        // Frustração/confusão
        if (/(não entend[io]|tá confuso|confusa|não funciona|não tá funcionando|tá errado|bugou|travou)(\\s|$|,|!)/i.test(msg)) {
            return {
                type: 'SOCIAL_FRUSTRATION',
                priority: 'HIGHEST',
                context: 'User is frustrated/confused. Be EXTRA patient: "Opa, desculpa! Deixa eu te explicar melhor..."'
            };
        }


        // 2. CORRECTIONS (High Priority - needs previous context)
        if (/^(não|nao|errado|incorreto|não é|nao e|na verdade|fui eu|sou eu|é o|é a)/i.test(msg)) {
            const lastAssistantMsg = conversationHistory
                .filter(m => m.sender === 'assistant')
                .slice(-1)[0]?.text || '';

            return {
                type: 'CORRECTION',
                priority: 'HIGH',
                context: 'User is correcting previous statement',
                previousMessage: lastAssistantMsg,
                needsContext: true
            };
        }

        // 3. CONFIRMATIONS (High Priority - "sim", "ok", etc)
        if (/^(sim|s|ok|beleza|show|ótimo|otimo|perfeito|maravilha|isso|exato|correto|certo)(\s|$|,|!)/i.test(msg)) {
            return {
                type: 'CONFIRMATION',
                priority: 'HIGH',
                context: 'User is confirming or agreeing'
            };
        }

        // 4. GRATITUDE & CASUAL (Low Priority)
        if (/(obrigad|valeu|legal|bacana)/i.test(msg)) {
            return {
                type: 'GRATITUDE',
                priority: 'LOW',
                context: 'User is expressing gratitude or appreciation'
            };
        }

        // 4. IDENTITY CLARIFICATION ("é a Júlia", "sou o Pedro")
        if (/(é a|é o|sou a|sou o|me chamo|meu nome é|me chame|me trata|pode me chamar)/i.test(msg)) {
            return {
                type: 'IDENTITY',
                priority: 'HIGH',
                context: 'User is clarifying their identity',
                needsContext: true
            };
        }

        // 5. LEARNING (High Priority - Synonyms supported)
        // STRICTER REGEX: Must verify it's an instruction. Matches "aprenda " or "aprenda," or "aprenda!"
        const learningRegex = /^(aprenda|guarde|memorize|grave|registre|ensinar|conhecimento|entenda|lembre)[\s\.,!?:;]+/i;
        const learningMatch = learningRegex.test(msg);
        console.log(`[Intent Classifier] Testing LEARNING: "${msg}" -> Match: ${learningMatch}`);

        if (learningMatch) {
            console.log(`[Intent Classifier] ✅ LEARNING intent detected!`);
            return {
                type: 'LEARNING',
                priority: 'HIGH',
                context: 'User is teaching a new rule or knowledge'
            };
        }

        // 6. DATA QUERIES (Medium Priority)
        if (/(quanto|quantos|qual|quais|como está|mostre|liste|ver|mostrar|exibir)/i.test(msg)) {
            return {
                type: 'DATA_QUERY',
                priority: 'MEDIUM',
                context: 'User wants to see data or information'
            };
        }

        // 6. COMMANDS (High Priority)
        if (/(abrir|navegar|criar|editar|deletar|salvar|ir para|me leve|vá para|va para)/i.test(msg)) {
            return {
                type: 'COMMAND',
                priority: 'HIGH',
                context: 'User wants to perform an action'
            };
        }

        // 7. QUESTIONS (Medium Priority)
        if (/(como|por que|porque|quando|onde|o que|que|quem)/i.test(msg) || msg.includes('?')) {
            return {
                type: 'QUESTION',
                priority: 'MEDIUM',
                context: 'User is asking a question'
            };
        }

        // 8. DEFAULT
        return {
            type: 'GENERAL',
            priority: 'MEDIUM',
            context: 'General conversation'
        };
    },

    /**
     * Get appropriate temperature for intent
     */
    getTemperature(intent) {
        const temperatureMap = {
            'GREETING': 0.9,      // More creative for greetings
            'FAREWELL': 0.9,      // More creative for farewells
            'DISMISSAL': 0.9,     // Creative farewell
            'GRATITUDE': 0.9,     // More creative for casual
            'CONFIRMATION': 0.3,  // Focused for confirmations
            'IDENTITY': 0.7,      // Moderate for identity
            'CORRECTION': 0.5,    // More focused for corrections
            'LEARNING': 0.8,      // Creative but focused
            'DATA_QUERY': 0.3,    // Deterministic for data
            'COMMAND': 0.2,       // Very deterministic for commands
            'QUESTION': 0.6,      // Moderate for questions
            'GENERAL': 0.7        // Default moderate
        };

        return temperatureMap[intent.type] || 0.7;
    },

    /**
     * Get max tokens for intent
     */
    getMaxTokens(intent) {
        const tokenMap = {
            'GREETING': 50,       // Very short
            'FAREWELL': 50,       // Very short
            'DISMISSAL': 50,      // Very short
            'GRATITUDE': 50,      // Very short
            'CONFIRMATION': 50,   // Very short
            'IDENTITY': 100,      // Short
            'CORRECTION': 100,    // Short
            'LEARNING': 300,      // Response for learning confirmation
            'DATA_QUERY': 300,    // Medium
            'COMMAND': 200,       // Medium
            'QUESTION': 400,      // Longer
            'GENERAL': 300        // Medium
        };

        return tokenMap[intent.type] || 300;
    }
};

module.exports = IntentClassifier;
