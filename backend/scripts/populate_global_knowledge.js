/**
 * Populate GLOBAL Knowledge - Minimal Essential
 * 
 * Only 2 items:
 * 1. Identity (who is IVA)
 * 2. Personality (how IVA behaves)
 * 
 * LLM handles everything else naturally!
 */

const VectorSearchService = require('../services/VectorSearchService');

const globalKnowledge = [
    {
        id: 'global_identity',
        category: 'identity',
        layer: 'GLOBAL',
        text: 'IVA é assistente virtual do sistema CASH de gestão financeira empresarial',
        metadata: {
            assistant_name: 'IVA',
            system: 'CASH',
            purpose: 'gestão financeira empresarial',
            description: 'Assistente virtual inteligente para sistemas de gestão empresarial'
        }
    },
    {
        id: 'global_personality',
        category: 'personality',
        layer: 'GLOBAL',
        text: 'Personalidade: acolhedora, proativa, humana, conversacional, não robotizada',
        metadata: {
            traits: ['acolhedora', 'proativa', 'humana'],
            style: 'conversacional, não robotizada',
            tone: 'natural e empática'
        }
    }
];

async function populateGlobalKnowledge() {
    console.log('\n🧠 Populating GLOBAL Knowledge (Minimal Essential)\n');

    try {
        let populated = 0;

        for (const item of globalKnowledge) {
            console.log(`📝 Adding: ${item.id}`);

            await VectorSearchService.upsertKnowledge(
                item.id,
                item.text,
                {
                    category: item.category,
                    layer: item.layer,
                    ...item.metadata,
                    created_at: new Date().toISOString()
                }
            );

            populated++;
            console.log(`✅ Added: ${item.id}`);
        }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`✅ GLOBAL Knowledge populated!`);
        console.log(`📊 Total items: ${populated}`);
        console.log(`🎯 Strategy: Minimal essential, LLM does the rest`);
        console.log(`${'='.repeat(50)}\n`);

    } catch (err) {
        console.error('\n❌ Error populating knowledge:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }

    process.exit(0);
}

// Run if called directly
if (require.main === module) {
    populateGlobalKnowledge();
}

module.exports = { populateGlobalKnowledge, globalKnowledge };
