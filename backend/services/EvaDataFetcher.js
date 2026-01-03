/**
 * EVA Data Fetcher
 * Fetches complete data from database based on screen filters
 * Hybrid approach: respects frontend filters, but queries DB for completeness
 */

class EvaDataFetcher {
    /**
     * Fetch Entradas data with applied filters
     * @param {Object} db - Database connection
     * @param {Object} filters - Applied filters from frontend
     * @param {number} projectId - Project ID
     * @returns {Promise<Object>} Complete data with aggregations
     */
    static async fetchEntradas(db, filters, projectId) {
        try {
            // Build WHERE clause based on filters
            const conditions = ['project_id = ?'];
            const params = [projectId];

            // Date filters
            if (filters.mes && filters.ano) {
                conditions.push('MONTH(data_prevista) = ? AND YEAR(data_prevista) = ?');
                params.push(filters.mes, filters.ano);
            } else if (filters.dataInicio && filters.dataFim) {
                conditions.push('data_prevista BETWEEN ? AND ?');
                params.push(filters.dataInicio, filters.dataFim);
            }

            // Type filter
            if (filters.tipo && filters.tipo !== 'Todos') {
                conditions.push('tipo = ?');
                params.push(filters.tipo);
            }

            // Status filter (real vs predicted)
            if (filters.status === 'Real') {
                conditions.push('data_real IS NOT NULL');
            } else if (filters.status === 'Prevista') {
                conditions.push('data_real IS NULL');
            }

            const whereClause = conditions.join(' AND ');

            // Fetch records
            const [records] = await db.query(
                `SELECT * FROM entradas WHERE ${whereClause} ORDER BY data_prevista DESC`,
                params
            );

            // Fetch aggregations
            const [aggregations] = await db.query(
                `SELECT 
                    COUNT(*) as total_records,
                    SUM(valor) as total_value,
                    AVG(valor) as avg_value,
                    MAX(valor) as max_value,
                    MIN(valor) as min_value
                FROM entradas 
                WHERE ${whereClause}`,
                params
            );

            // Group by type
            const [byType] = await db.query(
                `SELECT 
                    tipo,
                    COUNT(*) as count,
                    SUM(valor) as total
                FROM entradas 
                WHERE ${whereClause}
                GROUP BY tipo`,
                params
            );

            return {
                screenId: 'entradas',
                filters: filters,
                summary: {
                    totalRecords: aggregations[0].total_records || 0,
                    totalValue: parseFloat(aggregations[0].total_value || 0),
                    avgValue: parseFloat(aggregations[0].avg_value || 0),
                    maxValue: parseFloat(aggregations[0].max_value || 0),
                    minValue: parseFloat(aggregations[0].min_value || 0)
                },
                byType: byType,
                records: records.slice(0, 50), // Limit to 50 for LLM context
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[EvaDataFetcher] Error fetching entradas:', error);
            throw new Error('Erro ao buscar dados de entradas');
        }
    }

    /**
     * Fetch Saidas data with applied filters
     */
    static async fetchSaidas(db, filters, projectId) {
        try {
            const conditions = ['project_id = ?'];
            const params = [projectId];

            if (filters.mes && filters.ano) {
                conditions.push('MONTH(data_prevista) = ? AND YEAR(data_prevista) = ?');
                params.push(filters.mes, filters.ano);
            }

            if (filters.tipo && filters.tipo !== 'Todos') {
                conditions.push('tipo = ?');
                params.push(filters.tipo);
            }

            if (filters.status === 'Real') {
                conditions.push('data_real IS NOT NULL');
            } else if (filters.status === 'Prevista') {
                conditions.push('data_real IS NULL');
            }

            const whereClause = conditions.join(' AND ');

            const [records] = await db.query(
                `SELECT * FROM saidas WHERE ${whereClause} ORDER BY data_prevista DESC`,
                params
            );

            const [aggregations] = await db.query(
                `SELECT 
                    COUNT(*) as total_records,
                    SUM(valor) as total_value,
                    AVG(valor) as avg_value
                FROM saidas 
                WHERE ${whereClause}`,
                params
            );

            return {
                screenId: 'saidas',
                filters: filters,
                summary: {
                    totalRecords: aggregations[0].total_records || 0,
                    totalValue: parseFloat(aggregations[0].total_value || 0),
                    avgValue: parseFloat(aggregations[0].avg_value || 0)
                },
                records: records.slice(0, 50),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[EvaDataFetcher] Error fetching saidas:', error);
            throw new Error('Erro ao buscar dados de saídas');
        }
    }

    /**
     * Fetch Previsao data (forecast)
     */
    static async fetchPrevisao(db, filters, projectId) {
        try {
            // Previsão combines entradas and saidas
            const entradasData = await this.fetchEntradas(db, filters, projectId);
            const saidasData = await this.fetchSaidas(db, filters, projectId);

            const saldoInicial = filters.saldoInicial || 0;
            const totalEntradas = entradasData.summary.totalValue;
            const totalSaidas = saidasData.summary.totalValue;
            const saldoFinal = saldoInicial + totalEntradas - totalSaidas;

            return {
                screenId: 'previsao',
                filters: filters,
                summary: {
                    saldoInicial,
                    totalEntradas,
                    totalSaidas,
                    saldoFinal,
                    margem: totalEntradas - totalSaidas
                },
                entradas: entradasData.summary,
                saidas: saidasData.summary,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[EvaDataFetcher] Error fetching previsao:', error);
            throw new Error('Erro ao buscar previsão de fluxo');
        }
    }

    /**
     * Fetch Producao/Revenda data
     */
    static async fetchProducaoRevenda(db, filters, projectId) {
        try {
            const conditions = ['project_id = ?'];
            const params = [projectId];

            if (filters.mes && filters.ano) {
                conditions.push('MONTH(data_prevista) = ? AND YEAR(data_prevista) = ?');
                params.push(filters.mes, filters.ano);
            }

            if (filters.tipo && filters.tipo !== 'Todos') {
                conditions.push('tipo = ?');
                params.push(filters.tipo);
            }

            const whereClause = conditions.join(' AND ');

            const [records] = await db.query(
                `SELECT * FROM producao_revenda WHERE ${whereClause} ORDER BY data_prevista DESC`,
                params
            );

            const [aggregations] = await db.query(
                `SELECT 
                    COUNT(*) as total_records,
                    SUM(valor) as total_value
                FROM producao_revenda 
                WHERE ${whereClause}`,
                params
            );

            return {
                screenId: 'producao_revenda',
                filters: filters,
                summary: {
                    totalRecords: aggregations[0].total_records || 0,
                    totalValue: parseFloat(aggregations[0].total_value || 0)
                },
                records: records.slice(0, 50),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[EvaDataFetcher] Error fetching producao/revenda:', error);
            throw new Error('Erro ao buscar dados de produção/revenda');
        }
    }

    /**
     * Router method - fetches data based on screen ID
     */
    static async fetchScreenData(db, screenId, filters, projectId) {
        switch (screenId) {
            case 'entradas':
                return await this.fetchEntradas(db, filters, projectId);
            case 'saidas':
                return await this.fetchSaidas(db, filters, projectId);
            case 'previsao':
                return await this.fetchPrevisao(db, filters, projectId);
            case 'producao_revenda':
                return await this.fetchProducaoRevenda(db, filters, projectId);
            default:
                return null;
        }
    }
}

module.exports = EvaDataFetcher;
