const express = require('express');
const router = express.Router();
const ivaController = require('../controllers/ivaControllerV2');
const auth = require('../middleware/auth');
const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');

// POST /api/IVA/chat - Chat with IVA using LLM
router.post('/chat', auth, ivaController.chat);

// POST /api/IVA/operate - Decide operational action (Navigate, Click, Fill)
router.post('/operate', auth, ivaController.operate);

// POST /api/IVA/learn - Record knowledge (active learning)
router.post('/learn', auth, async (req, res) => {
    try {
        const { type, data } = req.body;
        const userId = req.user.id;

        await IvaGlobalKnowledge.contribute(type, data, userId);

        res.json({ success: true });
    } catch (error) {
        console.error('[IVA Learn] Error:', error);
        res.status(500).json({ error: 'Erro ao registrar conhecimento' });
    }
});

// POST /api/IVA/observe - Record observation (passive learning)
router.post('/observe', auth, async (req, res) => {
    try {
        const { type, ...data } = req.body;
        const userId = req.user.id;

        // Convert observation to knowledge format
        let knowledgeType, knowledgeData;

        switch (type) {
            case 'navigation':
                knowledgeType = 'menus';
                knowledgeData = {
                    screen_id: data.screen_id,
                    menu_path: data.menu_path,
                    keywords: IvaGlobalKnowledge.extractKeywords(data.menu_path),
                    purpose: `Gerenciar ${data.screen_id}`,
                    observation: true
                };
                break;

            case 'filter_usage':
                knowledgeType = 'actions';
                knowledgeData = {
                    screen_id: data.screen_id,
                    action_id: data.filter_id,
                    action_type: 'filter',
                    description: `Filtro de ${data.filter_type}`,
                    keywords: [data.filter_type, 'filtrar', 'buscar'],
                    observation: true
                };
                break;

            case 'button_click':
                knowledgeType = 'actions';
                knowledgeData = {
                    screen_id: data.screen_id,
                    action_id: data.button_id,
                    action_type: data.button_type || 'button',
                    description: data.button_label,
                    keywords: IvaGlobalKnowledge.extractKeywords(data.button_label),
                    observation: true
                };
                break;

            default:
                return res.json({ success: true }); // Ignore unknown types
        }

        await IvaGlobalKnowledge.contribute(knowledgeType, knowledgeData, userId);

        res.json({ success: true });
    } catch (error) {
        console.error('[IVA Observe] Error:', error);
        res.status(500).json({ error: 'Erro ao processar observação' });
    }
});

// Knowledge optimization routes removed - service deprecated
// Use IvaGlobalKnowledge.contribute() for knowledge management

// POST /api/IVA/record-failure - Record failure for self-healing
router.post('/record-failure', auth, async (req, res) => {
    try {
        const { type, item_id } = req.body;
        await IvaGlobalKnowledge.recordFailure(type, item_id);
        res.json({ success: true });
    } catch (error) {
        console.error('[IVA Failure] Error:', error);
        res.status(500).json({ error: 'Erro ao registrar falha' });
    }
});

// POST /api/IVA/record-success - Record success (resets failures)
router.post('/record-success', auth, async (req, res) => {
    try {
        const { type, item_id } = req.body;
        await IvaGlobalKnowledge.recordSuccess(type, item_id);
        res.json({ success: true });
    } catch (error) {
        console.error('[IVA Success] Error:', error);
        res.status(500).json({ error: 'Erro ao registrar sucesso' });
    }
});

// Include analytics routes
const ivaAnalytics = require('./ivaAnalytics');
router.use('/', ivaAnalytics);

// Include tracking routes
const ivaTracking = require('./ivaTracking');
router.use('/', ivaTracking);

// --- TEMPORARY MIGRATION ROUTE ---
router.get('/migrate-to-qdrant-force', async (req, res) => {
    console.log('🚀 Starting Forced Qdrant Migration via Route...');
    try {
        const VectorSearchService = require('../services/VectorSearchService');

        // 1. Define Screens (extracted from IvaKnowledge.js)
        const screens = [
            { id: 'dashboard', name: 'Dashboard', desc: 'Visão geral do sistema com atalhos principais.', keywords: ['inicio', 'home', 'começo', 'painel'] },
            { id: 'entrada', name: 'Entradas', desc: 'Tela para registro de ganhos, receitas e recebimentos.', keywords: ['ganhos', 'receitas', 'recebimentos', 'vendas'] },
            { id: 'saida', name: 'Saídas', desc: 'Tela para registro de gastos, despesas e pagamentos.', keywords: ['gastos', 'despesas', 'pagamentos', 'custos'] },
            { id: 'contas', name: 'Contas Bancárias', desc: 'Gerenciamento de contas bancárias e saldos.', keywords: ['banco', 'saldo', 'conta corrente', 'poupança'] },
            { id: 'producao-revenda', name: 'Produção e Revenda', desc: 'Gestão de itens produzidos ou revendidos pela empresa.', keywords: ['estoque', 'produtos', 'revenda', 'produção'] },
            { id: 'usuarios', name: 'Gerenciamento de Usuários', desc: 'Cadastro e controle de usuários do sistema.', keywords: ['usuário', 'usuarios', 'login', 'acesso', 'perfil', 'pessoas'] },
            { id: 'empresa', name: 'Dados da Empresa', desc: 'Cadastro das informações principais da empresa.', keywords: ['empresa', 'cnpj', 'endereço', 'dados cadastrais'] },
            { id: 'parametros-gerais', name: 'Parâmetros Gerais', desc: 'Configurações globais do sistema.', keywords: ['configuração', 'configurações', 'parâmetros', 'setup', 'ajustes'] },
            { id: 'transferencias', name: 'Transferências', desc: 'Transferências entre contas bancárias.', keywords: ['transferência', 'movimentar', 'ted', 'doc'] },
            { id: 'extrato-conta', name: 'Extrato', desc: 'Extrato detalhado das contas.', keywords: ['extrato', 'movimentação', 'histórico'] },
            { id: 'consolidadas', name: 'Consolidadas', desc: 'Visão consolidada das transações financeiras - reais e previstas.', keywords: ['consolidada', 'consolidadas', 'análise financeira', 'transações', 'consolidado'] },
            { id: 'previsao', name: 'Previsão Diária', desc: 'Previsão diária do fluxo de caixa.', keywords: ['previsão', 'fluxo de caixa', 'forecast', 'projeção'] },
            { id: 'analise-financeira', name: 'Análise Financeira', desc: 'Relatórios e gráficos de análise financeira.', keywords: ['análise', 'relatório', 'gráfico', 'ROI', 'performance'] }
        ];

        // 2. Define Actions (extracted from IvaScreenActions.js)
        const actions = [
            { screen: 'previsao', id: 'setDaysAhead', desc: 'Filtrar X dias à frente na previsão de fluxo', params: ['days'] },
            { screen: 'previsao', id: 'setDateRange', desc: 'Filtrar por intervalo de datas específico', params: ['dataInicio', 'dataFim'] },
            { screen: 'entrada', id: 'filterByMonth', desc: 'Filtrar entradas por mês e ano específico', params: ['mes', 'ano'] },
            { screen: 'entrada', id: 'filterByType', desc: 'Filtrar por tipo de entrada (Serviços, Vendas, etc)', params: ['tipoId'] },
            { screen: 'entrada', id: 'filterByStatus', desc: 'Filtrar por status (Realizada/Prevista)', params: ['status'] },
            { screen: 'saida', id: 'filterByMonth', desc: 'Filtrar saídas por mês e ano', params: ['mes', 'ano'] },
            { screen: 'saida', id: 'filterByType', desc: 'Filtrar por tipo de saída', params: ['tipoId'] },
            { screen: 'usuarios', id: 'openNewUserModal', desc: 'Abrir modal para criar novo usuário', params: [] }
        ];

        // A. Upsert Screens
        let log = 'Starting migration...\n';
        for (const screen of screens) {
            const text = `Tela/Menu ${screen.name} (${screen.id}): ${screen.desc}. Palavras-chave: ${screen.keywords.join(', ')}`;
            await VectorSearchService.upsertKnowledge(
                `global_menus_${screen.id}`,
                text,
                {
                    category: 'menus',
                    layer: 'GLOBAL',
                    screen_id: screen.id,
                    name: screen.name,
                    purpose: screen.desc,
                    keywords: { primary: screen.keywords }
                }
            );
            log += `Upserted screen: ${screen.id}\n`;
        }

        // B. Upsert Actions
        for (const action of actions) {
            const text = `Ação na tela ${action.screen}: ${action.desc} (ID: ${action.id}). Parâmetros: ${action.params.join(', ')}`;
            await VectorSearchService.upsertKnowledge(
                `global_actions_${action.screen}_${action.id}`,
                text,
                {
                    category: 'actions',
                    layer: 'GLOBAL',
                    screen_id: action.screen,
                    action_id: action.id,
                    description: action.desc,
                    params: action.params
                }
            );
            log += `Upserted action: ${action.id}\n`;
        }

        console.log('✅ Migration via Route Completed!');
        res.send(`<pre>${log}\nMigration Completed Successfully!</pre>`);

    } catch (error) {
        console.error('❌ Migration Error:', error);
        res.status(500).send(`Error: ${error.message}<br><pre>${error.stack}</pre>`);
    }
});

module.exports = router;
