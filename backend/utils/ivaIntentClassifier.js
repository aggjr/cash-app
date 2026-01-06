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
        if (/^(oi|olá|ola|hey|e aí|eai|bom dia|boa tarde|boa noite)(\s|$|,|!)/i.test(msg)) {
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

        // 3. GRATITUDE & CASUAL (Low Priority)
        if (/(obrigad|valeu|legal|show|massa|top|bacana|ótimo|otimo|perfeito|maravilha)/i.test(msg)) {
            return {
                type: 'GRATITUDE',
                priority: 'LOW',
                context: 'User is expressing gratitude or approval'
            };
        }

        // 4. IDENTITY CLARIFICATION ("é a Júlia", "sou o Pedro")
        if (/(é a|é o|sou a|sou o|me chamo|meu nome é)/i.test(msg)) {
            return {
                type: 'IDENTITY',
                priority: 'HIGH',
                context: 'User is clarifying their identity',
                needsContext: true
            };
        }

        // 5. DATA QUERIES (Medium Priority)
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
            'GRATITUDE': 0.9,     // More creative for casual
            'IDENTITY': 0.7,      // Moderate for identity
            'CORRECTION': 0.5,    // More focused for corrections
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
            'GRATITUDE': 50,      // Very short
            'IDENTITY': 100,      // Short
            'CORRECTION': 100,    // Short
            'DATA_QUERY': 300,    // Medium
            'COMMAND': 200,       // Medium
            'QUESTION': 400,      // Longer
            'GENERAL': 300        // Medium
        };

        return tokenMap[intent.type] || 300;
    }
};

module.exports = IntentClassifier;
