require('dotenv').config({ path: '../.env' });
const VectorSearchService = require('../services/VectorSearchService');

(async () => {
    console.log('🛑 INICIANDO LIMPEZA TOTAL DO QDRANT...');
    console.log('Target URL:', process.env.QDRANT_URL || 'Default (check service)');

    try {
        await VectorSearchService.recreateCollection();
        console.log('✅ SUCESSO! Banco de dados recriado do zero.');
        process.exit(0);
    } catch (e) {
        console.error('❌ ERRO AO LIMPAR:', e.message);
        process.exit(1);
    }
})();
