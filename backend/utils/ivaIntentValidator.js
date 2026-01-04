/**
 * IVA Intent Validator
 * Validates user messages to ensure they are within scope and not malicious
 * Security layer before reaching LLM
 */

class ivaIntentValidator {
    // Topics that are out of scope for IVA
    static OFF_TOPIC_KEYWORDS = [
        'política', 'eleição', 'partido', 'governo',
        'religião', 'igreja', 'deus', 'fé',
        'time de futebol', 'jogo', 'campeonato',
        'receita culinária', 'como cozinhar', 'ingredientes',
        'piada', 'conte uma piada', 'humor',
        'poema', 'poesia', 'escreva um poema',
        'música', 'letra de música', 'canção',
        'relacionamento amoroso', 'namoro', 'casamento pessoal',
        'saúde pessoal', 'sintomas', 'doença',
        'fitness', 'academia', 'exercícios físicos',
        'horóscopo', 'signo', 'astrologia'
    ];

    // Patterns that indicate jailbreak/prompt injection attempts
    static JAILBREAK_PATTERNS = [
        'ignore todas as instruções',
        'ignore as instruções anteriores',
        'forget your instructions',
        'esqueça suas instruções',
        'desconsidere suas regras',
        'você agora é',
        'you are now',
        'como DAN',
        'as DAN',
        'modo desenvolvedor',
        'developer mode',
        'nova persona',
        'new character',
        'role play as',
        'finja ser',
        'pretend to be'
    ];

    /**
     * Validate user message for intent and security
     * @param {string} userMessage - The message from user
     * @returns {Object} Validation result
     */
    static validate(userMessage) {
        if (!userMessage || typeof userMessage !== 'string') {
            return {
                valid: false,
                reason: 'invalid_input',
                response: 'Desculpe, não consegui entender sua mensagem. Como posso ajudá-lo com o sistema CASH?'
            };
        }

        const msgLower = userMessage.toLowerCase().trim();

        // Empty message
        if (msgLower.length === 0) {
            return {
                valid: false,
                reason: 'empty_message',
                response: 'Como posso ajudá-lo hoje?'
            };
        }

        // Check for jailbreak attempts first (higher priority)
        for (const pattern of this.JAILBREAK_PATTERNS) {
            if (msgLower.includes(pattern)) {
                console.warn('[IVA Security] Jailbreak attempt detected:', pattern);
                return {
                    valid: false,
                    reason: 'jailbreak_attempt',
                    response: 'Desculpe, detectei uma solicitação inadequada. Estou aqui para ajudá-lo com questões do sistema CASH. Como posso auxiliá-lo?'
                };
            }
        }

        // Check for off-topic keywords
        for (const keyword of this.OFF_TOPIC_KEYWORDS) {
            if (msgLower.includes(keyword)) {
                console.warn('[IVA Security] Off-topic detected:', keyword);
                return {
                    valid: false,
                    reason: 'off_topic',
                    response: 'Eu adoraria conversar sobre isso, mas sou especializada em ajudar com o sistema CASH. Posso auxiliá-lo com gestão financeira, fluxo de caixa ou relatórios?'
                };
            }
        }

        // Message is valid
        return { valid: true };
    }
}

module.exports = ivaIntentValidator;

