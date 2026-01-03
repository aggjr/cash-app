const controller = require('./controllers/consolidadasController');

const req = {
    query: {
        projectId: 1, // Assumptions
        viewType: 'caixa',
        startMonth: '2025-11',
        endMonth: '2025-12'
    }
};

const res = {
    status: (code) => ({
        json: (data) => console.log(`Status ${code}:`, JSON.stringify(data, null, 2))
    }),
    json: (data) => console.log('Success:', JSON.stringify(data, null, 2))
};

console.log('Testing getConsolidatedData...');
controller.getConsolidatedData(req, res);
