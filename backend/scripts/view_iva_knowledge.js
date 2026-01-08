/**
 * Script para visualizar o conhecimento da IVA armazenado no Qdrant
 * 
 * Uso: node backend/scripts/view_iva_knowledge.js [filtro]
 * 
 * Exemplos:
 *   node backend/scripts/view_iva_knowledge.js              # Ver tudo
 *   node backend/scripts/view_iva_knowledge.js GLOBAL       # Só conhecimento global
 *   node backend/scripts/view_iva_knowledge.js custom_rules # Só regras personalizadas
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
require('dotenv').config();

const COLLECTION_NAME = 'iva_knowledge';

async function viewKnowledge() {
    try {
        console.log('🔍 Conectando ao Qdrant...\n');

        const client = new QdrantClient({
            url: process.env.QDRANT_URL || 'http://localhost:6333'
        });

        // Verificar se coleção existe
        const collections = await client.getCollections();
        const hasCollection = collections.collections.some(c => c.name === COLLECTION_NAME);

        if (!hasCollection) {
            console.log('❌ Coleção "iva_knowledge" não encontrada!');
            console.log('💡 Execute: node backend/scripts/populate_qdrant_knowledge.js');
            return;
        }

        // Buscar todos os pontos
        const filter = process.argv[2];
        let scrollResult;

        if (filter) {
            console.log(`📋 Filtrando por: ${filter}\n`);
            scrollResult = await client.scroll(COLLECTION_NAME, {
                filter: {
                    should: [
                        { key: 'layer', match: { value: filter } },
                        { key: 'category', match: { value: filter } }
                    ]
                },
                limit: 100,
                with_payload: true,
                with_vector: false
            });
        } else {
            console.log('📋 Buscando todo o conhecimento...\n');
            scrollResult = await client.scroll(COLLECTION_NAME, {
                limit: 100,
                with_payload: true,
                with_vector: false
            });
        }

        const points = scrollResult.points;

        if (points.length === 0) {
            console.log('📭 Nenhum conhecimento encontrado!');
            return;
        }

        console.log(`✅ Encontrados ${points.length} itens de conhecimento:\n`);
        console.log('═'.repeat(80));

        // Agrupar por categoria
        const byCategory = {};
        points.forEach(point => {
            const category = point.payload.category || 'outros';
            if (!byCategory[category]) {
                byCategory[category] = [];
            }
            byCategory[category].push(point);
        });

        // Exibir por categoria
        Object.keys(byCategory).sort().forEach(category => {
            console.log(`\n📁 ${category.toUpperCase()} (${byCategory[category].length} itens)`);
            console.log('─'.repeat(80));

            byCategory[category].forEach((point, idx) => {
                const p = point.payload;
                console.log(`\n${idx + 1}. ID: ${point.id}`);
                console.log(`   Camada: ${p.layer || 'N/A'}`);
                console.log(`   Descrição: ${p.description || p.text || 'N/A'}`);

                if (p.keywords && p.keywords.length > 0) {
                    console.log(`   Keywords: ${p.keywords.join(', ')}`);
                }

                if (p.screen_id) {
                    console.log(`   Tela: ${p.screen_id}`);
                }

                if (p.usage_count !== undefined) {
                    console.log(`   Uso: ${p.usage_count}x | Taxa de sucesso: ${(p.success_rate * 100).toFixed(0)}%`);
                }

                if (p.created_by) {
                    console.log(`   Criado por: User #${p.created_by}`);
                }

                if (p.created_at) {
                    console.log(`   Data: ${new Date(p.created_at).toLocaleString('pt-BR')}`);
                }
            });
        });

        console.log('\n' + '═'.repeat(80));
        console.log(`\n📊 RESUMO:`);
        console.log(`   Total: ${points.length} itens`);
        Object.keys(byCategory).forEach(cat => {
            console.log(`   - ${cat}: ${byCategory[cat].length}`);
        });

        // Estatísticas
        const layers = [...new Set(points.map(p => p.payload.layer))];
        console.log(`\n🏷️  Camadas: ${layers.join(', ')}`);

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 Qdrant não está rodando. Inicie com: docker-compose up -d');
        }
    }
}

viewKnowledge();
