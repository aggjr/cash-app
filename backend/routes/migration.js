const express = require('express');
const router = express.Router();
// Import existing migrations
const createMarketingTables = require('../migrations/create_marketing_tables');
const updateLeadsMultiRelations = require('../migrations/update_leads_multirelations');

// Endpoint temporário para executar migration de marketing
// Executa todas as migrations necessárias em ordem
router.get('/run-marketing-migration', async (req, res) => {
  try {
    console.log('🚀 Executando Fix de Database (Marketing)...');

    // 1. Tabelas Base
    await createMarketingTables();

    // 2. Atualização N:N Leads
    await updateLeadsMultiRelations();

    // 3. Colunas de Mensagem da Campanha
    const migrateCampaignMessages = require('../migrate_add_campaign_messages');
    await migrateCampaignMessages();

    console.log('✅ Fix concluído com sucesso!');
    res.json({
      success: true,
      message: 'Tabelas de Marketing e relacionamentos criados/atualizados com sucesso!'
    });

  } catch (error) {
    console.error('❌ Erro no Fix de Database:', error);
    res.status(500).json({
      error: 'Erro ao executar migration',
      details: error.message
    });
  }
});

module.exports = router;
