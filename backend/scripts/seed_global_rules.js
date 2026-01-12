const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');
const IvaVectorService = require('../services/IvaVectorService');
require('dotenv').config({ path: '../.env' });

const rules = [
    {
        description: "REGRA DE TRANSPARÊNCIA (SISTEMA): Para dados que existem nas telas do sistema (ex: cadastros, valores, status), você DEVE navegar para a tela (action: NAVIGATE) e destacar a informação (highlight: 'texto'). 'Mostre' o dado.",
        keywords: { primary: ['transparencia', 'navegar', 'highlight', 'sistema', 'fatos'] }
    },
    {
        description: "REGRA DE CONHECIMENTO (MEMÓRIA): Para dados que vivem apenas na sua memória (ex: preferências do usuário, cores favoritas, regras de negócio aprendidas e não visíveis), APENAS RESPONDA (action: REPLY). NÃO tente navegar ou destacar o que não existe na tela.",
        keywords: { primary: ['memoria', 'conhecimento', 'preferencia', 'regra', 'abstrato'] }
    },
    {
        description: "REGRA DE USUÁRIO: Se o usuário perguntar 'quem sou eu' ou 'meus dados', NAVEGUE para a tela 'usuarios' e destaque o nome dele.",
        keywords: { primary: ['usuario', 'meu nome', 'quem sou eu'] }
    }
];

const seedRules = async () => {
    console.log('🌱 Seeding Global Transparency Rules...');

    // Fake context for SYSTEM scope
    const context = {
        userId: 'system-seed',
        userName: 'System Admin',
        projectId: null,
        scope: 'SYSTEM', // Global rules
        department: 'All',
        role: 'System'
    };

    try {
        for (const rule of rules) {
            console.log(`Processing: ${rule.description.substring(0, 50)}...`);
            await IvaGlobalKnowledge.contribute('custom_rules', rule, context);
            console.log('✅ Rule added.');
            // Small delay to prevent rate limits
            await new Promise(r => setTimeout(r, 500));
        }
        console.log('🎉 Seeding Complete!');
    } catch (error) {
        console.error('❌ Error seeding rules:', error);
    }
};

seedRules();
