const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const genericTreeController = require('./controllers/genericTreeController');
const auth = require('./middleware/auth');
const { errorHandler, loadErrorCatalog } = require('./middleware/errorMiddleware');

const incomesRoutes = require('./routes/incomes');
const accountsRoutes = require('./routes/accounts');
const companiesRoutes = require('./routes/companies');
const despesasRoutes = require('./routes/despesas');
const aportesRoutes = require('./routes/aportes');
const retiradasRoutes = require('./routes/retiradas');
const transferenciasRoutes = require('./routes/transferencias');
const projectsRoutes = require('./routes/users');
const producaoRevendaRoutes = require('./routes/producaoRevenda');
const extratoRoutes = require('./routes/extrato');
const fechamentoRoutes = require('./routes/fechamento');
const consolidadasRoutes = require('./routes/consolidadas');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/incomes', incomesRoutes);
app.use('/api/despesas', despesasRoutes);
app.use('/api/aportes', aportesRoutes);
app.use('/api/retiradas', retiradasRoutes);
app.use('/api/transferencias', transferenciasRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/producao-revenda', producaoRevendaRoutes);
app.use('/api/extrato', extratoRoutes);
app.use('/api/fechamento', fechamentoRoutes);
app.use('/api/consolidadas', consolidadasRoutes);
app.use('/api/previsao', require('./routes/previsao'));

// Generic Tree Routes (Protected)
// We need to validate tableName to prevent SQL injection, which the controller does.
app.get('/api/:tableName', auth, genericTreeController.getAll);
app.post('/api/:tableName', auth, genericTreeController.create);
app.put('/api/:tableName/:id', auth, genericTreeController.update);
app.delete('/api/:tableName/:id', auth, genericTreeController.delete);
app.post('/api/:tableName/:id/move', auth, genericTreeController.move);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
// Error handling middleware
app.use(errorHandler);

// Serve Static Frontend (for deployment)
const path = require('path');
// Serve static files from the 'dist' directory (Vite build output)
app.use('/projects/cash', express.static(path.join(__dirname, '../dist')));

// SPA Fallback for /projects/cash routes
app.get('/projects/cash/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start server
loadErrorCatalog().then(() => {
    app.listen(PORT, () => {
        console.log(`\n========================================`);
        console.log(`🚀 CASH Backend API Server`);
        console.log(`========================================`);
        console.log(`📡 Server running on: http://localhost:${PORT}`);
        console.log(`🏥 Health check: http://localhost:${PORT}/health`);
        console.log(`📊 API endpoint: http://localhost:${PORT}/api/tipo-entrada`);
        console.log(`========================================\n`);
    });
});

module.exports = app;
