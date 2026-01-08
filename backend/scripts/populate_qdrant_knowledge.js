// Script para popular Qdrant com TODO conhecimento da IVA
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

// Importar serviços (usando require nativo)
const VectorSearchService = require('../services/VectorSearchService');

async function populateQdrant() {
    console.log('🚀 Populando Qdrant com conhecimento completo da IVA...\n');

    try {
        // 1. Carregar base de conhecimento
        const knowledgeBasePath = path.join(__dirname, '../data/iva_knowledge_base.json');
        const knowledgeData = JSON.parse(await fs.readFile(knowledgeBasePath, 'utf8'));

        console.log('✅ Base de conhecimento carregada');
        console.log(`📊 Categorias: ${Object.keys(knowledgeData).length}\n`);

        let totalUpserted = 0;

        // 2. Popular informações do sistema
        console.log('📝 Populando informações do sistema...');
        const systemInfo = knowledgeData.system_info;
        await VectorSearchService.upsertKnowledge(
            'system_info_main',
            `Sistema: ${systemInfo.name}. ${systemInfo.description}. Capacidades: ${systemInfo.capabilities.join(', ')}`,
            {
                category: 'system_info',
                source: 'knowledge_base',
                ...systemInfo
            }
        );
        totalUpserted++;
        console.log('  ✅ Informações do sistema');

        // 3. Popular saudações
        console.log('\n👋 Populando saudações...');
        for (const greeting of knowledgeData.greetings) {
            for (let i = 0; i < greeting.variations.length; i++) {
                await VectorSearchService.upsertKnowledge(
                    `greeting_${greeting.context}_${i}`,
                    `Saudação para ${greeting.context} (${greeting.time_range}): ${greeting.variations[i]}`,
                    {
                        category: 'greeting',
                        context: greeting.context,
                        time_range: greeting.time_range,
                        text: greeting.variations[i],
                        source: 'knowledge_base'
                    }
                );
                totalUpserted++;
            }
        }
        console.log(`  ✅ ${totalUpserted - 1} saudações`);

        // 4. Popular personalidade
        console.log('\n🎭 Populando personalidade...');
        const personality = knowledgeData.personality;
        await VectorSearchService.upsertKnowledge(
            'personality_main',
            `Personalidade da IVA: Tom ${personality.tone}, estilo ${personality.style}. Traços: ${personality.traits.join(', ')}`,
            {
                category: 'personality',
                source: 'knowledge_base',
                ...personality
            }
        );
        totalUpserted++;
        console.log('  ✅ Personalidade');

        // 5. Popular introdução
        console.log('\n👤 Populando textos de introdução...');
        const intro = knowledgeData.introduction;
        await VectorSearchService.upsertKnowledge(
            'introduction_first_contact',
            `Apresentação inicial: ${intro.first_contact}`,
            {
                category: 'introduction',
                type: 'first_contact',
                text: intro.first_contact,
                source: 'knowledge_base'
            }
        );
        await VectorSearchService.upsertKnowledge(
            'introduction_capabilities',
            `Capacidades: ${intro.capabilities_intro}`,
            {
                category: 'introduction',
                type: 'capabilities',
                text: intro.capabilities_intro,
                source: 'knowledge_base'
            }
        );
        totalUpserted += 2;
        console.log('  ✅ Textos de introdução');

        // 6. Popular conhecimento de navegação
        console.log('\n🗺️  Populando conhecimento de navegação...');
        for (const nav of knowledgeData.navigation_knowledge) {
            await VectorSearchService.upsertKnowledge(
                `nav_${nav.screen_id}`,
                `Tela ${nav.screen_id}: ${nav.description}. Palavras-chave: ${nav.keywords.join(', ')}. Propósito: ${nav.purpose}`,
                {
                    category: 'navigation',
                    screen_id: nav.screen_id,
                    keywords: nav.keywords,
                    description: nav.description,
                    purpose: nav.purpose,
                    source: 'knowledge_base'
                }
            );
            totalUpserted++;
        }
        console.log(`  ✅ ${knowledgeData.navigation_knowledge.length} telas`);

        // 7. Popular ações comuns
        console.log('\n⚡ Populando ações comuns...');
        for (const action of knowledgeData.common_actions) {
            await VectorSearchService.upsertKnowledge(
                `action_${action.action_type}`,
                `Ação ${action.action_type}: ${action.description}. Palavras-chave: ${action.keywords.join(', ')}`,
                {
                    category: 'action',
                    action_type: action.action_type,
                    keywords: action.keywords,
                    description: action.description,
                    source: 'knowledge_base'
                }
            );
            totalUpserted++;
        }
        console.log(`  ✅ ${knowledgeData.common_actions.length} ações`);

        // 8. Popular respostas de ajuda
        console.log('\n❓ Populando respostas de ajuda...');
        for (let i = 0; i < knowledgeData.help_responses.length; i++) {
            const help = knowledgeData.help_responses[i];
            await VectorSearchService.upsertKnowledge(
                `help_${i}`,
                `Ajuda para: ${help.trigger.join(', ')}. Resposta: ${help.response}`,
                {
                    category: 'help',
                    triggers: help.trigger,
                    response: help.response,
                    source: 'knowledge_base'
                }
            );
            totalUpserted++;
        }
        console.log(`  ✅ ${knowledgeData.help_responses.length} respostas de ajuda`);

        console.log('\n' + '='.repeat(50));
        console.log(`🎉 SUCESSO! ${totalUpserted} itens inseridos no Qdrant!`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ ERRO ao popular Qdrant:');
        console.error('  Mensagem:', error.message);
        console.error('  Stack:', error.stack);
        process.exit(1);
    }

    process.exit(0);
}

// Executar
populateQdrant();
