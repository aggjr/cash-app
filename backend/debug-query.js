require('dotenv').config();
const db = require('./config/database');

async function debugFullQuery() {
    try {
        console.log('🔍 Testing Full Entradas Query...');

        const projectId = 1; // Assuming project 1 for test
        const params = [projectId, projectId, 10, 0]; // projectId, projectId (for count filtering?), no, filtering logic is separate.

        // Exact query structure from incomeController.js
        const query = `
            WITH RECURSIVE TypeHierarchy AS (
                SELECT id, label, parent_id, CAST(label AS CHAR(255)) as full_path
                FROM tipo_entrada
                WHERE parent_id IS NULL
                UNION ALL
                SELECT t.id, t.label, t.parent_id, CONCAT(th.full_path, ' / ', t.label)
                FROM tipo_entrada t
                INNER JOIN TypeHierarchy th ON t.parent_id = th.id
             )
             SELECT 
                e.*,
                th.full_path as tipo_entrada_name,
                emp.name as company_name,
                c.name as account_name,
                c.account_type as account_type
             FROM entradas e
             LEFT JOIN TypeHierarchy th ON e.tipo_entrada_id = th.id
             INNER JOIN empresas emp ON e.company_id = emp.id
             INNER JOIN contas c ON e.account_id = c.id
             WHERE e.project_id = ? AND e.active = 1
             ORDER BY e.data_fato DESC, e.created_at DESC
             LIMIT 10 OFFSET 0
        `;

        console.log('Executing query...');
        const [rows] = await db.query(query, [projectId]);
        console.log('✅ Query success!');
        console.log(`Found ${rows.length} rows.`);
        console.log(JSON.stringify(rows[0] || {}, null, 2));

    } catch (error) {
        console.error('❌ Query FAILED!');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('SQLNO:', error.errno);
    } finally {
        process.exit(0);
    }
}

debugFullQuery();
