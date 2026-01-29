const express = require('express');
const router = express.Router();

const caracteristicasController = require('../controllers/caracteristicasController');
const gruposLeadsController = require('../controllers/gruposLeadsController');
const leadsController = require('../controllers/leadsController');
const campanhasController = require('../controllers/campanhasController');

// ============================================
// CARACTERÍSTICAS
// ============================================
router.get('/caracteristicas', caracteristicasController.getAll);
router.get('/caracteristicas/:id', caracteristicasController.getById);
router.post('/caracteristicas', caracteristicasController.create);
router.put('/caracteristicas/:id', caracteristicasController.update);
router.delete('/caracteristicas/:id', caracteristicasController.delete);
router.get('/caracteristicas/:id/grupos', caracteristicasController.getGrupos);
router.get('/caracteristicas/:id/valores', caracteristicasController.getValues);
router.post('/caracteristicas/:id/valores', caracteristicasController.addValue);
router.put('/caracteristicas/valores/:id', caracteristicasController.updateValue);
router.delete('/caracteristicas/valores/:id', caracteristicasController.removeValue);

// ============================================
// GRUPOS DE LEADS
// ============================================
router.get('/grupos-leads', gruposLeadsController.getAll);
router.get('/grupos-leads/buscar-por-caracteristicas', gruposLeadsController.buscarPorCaracteristicas);
router.get('/grupos-leads/:id', gruposLeadsController.getById);
router.get('/grupos-leads/:id/arvore', gruposLeadsController.getArvore);
router.get('/grupos-leads/:id/leads-expandidos', gruposLeadsController.getLeadsExpandidos);
router.post('/grupos-leads', gruposLeadsController.create);
router.put('/grupos-leads/:id', gruposLeadsController.update);
router.delete('/grupos-leads/:id', gruposLeadsController.delete);

// Características do grupo
router.get('/grupos-leads/:id/caracteristicas', gruposLeadsController.getCaracteristicas);
router.post('/grupos-leads/:id/caracteristicas', gruposLeadsController.addCaracteristica);
router.delete('/grupos-leads/:id/caracteristicas/:caracteristicaId', gruposLeadsController.removeCaracteristica);

// Subgrupos
router.get('/grupos-leads/:id/subgrupos', gruposLeadsController.getSubgrupos);
router.post('/grupos-leads/:id/subgrupos', gruposLeadsController.addSubgrupo);
router.delete('/grupos-leads/:id/subgrupos/:grupoFilhoId', gruposLeadsController.removeSubgrupo);

// ============================================
// LEADS
// ============================================
router.get('/leads', leadsController.getAll);
router.get('/leads/:id', leadsController.getById);
router.post('/leads', leadsController.create);
router.put('/leads/:id', leadsController.update);
router.delete('/leads/:id', leadsController.delete);
router.post('/leads/bulk-characteristic', leadsController.bulkCharacteristic);

// Grupos do Lead
router.post('/leads/:id/groups', leadsController.associarGrupo);
router.delete('/leads/:id/groups/:grupoId', leadsController.desassociarGrupo);

// Associações com campanhas
router.post('/leads/:id/campanhas', leadsController.associarCampanha);
router.delete('/leads/:id/campanhas/:campanhaId', leadsController.desassociarCampanha);
router.put('/leads/:id/campanhas/:campanhaId', leadsController.atualizarStatusCampanha);

// ============================================
// CAMPANHAS
// ============================================
router.get('/campanhas', campanhasController.getAll);
router.get('/campanhas/:id', campanhasController.getById);
router.post('/campanhas', campanhasController.create);
router.put('/campanhas/:id', campanhasController.update);
router.delete('/campanhas/:id', campanhasController.delete);

// Grupos da campanha
router.get('/campanhas/:id/grupos', campanhasController.getGrupos);
router.post('/campanhas/:id/grupos', campanhasController.associarGrupo);
router.delete('/campanhas/:id/grupos/:grupoId', campanhasController.desassociarGrupo);

// Leads da campanha
router.get('/campanhas/:id/leads', campanhasController.getLeads);

// Estatísticas
// Estatísticas
router.get('/campanhas/:id/estatisticas', campanhasController.getEstatisticas);

// Disparar (Envio individual)
router.post('/campanhas/:id/disparar', campanhasController.sendSingle);

// Disparar de forma assíncrona (background processing)
router.post('/campanhas/:id/disparar-async', campanhasController.dispararAsync);

// FIX DB (Temporary)
router.post('/campanhas/db-fix', campanhasController.runDatabaseFix);

// Fix text columns for Base64 support
router.post('/campanhas/fix-text-columns', campanhasController.fixTextColumns);

// Detalhes de disparo (para monitoramento em tempo real)
router.get('/campanhas/:id/dispatch-details', campanhasController.getDispatchDetails);

// Aplicar migração do redesign
router.post('/campanhas/apply-redesign-migration', campanhasController.applyRedesignMigration);

// Corrigir coluna status (adicionar valores enviando, envio_finalizado, erro)
router.post('/campanhas/fix-status-column', campanhasController.fixStatusColumn);

module.exports = router;
