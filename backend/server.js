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
const saidasRoutes = require('./routes/saidas');
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

// API Router
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/accounts', accountsRoutes);
apiRouter.use('/companies', companiesRoutes);
apiRouter.use('/incomes', incomesRoutes);
apiRouter.use('/saidas', saidasRoutes);
apiRouter.use('/aportes', aportesRoutes);
apiRouter.use('/retiradas', retiradasRoutes);
apiRouter.use('/transferencias', transferenciasRoutes);
apiRouter.use('/projects', projectsRoutes);
apiRouter.use('/producao-revenda', producaoRevendaRoutes);
apiRouter.use('/extrato', extratoRoutes);
apiRouter.use('/fechamento', fechamentoRoutes);
apiRouter.use('/consolidadas', consolidadasRoutes);
apiRouter.use('/previsao', require('./routes/previsao'));

// Generic Tree Routes (Protected)
apiRouter.get('/:tableName', auth, genericTreeController.getAll);
apiRouter.post('/:tableName', auth, genericTreeController.create);
apiRouter.put('/:tableName/:id', auth, genericTreeController.update);
apiRouter.delete('/:tableName/:id', auth, genericTreeController.delete);
apiRouter.post('/:tableName/:id/move', auth, genericTreeController.move);

// Mount API routes
app.use('/api', apiRouter);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use(errorHandler);

// Serve Static Frontend (for deployment)
const path = require('path');
// Serve static files from the 'dist' directory (Vite build output)
app.use(express.static(path.join(__dirname, '../dist')));

// SPA Fallback - must be after API routes
app.get('*', (req, res) => {
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
