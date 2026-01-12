const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');
const IvaVectorService = require('../services/IvaVectorService');
require('dotenv').config({ path: '../.env' });

const rules = [
    {
        description: "REGRA DE TRANSPARÊNCIA: Ao confirmar ou responder sobre um dado do sistema (ex: nome do usuário, valor de conta, status), você DEVE navegar para a tela onde esse dado está (action: NAVIGATE) e destacar a informação (highlight: 'texto').",
        keywords: { primary: ['transparencia', 'navegar', 'highlight', 'destacar', 'mostrar'] }
    },
    {
        description: "REGRA DE HIGHLIGHT: Quando encontrar uma informação na tela, use o campo 'highlight' no JSON de resposta com o texto exato do dado (ex: 'Augusto', 'R$ 500,00', 'Pago'). Isso fará o sistema piscar o dado na tela.",
        keywords: { primary: ['highlight', 'destaque', 'piscar', 'foco'] }
    },
    {
        description: "REGRA DE USUÁRIO: Dados cadastrais como 'meu nome', 'meu email' ou 'meu cargo' estão na tela de Usuários (ID: usuarios). Navegue para lá se o usuário perguntar 'quem sou eu' ou 'meus dados'.",
        keywords: { primary: ['usuario', 'meu nome', 'quem sou eu', 'cadastro'] }
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
