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
const debugRoutes = require('./routes/debug');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// GLOBAL REQUEST LOGGER
const fileLogger = require('./utils/fileLogger');
app.use((req, res, next) => {
    fileLogger.log(`Incoming Request: ${req.method} ${req.url}`);
    next();
});

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
apiRouter.use('/upload', require('./routes/upload'));
apiRouter.use('/debug', debugRoutes);

// Static Uploads Serving
// Static Uploads Serving
const path = require('path');
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

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

// API Root response (for health checks on /)
app.get('/', (req, res) => {
    res.json({
        service: 'CASH Backend API',
        status: 'running',
        timestamp: new Date()
    });
});

// 404 for unknown routes (instead of SPA fallback)
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Start server
const migrateFixAccounts = require('./migrate-fix-accounts');
const migratePaymentColumns = require('./add_payment_cols_all');
const migrateDataPrevistaAtraso = require('./migrate-add-data-prevista-atraso');
const migrateComprovanteUrl = require('./migrate-add-comprovante-url');

loadErrorCatalog()
    .then(() => migrateFixAccounts())
    .then(() => migratePaymentColumns())
    .then(() => migrateDataPrevistaAtraso())
    .then(() => migrateComprovanteUrl())
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n========================================`);
            console.log(`🚀 CASH Backend API Server`);
            console.log(`========================================`);
            console.log(`⏰ Started at: ${new Date().toISOString()}`);
            console.log(`🌍 Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
            console.log(`📡 Server running on: http://localhost:${PORT}`);
            console.log(`🏥 Health check: http://localhost:${PORT}/health`);
            console.log(`📊 API endpoint: http://localhost:${PORT}/api/tipo-entrada`);
            console.log(`========================================\n`);
        });
    });

module.exports = app;
