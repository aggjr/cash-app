/**
 * IVA Conversational Helpers
 * Functions for personalized greetings, confirmations, and follow-up
 */

export const IvaConversation = {

    /**
     * Get time-based greeting
     */
    getGreeting() {
        const hour = new Date().getHours();

        if (hour < 12) return 'Bom dia';
        if (hour < 18) return 'Boa tarde';
        return 'Boa noite';
    },

    /**
     * Get last access message
     */
    getLastAccessMessage(lastAccess) {
        if (!lastAccess) return 'É a primeira vez que conversamos!';

        const last = new Date(lastAccess);
        const now = new Date();
        const diffMs = now - last;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Você acabou de me acessar';
        if (diffMins < 60) return `Você me acessou há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
        if (diffHours < 24) return `Seu último acesso foi há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        if (diffDays === 1) return 'Seu último acesso foi ontem';
        return `Seu último acesso foi há ${diffDays} dias`;
    },

    /**
     * Generate initial greeting message
     */
    getInitialGreeting(userName, lastAccess) {
        const greeting = this.getGreeting();
        const lastAccessMsg = this.getLastAccessMessage(lastAccess);

        return `${greeting}, ${userName}! ${lastAccessMsg}. Como posso ajudar você hoje com suas finanças ou gestão do negócio?`;
    },

    /**
     * Get confirmation message after navigation
     */
    getNavigationConfirmation(screenName) {
        return `Naveguei para a tela de ${screenName}. Esta é a tela que você procurava?`;
    },

    /**
     * Get follow-up question about understanding
     */
    getUnderstandingQuestion() {
        return 'Ótimo! Você sabe como manipular esta tela e os conceitos apresentados nela?';
    },

    /**
     * Get screen explanation
     */
    getScreenExplanation(screenId) {
        // CLEANED FOR LAYER-BY-LAYER LEARNING
        return 'Esta tela permite gerenciar informações do sistema.';
    },

    /**
     * Check if user response is positive
     */
    isPositiveResponse(message) {
        const positive = /\b(sim|s|correto|certo|exato|isso|perfeito|ok|beleza|show|ótimo|otimo|yes|yeah)\b/i;
        return positive.test(message);
    },

    /**
     * Check if user response is negative
     */
    isNegativeResponse(message) {
        const negative = /\b(não|nao|n|errado|outra|diferente|no)\b/i;
        return negative.test(message);
    },

    /**
     * Check if user needs help
     */
    needsHelp(message) {
        const helpKeywords = /\b(não|nao|n|preciso|ajuda|explica|como|ensina|mostre|me ajude)\b/i;
        return helpKeywords.test(message);
    },

    /**
     * Get final help offer message
     */
    getFinalHelpOffer() {
        return 'Precisa de mais alguma ajuda?';
    },

    /**
     * Get closing message
     */
    getClosingMessage() {
        return 'Disponha! Estou aqui sempre que precisar. 😊';
    },

    /**
     * Get screen name from ID
     */
    getScreenName(screenId) {
        // CLEANED FOR LAYER-BY-LAYER LEARNING
        return screenId;
    }
};

export default IvaConversation;
