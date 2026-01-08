/**
 * Script simples para visualizar o conhecimento da IVA via API
 * 
 * Uso: node backend/scripts/view_iva_knowledge_simple.js
 */

const http = require('http');

async function viewKnowledge() {
    try {
        console.log('🔍 Buscando conhecimento da IVA via API...\n');

        // Fazer requisição para a API
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/iva-collective/knowledge',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.log(`❌ Erro: Status ${res.statusCode}`);
                    console.log(data);
                    return;
                }

                try {
                    const knowledge = JSON.parse(data);

                    if (!knowledge || knowledge.length === 0) {
                        console.log('📭 Nenhum conhecimento encontrado!');
                        console.log('\n💡 Treine a IVA dizendo: "IVA, aprenda que..."');
                        return;
                    }

                    console.log(`✅ Encontrados ${knowledge.length} itens de conhecimento:\n`);
                    console.log('═'.repeat(80));

                    // Agrupar por categoria
                    const byCategory = {};
                    knowledge.forEach(item => {
                        const category = item.category || 'outros';
                        if (!byCategory[category]) {
                            byCategory[category] = [];
                        }
                        byCategory[category].push(item);
                    });

                    // Exibir por categoria
                    Object.keys(byCategory).sort().forEach(category => {
                        console.log(`\n📁 ${category.toUpperCase()} (${byCategory[category].length} itens)`);
                        console.log('─'.repeat(80));

                        byCategory[category].forEach((item, idx) => {
                            console.log(`\n${idx + 1}. ${item.description || item.text || 'Sem descrição'}`);

                            if (item.keywords && item.keywords.length > 0) {
                                console.log(`   Keywords: ${item.keywords.join(', ')}`);
                            }

                            if (item.layer) {
                                console.log(`   Camada: ${item.layer}`);
                            }

                            if (item.usage_count !== undefined) {
                                console.log(`   Uso: ${item.usage_count}x | Sucesso: ${(item.success_rate * 100).toFixed(0)}%`);
                            }

                            if (item.created_at) {
                                console.log(`   Data: ${new Date(item.created_at).toLocaleString('pt-BR')}`);
                            }
                        });
                    });

                    console.log('\n' + '═'.repeat(80));
                    console.log(`\n📊 RESUMO:`);
                    console.log(`   Total: ${knowledge.length} itens`);
                    Object.keys(byCategory).forEach(cat => {
                        console.log(`   - ${cat}: ${byCategory[cat].length}`);
                    });

                } catch (e) {
                    console.error('❌ Erro ao processar resposta:', e.message);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Erro de conexão:', error.message);
            console.log('\n💡 Certifique-se de que o servidor está rodando em http://localhost:5000');
        });

        req.end();

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

viewKnowledge();
