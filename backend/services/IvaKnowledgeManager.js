/**
 * IVA Knowledge Manager
 * 
 * Gerencia conhecimento hierárquico da IVA com 5 camadas:
 * GLOBAL → MODULE → COMPANY → SECTOR → USER
 * 
 * Operações: LEARN, RELEARN, UNLEARN
 */

const db = require('../config/database');
const vectorService = require('./VectorSearchService');

class IvaKnowledgeManager {

    /**
     * APRENDER - Criar novo conhecimento
     */
    async learn(knowledgeData, userId) {
        const {
            layer_type,
            module_code,
            company_id,
            sector_id,
            user_id,
            knowledge_type,
            knowledge_key,
            knowledge_value,
            source = 'EXPLICIT'
        } = knowledgeData;

        // Verificar se já existe
        const existing = await this.findKnowledge({
            layer_type,
            module_code,
            company_id,
            sector_id,
            user_id,
            knowledge_type,
            knowledge_key
        });

        if (existing) {
            return {
                status: 'CONFLICT',
                message: `Já existe conhecimento sobre "${knowledge_key}". Use RELEARN para atualizar.`,
                existing: existing
            };
        }

        // Criar novo conhecimento
        const [result] = await db.query(`
            INSERT INTO iva_knowledge_layers
            (layer_type, module_code, company_id, sector_id, user_id,
             knowledge_type, knowledge_key, knowledge_value, source, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            layer_type,
            module_code || null,
            company_id || null,
            sector_id || null,
            user_id || null,
            knowledge_type,
            knowledge_key,
            JSON.stringify(knowledge_value),
            source,
            userId
        ]);

        // Registrar auditoria
        await this.logAudit(result.insertId, 'LEARN', null, knowledge_value, userId);

        // Sync with Qdrant
        this.syncWithQdrant({ ...knowledgeData, id: result.insertId }).catch(err =>
            console.error('[IVA Knowledge] Qdrant sync failed:', err.message)
        );

        console.log(`[IVA Knowledge] LEARNED: ${knowledge_key} at ${layer_type}/${knowledge_type}`);

        return {
            status: 'SUCCESS',
            id: result.insertId,
            message: `Conhecimento registrado em ${layer_type}/${knowledge_type}`
        };
    }

    /**
     * REAPRENDER - Atualizar conhecimento existente
     */
    async relearn(knowledgeId, newValue, userId, reason = null) {
        // Buscar conhecimento atual
        const [rows] = await db.query(`
            SELECT * FROM iva_knowledge_layers WHERE id = ?
        `, [knowledgeId]);

        if (rows.length === 0) {
            return {
                status: 'NOT_FOUND',
                message: 'Conhecimento não encontrado'
            };
        }

        const current = rows[0];
        const oldValue = JSON.parse(current.knowledge_value);

        // Atualizar com versionamento
        await db.query(`
            UPDATE iva_knowledge_layers
            SET knowledge_value = ?,
                previous_value = ?,
                version = version + 1,
                updated_at = NOW()
            WHERE id = ?
        `, [
            JSON.stringify(newValue),
            current.knowledge_value,
            knowledgeId
        ]);

        // Registrar auditoria
        await this.logAudit(knowledgeId, 'RELEARN', oldValue, newValue, userId, reason);

        // Sync with Qdrant
        this.syncWithQdrant({ ...current, knowledge_value: newValue }).catch(err =>
            console.error('[IVA Knowledge] Qdrant sync failed:', err.message)
        );

        console.log(`[IVA Knowledge] RELEARNED: ${current.knowledge_key} (v${current.version + 1})`);

        return {
            status: 'SUCCESS',
            message: 'Conhecimento atualizado',
            old_version: current.version,
            new_version: current.version + 1
        };
    }

    /**
     * DESAPRENDER - Remover conhecimento (soft delete)
     */
    async unlearn(knowledgeId, userId, reason = null) {
        // Buscar conhecimento
        const [rows] = await db.query(`
            SELECT * FROM iva_knowledge_layers WHERE id = ?
        `, [knowledgeId]);

        if (rows.length === 0) {
            return {
                status: 'NOT_FOUND',
                message: 'Conhecimento não encontrado'
            };
        }

        const knowledge = rows[0];

        // Verificar permissões
        const canDelete = await this.checkDeletePermission(knowledge, userId);
        if (!canDelete) {
            return {
                status: 'FORBIDDEN',
                message: `Sem permissão para remover conhecimento de nível ${knowledge.layer_type}`
            };
        }

        // Soft delete
        await db.query(`
            UPDATE iva_knowledge_layers
            SET active = FALSE,
                deleted_at = NOW(),
                deleted_by = ?
            WHERE id = ?
        `, [userId, knowledgeId]);

        // Registrar auditoria
        await this.logAudit(
            knowledgeId,
            'UNLEARN',
            JSON.parse(knowledge.knowledge_value),
            null,
            userId,
            reason
        );

        // Delete from Qdrant
        vectorService.deleteKnowledge(`layer_${knowledgeId}`).catch(err =>
            console.error('[IVA Knowledge] Qdrant delete failed:', err.message)
        );

        console.log(`[IVA Knowledge] UNLEARNED: ${knowledge.knowledge_key}`);

        return {
            status: 'SUCCESS',
            message: 'Conhecimento removido'
        };
    }

    /**
     * Buscar conhecimento (com cascata hierárquica)
     */
    async resolve(query, context) {
        const { userId, companyId, sectorId, moduleCode, knowledgeType } = context;

        // 1. Tentar busca semântica no Qdrant primeiro (mais inteligente)
        try {
            const semanticResults = await vectorService.search(query, {
                knowledge_type: knowledgeType,
                // Filtros de hierarquia seriam complexos aqui, vamos filtrar no código
            }, 10);

            // Filtrar resultados semânticos pela hierarquia permitida
            for (const result of semanticResults) {
                if (result.source === 'mysql_layers') {
                    const isGlobal = result.layer_type === 'GLOBAL';
                    const isModule = result.layer_type === 'MODULE' && result.module_code === moduleCode;
                    const isCompany = result.layer_type === 'COMPANY' && result.company_id === companyId;
                    const isSector = result.layer_type === 'SECTOR' && result.company_id === companyId && result.sector_id === sectorId;
                    const isUser = result.layer_type === 'USER' && result.user_id === userId;

                    if (isGlobal || isModule || isCompany || isSector || isUser) {
                        console.log(`[IVA Knowledge] Resolved semanticly from ${result.layer_type}/${result.knowledge_type}`);
                        return {
                            ...result,
                            knowledge_value: JSON.parse(result.text.split(': ')[1]) // Recuperar valor do texto (simplificado)
                        };
                    }
                } else if (result.source === 'json_global') {
                    // Global JSON knowledge is always accessible
                    console.log(`[IVA Knowledge] Resolved semanticly from JSON/${result.category}`);
                    return result;
                }
            }
        } catch (err) {
            console.error('[IVA Knowledge] Semantic search failed, falling back to MySQL:', err.message);
        }

        // 2. Busca em cascata tradicional (fallback ou exata)
        const searchPaths = [
            { layer: 'USER', filters: { user_id: userId } },
            { layer: 'SECTOR', filters: { company_id: companyId, sector_id: sectorId } },
            { layer: 'COMPANY', filters: { company_id: companyId } },
            { layer: 'MODULE', filters: { module_code: moduleCode } },
            { layer: 'GLOBAL', filters: {} }
        ];

        for (const path of searchPaths) {
            const knowledge = await this.searchLayer(query, path, knowledgeType);
            if (knowledge) {
                console.log(`[IVA Knowledge] Resolved from ${path.layer}/${knowledgeType}`);
                return knowledge;
            }
        }

        return null;
    }

    /**
     * Buscar em uma camada específica
     */
    async searchLayer(query, { layer, filters }, knowledgeType) {
        let sql = `
            SELECT * FROM iva_knowledge_layers
            WHERE layer_type = ?
              AND knowledge_type = ?
              AND active = TRUE
              AND (
                  knowledge_key LIKE ? OR
                  JSON_SEARCH(knowledge_value, 'one', ?, NULL, '$') IS NOT NULL
              )
        `;

        const params = [layer, knowledgeType, `%${query}%`, `%${query}%`];

        // Adicionar filtros dinâmicos
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                sql += ` AND ${key} = ?`;
                params.push(value);
            }
        }

        sql += ` ORDER BY usage_count DESC, priority DESC, updated_at DESC LIMIT 1`;

        const [rows] = await db.query(sql, params);
        return rows[0] || null;
    }

    /**
     * Buscar conhecimento por critérios
     */
    async findKnowledge(criteria) {
        let sql = 'SELECT * FROM iva_knowledge_layers WHERE 1=1';
        const params = [];

        for (const [key, value] of Object.entries(criteria)) {
            if (value !== undefined && value !== null) {
                sql += ` AND ${key} = ?`;
                params.push(value);
            }
        }

        sql += ' AND active = TRUE LIMIT 1';

        const [rows] = await db.query(sql, params);
        return rows[0] || null;
    }

    /**
     * Verificar permissão para deletar
     */
    async checkDeletePermission(knowledge, userId) {
        // Buscar informações do usuário
        const [users] = await db.query(`
            SELECT role, company_id FROM users WHERE id = ?
        `, [userId]);

        if (users.length === 0) return false;

        const user = users[0];

        // Regras de permissão
        switch (knowledge.layer_type) {
            case 'USER':
                return knowledge.user_id === userId;

            case 'SECTOR':
                return user.role === 'MANAGER' || user.role === 'ADMIN' || user.role === 'MASTER';

            case 'COMPANY':
                return user.role === 'ADMIN' || user.role === 'MASTER';

            case 'MODULE':
            case 'GLOBAL':
                return user.role === 'MASTER';

            default:
                return false;
        }
    }

    /**
     * Registrar auditoria
     */
    async logAudit(knowledgeId, operation, oldValue, newValue, userId, reason = null) {
        await db.query(`
            INSERT INTO iva_knowledge_audit
            (knowledge_id, operation, old_value, new_value, changed_by, reason)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            knowledgeId,
            operation,
            oldValue ? JSON.stringify(oldValue) : null,
            newValue ? JSON.stringify(newValue) : null,
            userId,
            reason
        ]);
    }

    /**
     * Incrementar contador de uso (aprendizado coletivo)
     */
    async incrementUsage(knowledgeId) {
        await db.query(`
            UPDATE iva_knowledge_layers
            SET usage_count = usage_count + 1,
                last_used_at = NOW()
            WHERE id = ?
        `, [knowledgeId]);
    }

    /**
     * Sincronizar com Qdrant
     */
    async syncWithQdrant(item) {
        const textToEmbed = `${item.knowledge_key}: ${JSON.stringify(item.knowledge_value)}`;
        const metadata = {
            source: 'mysql_layers',
            original_id: item.id,
            layer_type: item.layer_type,
            knowledge_type: item.knowledge_type,
            user_id: item.user_id,
            company_id: item.company_id,
            module_code: item.module_code
        };

        const qdrantId = `layer_${item.id}`;
        await vectorService.upsertKnowledge(qdrantId, textToEmbed, metadata);
    }
}

module.exports = new IvaKnowledgeManager();
