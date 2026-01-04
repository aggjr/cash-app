export const IvaKnowledge = {
    activeScreenData: null,
    screens: {
        'dashboard': {
            id: 'dashboard',
            name: 'Dashboard',
            description: 'Visão geral do sistema com atalhos principais.',
            keywords: ['inicio', 'home', 'começo', 'painel']
        },
        'entrada': {
            id: 'entrada',
            name: 'Entradas',
            description: 'Tela para registro de ganhos, receitas e recebimentos.',
            keywords: ['ganhos', 'receitas', 'recebimentos', 'vendas']
        },
        'saida': {
            id: 'saida',
            name: 'Saídas',
            description: 'Tela para registro de gastos, despesas e pagamentos.',
            keywords: ['gastos', 'despesas', 'pagamentos', 'custos']
        },
        'contas': {
            id: 'contas',
            name: 'Contas Bancárias',
            description: 'Gerenciamento de contas bancárias e saldos.',
            keywords: ['banco', 'saldo', 'conta corrente', 'poupança']
        },
        'producao-revenda': {
            id: 'producao-revenda',
            name: 'Produção e Revenda',
            description: 'Gestão de itens produzidos ou revendidos pela empresa.',
            keywords: ['estoque', 'produtos', 'revenda', 'produção']
        },
        'usuarios': {
            id: 'usuarios',
            name: 'Gerenciamento de Usuários',
            description: 'Cadastro e controle de usuários do sistema.',
            keywords: ['usuário', 'usuarios', 'login', 'acesso', 'perfil', 'pessoas']
        },
        'empresa': {
            id: 'empresa',
            name: 'Dados da Empresa',
            description: 'Cadastro das informações principais da empresa.',
            keywords: ['empresa', 'cnpj', 'endereço', 'dados cadastrais']
        },
        'parametros-gerais': {
            id: 'parametros-gerais',
            name: 'Parâmetros Gerais',
            description: 'Configurações globais do sistema.',
            keywords: ['configuração', 'configurações', 'parâmetros', 'setup', 'ajustes']
        },
        'transferencias': {
            id: 'transferencias',
            name: 'Transferências',
            description: 'Transferências entre contas bancárias.',
            keywords: ['transferência', 'movimentar', 'ted', 'doc']
        },
        'extrato-conta': {
            id: 'extrato-conta',
            name: 'Extrato',
            description: 'Extrato detalhado das contas.',
            keywords: ['extrato', 'movimentação', 'histórico']
        },
        'consolidadas': {
            id: 'consolidadas',
            name: 'Consolidadas',
            description: 'Visão consolidada das transações financeiras - reais e previstas.',
            keywords: ['consolidada', 'consolidadas', 'análise financeira', 'transações', 'consolidado']
        },
        'previsao': {
            id: 'previsao',
            name: 'Previsão Diária',
            description: 'Previsão diária do fluxo de caixa.',
            keywords: ['previsão', 'fluxo de caixa', 'forecast', 'projeção']
        },
        'analise-financeira': {
            id: 'analise-financeira',
            name: 'Análise Financeira',
            description: 'Relatórios e gráficos de análise financeira.',
            keywords: ['análise', 'relatório', 'gráfico', 'ROI', 'performance']
        }
    },

    // Helper: Normalize text (remove accents and lowercase)
    normalize: (str) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    },

    // Dynamic Active Screen Knowledge (The "Short-term Memory")
    activeScreen: null,

    registerScreen: (screenId, knowledge) => {
        console.log(`[Iva Knowledge] Learning about screen: ${screenId}`);
        IvaKnowledge.activeScreen = {
            id: screenId,
            ...knowledge
        };
    },

    clearActiveScreen: () => {
        IvaKnowledge.activeScreen = null;
    },

    getScreenByKeyword: (text) => {
        const normalize = IvaKnowledge.normalize;
        const lowerText = normalize(text);

        for (const key in IvaKnowledge.screens) {
            const screen = IvaKnowledge.screens[key];
            // Check against keywords
            if (screen.keywords.some(k => lowerText.includes(normalize(k)))) {
                return screen;
            }
            // Also check against the screen Action ID or Name just in case
            if (lowerText.includes(normalize(screen.id)) || lowerText.includes(normalize(screen.name))) {
                return screen;
            }
        }
        return null;
    }
};

