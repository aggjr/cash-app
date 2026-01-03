const db = require('./config/database');

async function testConsolidadas() {
    try {
        const projectId = 3; // From screenshot "id:3"
        const viewType = 'caixa';
        const startMonth = '2025-11';
        const endMonth = '2025-12';

        console.log('--- Testing Consolidadas Controller Logic ---');

        const isCaixa = viewType === 'caixa';

        const getFinancialTree = async (mode) => {
            const isProvisioned = mode === 'provisioned';
            console.log(`\n[${mode.toUpperCase()}]`);

            const getTableConfig = (table) => {
                let dateField = '';
                let filter = '';
                const colReal = table === 'entradas' ? 'data_real_recebimento' : 'data_real_pagamento';

                if (isCaixa) {
                    if (isProvisioned) {
                        filter = `AND ${colReal} IS NULL`;
                        if (table === 'entradas') {
                            dateField = 'COALESCE(data_prevista_atraso, data_prevista_recebimento)';
                        } else {
                            dateField = 'COALESCE(data_prevista_atraso, data_prevista_pagamento)';
                        }
                    } else {
                        filter = `AND ${colReal} IS NOT NULL`;
                        dateField = colReal;
                    }
                } else {
                    dateField = 'data_fato';
                    if (isProvisioned) filter = `AND ${colReal} IS NULL`;
                    else filter = `AND ${colReal} IS NOT NULL`;
                }
                return { dateField, filter };
            };

            const buildTreeForTable = async (typeTable, dataTable, foreignKeyColumn) => {
                const config = getTableConfig(dataTable);
                console.log(`  Table: ${dataTable}, DateField: ${config.dateField}, Filter: ${config.filter}`);

                // Fetch Types
                const [types] = await db.execute(
                    `SELECT id, label, parent_id FROM ${typeTable} WHERE project_id = ? ORDER BY label`,
                    [projectId]
                );

                // Build Filter
                let localFilter = config.filter;
                const queryParams = [projectId];

                if (startMonth) {
                    localFilter += ` AND DATE_FORMAT(${config.dateField}, '%Y-%m') >= ?`;
                    queryParams.push(startMonth);
                }
                if (endMonth) {
                    localFilter += ` AND DATE_FORMAT(${config.dateField}, '%Y-%m') <= ?`;
                    queryParams.push(endMonth);
                }

                const query = `
                    SELECT 
                        d.id, 
                        d.valor, 
                        d.${foreignKeyColumn} as type_id, 
                        DATE_FORMAT(${config.dateField}, '%Y-%m') as month_key
                    FROM ${dataTable} d
                    WHERE d.project_id = ? AND d.active = 1 ${localFilter}
                `;

                console.log(`  Query: ${query.replace(/\s+/g, ' ').trim()}`);
                console.log(`  Params: ${queryParams}`);

                try {
                    const [items] = await db.execute(query, queryParams);
                    console.log(`  SUCCESS. Items: ${items.length}`);
                } catch (e) {
                    console.error(`  FAILURE in ${dataTable}:`, e.message);
                }
            };

            await buildTreeForTable('tipo_saida', 'saidas', 'tipo_saida_id');
            await buildTreeForTable('tipo_producao_revenda', 'producao_revenda', 'tipo_id');
            await buildTreeForTable('tipo_entrada', 'entradas', 'tipo_entrada_id');
        };

        await getFinancialTree('realized');
        await getFinancialTree('provisioned');

    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        // process.exit();
    }
}

testConsolidadas();
