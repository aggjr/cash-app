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
        const explanations = {
            'entrada': 'Esta é a tela de **Entradas Financeiras**. Aqui você pode registrar todas as receitas da sua empresa, como vendas, recebimentos de clientes, etc. Use o botão "Novo" para adicionar uma entrada, preencha os campos obrigatórios como valor, data e tipo de entrada.',

            'saida': 'Esta é a tela de **Saídas Financeiras**. Aqui você registra todas as despesas e pagamentos da empresa. Funciona de forma similar às entradas: clique em "Novo", preencha valor, data, tipo de saída e descrição.',

            'previsao': 'Esta é a **Previsão de Fluxo de Caixa**. Aqui você visualiza todas as entradas e saídas previstas, organizadas por data. Você pode filtrar por período e empresa. As linhas em verde são entradas, em vermelho são saídas.',

            'fechamento': 'Esta é a tela de **Fechamento de Contas**. Aqui você realiza o fechamento mensal das contas bancárias, comparando saldos previstos com reais.',

            'extrato-conta': 'Este é o **Extrato de Conta**. Aqui você visualiza todas as movimentações de uma conta específica, podendo filtrar por período.',

            'consolidada-financeira': 'Esta é a **Consolidada Financeira**. Aqui você vê um resumo consolidado de todas as transações, separadas em reais e previstas.',

            'contas': 'Esta é a tela de **Contas Bancárias**. Aqui você cadastra e gerencia as contas bancárias da empresa.',

            'empresa': 'Esta é a tela de **Empresas**. Aqui você gerencia as empresas cadastradas no sistema.',

            'usuarios': 'Esta é a tela de **Usuários**. Aqui você gerencia os usuários que têm acesso ao sistema.',

            'tipo-entrada': 'Esta é a tela de **Tipos de Entrada**. Aqui você cadastra as categorias de receitas (ex: Vendas, Serviços, etc).',

            'tipo-saida': 'Esta é a tela de **Tipos de Saída**. Aqui você cadastra as categorias de despesas (ex: Aluguel, Salários, etc).',

            'aportes': 'Esta é a tela de **Aportes**. Aqui você registra os aportes de capital feitos pelos sócios.',

            'retiradas': 'Esta é a tela de **Retiradas**. Aqui você registra as retiradas de capital pelos sócios.',

            'transferencias': 'Esta é a tela de **Transferências**. Aqui você registra transferências entre contas bancárias.',

            'dividas-emprestimos': 'Esta é a tela de **Dívidas e Empréstimos**. Aqui você gerencia empréstimos e financiamentos da empresa.'
        };

        return explanations[screenId] || 'Esta tela permite gerenciar informações do sistema. Explore os botões e filtros disponíveis para entender melhor suas funcionalidades.';
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
        const names = {
            'entrada': 'Entradas',
            'saida': 'Saídas',
            'previsao': 'Previsão de Fluxo',
            'fechamento': 'Fechamento de Contas',
            'extrato-conta': 'Extrato de Conta',
            'consolidada-financeira': 'Consolidada Financeira',
            'contas': 'Contas Bancárias',
            'empresa': 'Empresas',
            'usuarios': 'Usuários',
            'tipo-entrada': 'Tipos de Entrada',
            'tipo-saida': 'Tipos de Saída',
            'aportes': 'Aportes',
            'retiradas': 'Retiradas',
            'transferencias': 'Transferências',
            'dividas-emprestimos': 'Dívidas e Empréstimos',
            'producao-revenda': 'Compras (Produção/Revenda)',
            'tipo-producao-revenda': 'Tipos de Compras'
        };

        return names[screenId] || screenId;
    }
};

export default IvaConversation;
