/**
 * EVA System Map
 * Defines the geography of the application for the AI Agent.
 * 
 * Screens describe:
 * - content: What semantic data is available here
 * - route: How to get there
 * - usage: When to go there (Goal mapping)
 */

export const EvaSystemMap = {
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
            keywords: ['paguei', 'gastei', 'fornecedor', 'custo detalhado']
        }
    ]
};
