// Teste rápido para verificar se a OpenAI API está funcionando
require('dotenv').config();

async function testOpenAI() {
    console.log('🔍 Testando OpenAI API...\n');

    console.log('📋 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ NÃO CONFIGURADA');

    if (!process.env.OPENAI_API_KEY) {
        console.log('\n❌ OPENAI_API_KEY não está configurada!');
        process.exit(1);
    }

    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        console.log('\n🧪 Gerando embedding de teste...');
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: 'teste de conexão'
        });

        console.log('✅ Embedding gerado com sucesso!');
        console.log('📊 Dimensão:', response.data[0].embedding.length);
        console.log('📄 Primeiros valores:', response.data[0].embedding.slice(0, 5));

    } catch (error) {
        console.log('\n❌ Erro ao gerar embedding:');
        console.log('  Mensagem:', error.message);
        if (error.status) console.log('  Status:', error.status);
    }

    process.exit();
}

testOpenAI();
