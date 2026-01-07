// Script de teste rápido para Qdrant
// Execute no servidor: node backend/test_qdrant_simple.js

require('dotenv').config();
const https = require('https');

console.log('🔍 Testando Qdrant...\n');

// 1. Verificar variáveis
console.log('📋 Variáveis de Ambiente:');
console.log('  QDRANT_URL:', process.env.QDRANT_URL || '❌ NÃO CONFIGURADA');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ NÃO CONFIGURADA');

if (!process.env.QDRANT_URL) {
    console.log('\n❌ QDRANT_URL não está configurada!');
    process.exit(1);
}

// 2. Testar conexão com Qdrant
const qdrantUrl = new URL(process.env.QDRANT_URL);

console.log('\n🌐 Testando conexão com:', process.env.QDRANT_URL);

const options = {
    hostname: qdrantUrl.hostname,
    port: qdrantUrl.port || 443,
    path: '/collections',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
};

if (process.env.QDRANT_API_KEY) {
    options.headers['api-key'] = process.env.QDRANT_API_KEY;
}

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ Conexão com Qdrant OK!');
            console.log('📊 Resposta:', body.substring(0, 200) + '...');
        } else {
            console.log('❌ Erro na conexão:', res.statusCode);
            console.log('📄 Resposta:', body);
        }
        process.exit(res.statusCode === 200 ? 0 : 1);
    });
});

req.on('error', (e) => {
    console.log('❌ Erro de conexão:', e.message);
    console.log('\n⚠️ Possíveis causas:');
    console.log('  1. URL incorreta');
    console.log('  2. Servidor Qdrant não está rodando');
    console.log('  3. Firewall bloqueando conexão');
    process.exit(1);
});

req.end();
