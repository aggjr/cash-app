require('dotenv').config();
const db = require('./config/database');

async function testQuery() {
    try {
        console.log('Testing Producao Query...');
        const projectId = 1; // Assuming 1 exists
        const startDate = '2025-01-01';

        // This simulates the query I fixed:
        const [producaoResult] = await db.execute(`
            SELECT SUM(valor) as total 
            FROM producao_revenda 
            WHERE project_id = ? 
            AND active = 1 
            AND data_fato < ?
        `, [projectId, startDate]);

        console.log('Producao Result:', producaoResult[0]);
        console.log('SUCCESS: Query executed without error.');
        process.exit(0);
    } catch (error) {
        console.error('FAILURE:', error.message);
        process.exit(1);
    }
}

testQuery();
