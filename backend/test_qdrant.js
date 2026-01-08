require('dotenv').config();

async function testQdrant() {
    console.log('🔍 Testando Conexão com Qdrant...\n');

    // 1. Verificar variáveis de ambiente
    console.log('📋 Variáveis de Ambiente:');
    console.log('  QDRANT_URL:', process.env.QDRANT_URL || '❌ NÃO CONFIGURADA');
    console.log('  QDRANT_API_KEY:', process.env.QDRANT_API_KEY ? '✅ Configurada' : '⚠️ Não configurada (pode ser opcional)');
    console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ NÃO CONFIGURADA');

    // 2. Testar VectorSearchService
    try {
        console.log('\n🧪 Testando VectorSearchService...');
        const vectorService = require('./services/VectorSearchService');

        // Testar conexão com Qdrant
        console.log('  → Verificando coleção...');
        await vectorService.ensureCollection();
        console.log('  ✅ Coleção "iva_knowledge" está acessível!');

        // Testar geração de embedding
        console.log('  → Testando geração de embedding...');
        const testEmbedding = await vectorService.generateEmbedding('teste de conexão');
        console.log(`  ✅ Embedding gerado com sucesso! (dimensão: ${testEmbedding.length})`);

        // Testar busca
        console.log('  → Testando busca semântica...');
        const results = await vectorService.search('teste', {}, 1);
        console.log(`  ✅ Busca executada! (${results.length} resultados encontrados)`);

        console.log('\n✅ QDRANT ESTÁ FUNCIONANDO PERFEITAMENTE!\n');

    } catch (error) {
        console.error('\n❌ ERRO ao testar Qdrant:');
        console.error('  Mensagem:', error.message);
        console.error('  Stack:', error.stack);
        console.log('\n⚠️ O Qdrant NÃO está funcionando. Verifique:');
        console.log('  1. QDRANT_URL está correto?');
        console.log('  2. Servidor Qdrant está rodando?');
        console.log('  3. OPENAI_API_KEY está configurada?');
    }

    process.exit();
}

testQdrant();
