/**
 * EVA Guided Tour Scripts
 * Narration and configuration for overview and full tours
 */

// Quick Overview Tour (2-3 minutes, 5 screens)
export const TOUR_OVERVIEW = [
    {
        id: 'overview-welcome',
        screenId: 'dashboard',
        title: 'Bem-vindo ao CASH!',
        narration: 'Olá! Vou mostrar rapidamente as principais áreas do sistema CASH. Prometo ser breve!',
        duration: 4000
    },
    {
        id: 'overview-cadastros',
        screenId: 'usuarios',
        title: 'Cadastros',
        narration: 'Na seção de Cadastros você gerencia usuários, empresas e contas bancárias do sistema.',
        highlights: [
            { selector: '.tree-node[data-item-id="usuarios"]', addArrow: true }
        ],
        duration: 5000
    },
    {
        id: 'overview-transacoes',
        screenId: 'entrada',
        title: 'Transações Financeiras',
        narration: 'Aqui você registra suas entradas e saídas, controla transferências e gerencia produções. É o coração do sistema!',
        highlights: [
            { selector: 'button:contains("Nova Entrada"), .btn-new-entry', addArrow: false }
        ],
        duration: 6000
    },
    {
        id: 'overview-analise',
        screenId: 'consolidadas',
        title: 'Análise Financeira',
        narration: 'A análise financeira permite visualizar relatórios consolidados, previsões e gráficos para tomada de decisão.',
        duration: 6000
    },
    {
        id: 'overview-config',
        screenId: 'parametros-gerais',
        title: 'Configurações',
        narration: 'Por fim, nas configurações você personaliza prazos, permissões e até minhas preferências de voz! Tour rápido concluído.',
        duration: 6000
    }
];

// Complete Guided Tour (10-15 minutes, all screens)
export const TOUR_FULL = [
    {
        id: 'full-intro',
        screenId: 'dashboard',
        title: 'Início do Tour Completo',
        narration: 'Bem-vindo ao tour completo do sistema CASH! Vou mostrar detalhadamente todas as funcionalidades. Você pode pausar ou pular a qualquer momento.',
        duration: 6000
    },
    {
        id: 'full-dashboard',
        screenId: 'dashboard',
        title: 'Dashboard - Central de Controle',
        narration: 'Este é o Dashboard, sua central de controle. Aqui você tem acesso rápido às principais funções e uma visão geral do sistema.',
        highlights: [],
        duration: 7000
    },

    // CADASTROS
    {
        id: 'full-usuarios',
        screenId: 'usuarios',
        title: 'Usuários do Sistema',
        narration: 'Vamos começar pelos Cadastros. Aqui você gerencia os usuários que têm acesso ao sistema, define permissões e controla quem pode fazer o quê.',
        highlights: [],
        duration: 8000
    },
    {
        id: 'full-sharedtable-intro',
        screenId: 'usuarios',
        title: '📊 DESTAQUE: SharedTable',
        narration: 'Antes de continuar, quero destacar um grande diferencial do CASH: a SharedTable! Vou demonstrar os filtros avançados. Observe os filtros por data, valor e texto que funcionam como no Excel.',
        highlights: [
            { selector: 'table, .shared-table, .table-container', addArrow: true }
        ],
        actions: [
            // 1. Open date filter (assuming first column with date)
            {
                type: 'click',
                selector: 'thead th:nth-child(1) .filter-icon, thead th:first-child [class*="filter"], thead th:first-child button',
                delay: 2000,
                waitAfter: 3000
            },
            // 2. Close date filter
            {
                type: 'close',
                selector: '.modal .close, .filter-modal .close, button:contains("Fechar")',
                delay: 500,
                waitAfter: 1000
            },
            // 3. Open number/value filter (try status or another column)
            {
                type: 'click',
                selector: 'thead th:nth-child(3) .filter-icon, thead th:nth-child(3) [class*="filter"], thead th:nth-child(3) button',
                delay: 1000,
                waitAfter: 3000
            },
            // 4. Close number filter
            {
                type: 'close',
                selector: '.modal .close, .filter-modal .close, button:contains("Fechar")',
                delay: 500,
                waitAfter: 1000
            },
            // 5. Open text filter (name column)
            {
                type: 'click',
                selector: 'thead th:nth-child(2) .filter-icon, thead th:nth-child(2) [class*="filter"], thead th:nth-child(2) button',
                delay: 1000,
                waitAfter: 3000
            },
            // 6. Close text filter
            {
                type: 'close',
                selector: '.modal .close, .filter-modal .close, button:contains("Fechar")',
                delay: 500,
                waitAfter: 500
            }
        ],
        duration: 8000, // After all actions complete
        isSharedTableIntro: true
    },
    {
        id: 'full-empresas',
        screenId: 'empresa',
        title: 'Dados da Empresa',
        narration: 'No cadastro de Empresas, você registra CNPJ, razão social, endereço e outros dados fiscais que serão usados em documentos e relatórios.',
        duration: 8000
    },
    {
        id: 'full-contas',
        screenId: 'contas',
        title: 'Contas Bancárias',
        narration: 'Aqui você cadastra todas as contas bancárias da empresa. Pode gerenciar múltiplas contas, acompanhar saldos e fazer transferências entre elas.',
        duration: 8000
    },

    // TRANSAÇÕES
    {
        id: 'full-entrada',
        screenId: 'entrada',
        title: 'Entradas Financeiras',
        narration: 'Agora as Transações Financeiras. Nas Entradas você registra todas as receitas: vendas, recebimentos, prestação de serviços. Pode parcelar, categorizar e anexar comprovantes.',
        highlights: [
            { selector: '.btn-new, button:contains("Nova")', addArrow: true }
        ],
        duration: 11000
    },
    {
        id: 'full-saida',
        screenId: 'saida',
        title: 'Saídas Financeiras',
        narration: 'Nas Saídas você controla todas as despesas: fornecedores, funcionários, impostos. Organize por categorias e acompanhe o que está pendente de pagamento.',
        duration: 10000
    },
    {
        id: 'full-transferencias',
        screenId: 'transferencias',
        title: 'Transferências entre Contas',
        narration: 'As Transferências permitem movimentar dinheiro entre suas contas bancárias. O sistema mantém tudo sincronizado automaticamente.',
        duration: 8000
    },
    {
        id: 'full-producao',
        screenId: 'producao-revenda',
        title: 'Produção e Revenda',
        narration: 'Se você produz ou revende produtos, controle seu estoque aqui. Gerencie entradas, saídas e custos de produção.',
        duration: 8000
    },
    {
        id: 'full-contratos',
        screenId: 'contratos',
        title: 'Gestão de Contratos',
        narration: 'Para contratos e empréstimos, use esta tela. Registre termos, parcelas e taxas. O sistema calcula automaticamente juros e amortizações.',
        duration: 9000
    },

    // ANÁLISE
    {
        id: 'full-consolidadas',
        screenId: 'consolidadas',
        title: 'Visão Consolidada',
        narration: 'Agora a Análise Financeira. Aqui você vê todas as transações consolidadas: realizadas e previstas. Perfeito para planejamento de curto e médio prazo.',
        highlights: [
            { selector: '.table-container:first-child', addArrow: false }
        ],
        duration: 11000
    },
    {
        id: 'full-previsao',
        screenId: 'previsao',
        title: 'Previsão de Fluxo de Caixa',
        narration: 'A Previsão mostra seu fluxo de caixa dia a dia. Você saberá exatamente quando terá dinheiro entrando ou saindo, evitando surpresas.',
        duration: 10000
    },
    {
        id: 'full-analise',
        screenId: 'analise-financeira',
        title: 'Análise Detalhada',
        narration: 'Para análises mais profundas, use esta tela. Relatórios e gráficos ajudam a identificar tendências, problemas e oportunidades no seu negócio.',
        duration: 9000
    },
    {
        id: 'full-extrato',
        screenId: 'extrato',
        title: 'Extrato de Conta',
        narration: 'O Extrato mostra todo o histórico de movimentações de uma conta específica, facilitando conciliações bancárias.',
        duration: 8000
    },

    // CONFIGURAÇÕES
    {
        id: 'full-parametros',
        screenId: 'parametros-gerais',
        title: 'Parâmetros do Sistema',
        narration: 'Por fim, os Parâmetros Gerais. Aqui você configura prazos, permissões de edição e, é claro, minhas configurações de voz! Pode escolher entre voz feminina ou masculina, e ajustar a qualidade do áudio.',
        highlights: [
            { selector: '.voice-settings, [class*="voice"]', addArrow: false }
        ],
        duration: 12000
    },
    {
        id: 'full-conclusion',
        screenId: 'dashboard',
        title: 'Tour Concluído!',
        narration: 'Parabéns! Você conheceu todas as funcionalidades do CASH. Agora está pronto para usar o sistema com confiança. Lembre-se: estarei sempre aqui para ajudar com qualquer dúvida!',
        duration: 8000
    }
];
