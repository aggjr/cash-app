require('dotenv').config();
const db = require('./config/database');
const extratoController = require('./controllers/extratoController');
const consolidadasController = require('./controllers/consolidadasController');

// Mock Request/Response
const mockRes = {
    status: (code) => ({
        json: (data) => console.log(`[${code}] JSON:`, JSON.stringify(data, null, 2))
    }),
    json: (data) => console.log('JSON:', JSON.stringify(data, null, 2))
};

const runTests = async () => {
    try {
        console.log('--- Testing Extrato ---');
        // Find a valid account/project/company to test with
        const [projects] = await db.query('SELECT DISTINCT project_id FROM entradas LIMIT 1');
        const projectId = projects.length > 0 ? projects[0].project_id : 1;

        const [accounts] = await db.query('SELECT id FROM contas LIMIT 1');
        const accountId = accounts.length > 0 ? accounts[0].id : 1;

        const reqExtrato = {
            query: {
                projectId: projectId,
                accountId: accountId,
                startDate: '2025-01-01',
                endDate: '2025-12-31'
            }
        };
        await extratoController.getExtrato(reqExtrato, mockRes);

        console.log('\n--- Testing Consolidadas ---');
        const reqConsolidadas = {
            query: {
                projectId: projectId,
                viewType: 'caixa',
                startMonth: '2025-01',
                endMonth: '2025-12'
            }
        };
        await consolidadasController.getConsolidatedData(reqConsolidadas, mockRes);

    } catch (e) {
        console.error('CRITICAL TEST ERROR:', e);
    } finally {
        process.exit();
    }
};

runTests();
