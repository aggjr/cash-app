/**
 * EVA FOCCUS Methodology Knowledge Base
 * Defines the strategic principles and business rules for analysis.
 */

module.exports = {
    principles: [
        {
            topic: "Cash Flow Health",
            rule: "A empresa é saudável se o Fluxo de Caixa Projetado for positivo nos próximos 60 dias.",
            severity: "CRITICAL",
            action_if_violated: "Alertar IMEDIATAMENTE sobre a data e o valor do saldo negativo. Sugerir revisão de Contas a Pagar.",
            persona_adaptation: {
                "consultant": "Focar no risco de insolvência e necessidade de aporte ou renegociação.",
                "analyst": "Listar as datas exatas e o montante negativo."
            }
        },
        {
            topic: "Profitability vs Liquidity",
            rule: "Lucro (DRE) não é Caixa. Uma empresa pode dar lucro e quebrar por falta de caixa.",
            severity: "HIGH",
            usage: "Se o usuário confundir 'Lucro' com 'Dinheiro na Conta', explicar a diferença didaticamente."
        },
        {
            topic: "Cost Management",
            rule: "Despesas fixas não devem ultrapassar 40% da Receita Recorrente (Regra Prática).",
            severity: "MEDIUM",
            usage: "Ao analisar DRE, verificar a proporção de despesas fixas."
        }
    ]
};
