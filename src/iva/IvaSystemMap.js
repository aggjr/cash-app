/**
 * Iva System Map
 * Defines the geography of the application for the AI Agent.
 * 
 * Screens describe:
 * - content: What semantic data is available here
 * - route: How to get there
 * - usage: When to go there (Goal mapping)
 */

export const IvaSystemMap = {
    screens: [
        {
            id: 'cash_flow_daily',
            name: 'Fluxo de Caixa Diário',
            route: '/fluxo-caixa',
            description: 'Exibe a previsão de saldo financeiro dia a dia. Use para analisar liquidez futura, riscos de saldo negativo e saúde financeira de curto/médio prazo.',
            semantic_data: ['daily_balance', 'projected_balance', 'critical_dates', 'accounts_payable'],
            keywords: ['saldo futuro', 'previsão', 'vai faltar dinheiro', 'liquidez', 'caixa', 'saúde']
        },
        {
            id: 'dre',
            name: 'DRE (Demonstrativo de Resultados)',
            route: '/dre',
            description: 'Relatório contábil/gerencial que mostra se a empresa deu Lucro ou Prejuízo. Detalha receitas, custos e despesas.',
            semantic_data: ['net_profit', 'gross_margin', 'ebitda', 'total_revenue', 'total_expenses'],
            keywords: ['lucro', 'prejuízo', 'rentabilidade', 'margem', 'resultado', 'operacional']
        },
        {
            id: 'incomes',
            name: 'Entradas (Receitas)',
            route: '/entradas',
            description: 'Lista detalhada de todos os recebimentos (vendas, contratos, aportes).',
            semantic_data: ['transaction_list', 'values', 'customers', 'dates'],
            keywords: ['recebi', 'cliente pagou', 'vendas', 'faturamento detalhado']
        },
        {
            id: 'expenses',
            name: 'Saídas (Despesas)',
            route: '/saidas',
            description: 'Lista detalhada de todos os pagamentos e custos.',
            semantic_data: ['transaction_list', 'values', 'suppliers', 'categories'],
        },
        {
            id: 'dividas-emprestimos',
            name: 'Dívidas / Empréstimos',
            route: '/dividas-emprestimos',
            description: 'Gerencia contratos de empréstimos e financiamentos. Calcula parcelas, juros, amortização e IOF automaticamente.',
            semantic_data: ['loan_contracts', 'installments', 'interest_rates', 'payment_schedule'],
            keywords: ['empréstimo', 'financiamento', 'dívida', 'parcela', 'juros', 'contratar', 'banco']
        },
        {
            id: 'previsao',
            name: 'Previsão de Fluxo',
            route: '/previsao',
            description: 'Projeção de saldo futuro com base em entradas e saídas previstas.',
            semantic_data: ['projected_balance', 'cash_flow_forecast'],
            keywords: ['previsão', 'projeção', 'futuro', 'saldo previsto']
        },
        {
            id: 'consolidadas',
            name: 'Consolidadas (DRE/Fluxo)',
            route: '/consolidadas',
            description: 'Visão consolidada de transações reais e previstas, com análise de DRE e fluxo financeiro.',
            semantic_data: ['consolidated_transactions', 'dre_analysis', 'cash_flow_analysis'],
            keywords: ['consolidado', 'visão geral', 'resumo', 'análise completa']
        },
        {
            id: 'producao-revenda',
            name: 'Produção / Revenda',
            route: '/producao-revenda',
            description: 'Registro de produção própria ou revenda de produtos/serviços.',
            semantic_data: ['production_records', 'resale_transactions'],
            keywords: ['produção', 'revenda', 'fabricação', 'produto']
        }
    ]
};

