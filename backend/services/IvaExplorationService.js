const db = require('../config/database');

/**
 * IVA Exploration Service
 * Responsável por descobrir dinamicamente recursos do sistema CASH
 */
class IvaExplorationService {

    /**
     * Explora um projeto pela primeira vez ou re-explora se necessário
     */
    async exploreProject(projectId, userId) {
        console.log(`[IVA Exploration] Iniciando descoberta para projeto ${projectId}`);

        const sessionId = await this.startLearningSession(projectId, userId);

        try {
            const discoveries = {
                navigation: await this.discoverNavigation(projectId, userId),
                businessContext: await this.discoverBusinessContext(projectId),
                stats: {
                    navigationItems: 0,
                    businessTypes: 0
                }
            };

            discoveries.stats.navigationItems = discoveries.navigation?.screens?.length || 0;
            discoveries.stats.businessTypes =
                (discoveries.businessContext.incomeCategories?.length || 0) +
                (discoveries.businessContext.expenseCategories?.length || 0) +
                (discoveries.businessContext.productionCategories?.length || 0);

            // Persistir descobertas
            await this.persistDiscoveries(projectId, userId, discoveries);

            // Finalizar sessão
            await this.endLearningSession(sessionId, discoveries.stats);

            console.log(`[IVA Exploration] Descoberta concluída:`, discoveries.stats);

            return discoveries;

        } catch (error) {
            console.error('[IVA Exploration] Erro:', error);
            await this.endLearningSession(sessionId, { errors_count: 1 });
            throw error;
        }
    }

    /**
     * Descobre contexto de negócio através das árvores de tipos
     */
    async discoverBusinessContext(projectId) {
        console.log('[IVA Exploration] Descobrindo contexto de negócio...');

        const context = {
            projectId,
            discoveredAt: new Date(),
            incomeCategories: null,
            expenseCategories: null,
            productionCategories: null,
            insights: {}
        };

        try {
            // Buscar tipos de entrada
            const [incomeTypes] = await db.query(`
                SELECT id, nome as label, parent_id, active
                FROM tipo_entrada 
                WHERE project_id = ? AND active = 1
                ORDER BY nome
            `, [projectId]);

            if (incomeTypes.length > 0) {
                context.incomeCategories = this.buildTree(incomeTypes);
                context.insights = {
                    ...context.insights,
                    ...this.inferFromCategories(incomeTypes, 'income')
                };
            }

            // Buscar tipos de saída
            const [expenseTypes] = await db.query(`
                SELECT id, label, parent_id, active
                FROM tipo_saida 
                WHERE project_id = ? AND active = 1
                ORDER BY label
            `, [projectId]);

            if (expenseTypes.length > 0) {
                context.expenseCategories = this.buildTree(expenseTypes);
                context.insights = {
                    ...context.insights,
                    ...this.inferFromCategories(expenseTypes, 'expense')
                };
            }

            // Buscar tipos de produção/revenda
            const [prodTypes] = await db.query(`
                SELECT id, label, parent_id, active
                FROM tipo_producao_revenda 
                WHERE project_id = ? AND active = 1
                ORDER BY label
            `, [projectId]);

            if (prodTypes.length > 0) {
                context.productionCategories = this.buildTree(prodTypes);
                context.insights = {
                    ...context.insights,
                    ...this.inferFromCategories(prodTypes, 'production')
                };
            }

            console.log('[IVA Exploration] Contexto de negócio descoberto:', {
                income: context.incomeCategories?.length || 0,
                expense: context.expenseCategories?.length || 0,
                production: context.productionCategories?.length || 0,
                insights: Object.keys(context.insights)
            });

            return context;

        } catch (error) {
            console.error('[IVA Exploration] Erro ao descobrir contexto:', error);
            return context;
        }
    }

    /**
     * Descobre navegação disponível
     * Por enquanto, retorna estrutura que será fornecida pelo frontend
     * Futuramente, pode buscar do DB ou construir dinamicamente
     */
    async discoverNavigation(projectId, userId) {
        console.log('[IVA Exploration] Descobrindo navegação...');

        // Por enquanto, navegação será fornecida pelo frontend via context
        // Aqui apenas registramos que precisamos dela

        return {
            projectId,
            discoveredAt: new Date(),
            needsFrontendData: true,
            screens: [] // Será preenchido quando frontend enviar
        };
    }

    /**
     * Infere insights de negócio analisando nomes de categorias
     */
    inferFromCategories(categories, type) {
        const insights = {};
        const labels = categories.map(c => (c.label || c.nome || '').toLowerCase());

        // Detectar setor/indústria
        if (!insights.likelyIndustry) {
            if (labels.some(l => l.includes('consultor') || l.includes('projeto') || l.includes('hora'))) {
                insights.likelyIndustry = 'consultoria';
            } else if (labels.some(l => l.includes('produto') || l.includes('venda') || l.includes('mercadoria'))) {
                insights.likelyIndustry = 'varejo';
            } else if (labels.some(l => l.includes('paciente') || l.includes('consulta') || l.includes('procedimento'))) {
                insights.likelyIndustry = 'saúde';
            } else if (labels.some(l => l.includes('causa') || l.includes('honorário') || l.includes('processo'))) {
                insights.likelyIndustry = 'advocacia';
            }
        }

        // Detectar modelo de negócio
        if (labels.some(l => l.includes('recorrente') || l.includes('mensalidade') || l.includes('assinatura'))) {
            insights.businessModel = 'recorrente';
        } else if (labels.some(l => l.includes('projeto'))) {
            insights.businessModel = 'projeto';
        }

        // Detectar complexidade
        insights.categoryComplexity = categories.some(c => c.parent_id) ? 'hierarchical' : 'flat';

        return insights;
    }

    /**
     * Constrói árvore hierárquica a partir de lista flat
     */
    buildTree(flatList) {
        const tree = [];
        const lookup = {};

        // Criar lookup
        flatList.forEach(item => {
            lookup[item.id] = {
                ...item,
                children: []
            };
        });

        // Construir hierarquia
        flatList.forEach(item => {
            if (item.parent_id && lookup[item.parent_id]) {
                lookup[item.parent_id].children.push(lookup[item.id]);
            } else {
                tree.push(lookup[item.id]);
            }
        });

        return tree;
    }

    /**
     * Persiste descobertas no banco
     */
    async persistDiscoveries(projectId, userId, discoveries) {
        console.log('[IVA Exploration] Persistindo descobertas...');

        try {
            // Persistir contexto de negócio (nível projeto)
            if (discoveries.businessContext && Object.keys(discoveries.businessContext).length > 2) {
                await db.query(`
                    INSERT INTO iva_discovered_knowledge 
                        (level, project_id, knowledge_type, discovered_data, confidence_score)
                    VALUES 
                        ('project', ?, 'business_context', ?, 1.0)
                    ON DUPLICATE KEY UPDATE
                        discovered_data = VALUES(discovered_data),
                        last_validated_at = NOW()
                `, [projectId, JSON.stringify(discoveries.businessContext)]);

                console.log('[IVA Exploration] Contexto de negócio persistido');
            }

            // Navegação será persistida quando frontend fornecer dados

        } catch (error) {
            console.error('[IVA Exploration] Erro ao persistir:', error);
        }
    }

    /**
     * Inicia sessão de aprendizado
     */
    async startLearningSession(projectId, userId) {
        const [result] = await db.query(`
            INSERT INTO iva_learning_sessions (project_id, user_id)
            VALUES (?, ?)
        `, [projectId, userId]);

        return result.insertId;
    }

    /**
     * Finaliza sessão de aprendizado
     */
    async endLearningSession(sessionId, stats) {
        await db.query(`
            UPDATE iva_learning_sessions
            SET 
                session_end = NOW(),
                discoveries_count = ?,
                validations_count = ?,
                errors_count = ?,
                commands_processed = ?
            WHERE id = ?
        `, [
            stats.navigationItems || 0,
            stats.businessTypes || 0,
            stats.errors_count || 0,
            stats.commands_processed || 0,
            sessionId
        ]);
    }

    /**
     * Verifica se projeto já foi explorado
     */
    async hasProjectKnowledge(projectId) {
        const [rows] = await db.query(`
            SELECT COUNT(*) as count
            FROM iva_discovered_knowledge
            WHERE project_id = ? AND level = 'project'
        `, [projectId]);

        return rows[0].count > 0;
    }

    /**
     * Carrega conhecimento existente do projeto
     */
    async loadProjectKnowledge(projectId) {
        const [rows] = await db.query(`
            SELECT knowledge_type, discovered_data, confidence_score, discovered_at
            FROM iva_discovered_knowledge
            WHERE project_id = ? AND level = 'project' AND confidence_score > 0.5
            ORDER BY knowledge_type
        `, [projectId]);

        const knowledge = {};

        rows.forEach(row => {
            knowledge[row.knowledge_type] = {
                data: JSON.parse(row.discovered_data),
                confidence: row.confidence_score,
                discoveredAt: row.discovered_at
            };
        });

        return knowledge;
    }
}

module.exports = new IvaExplorationService();
