const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const genericTreeController = require('./controllers/genericTreeController');
const auth = require('./middleware/auth');
const ttsRoutes = require('./routes/tts');  // Google Cloud TTS
const { errorHandler, loadErrorCatalog } = require('./middleware/errorMiddleware');

const incomesRoutes = require('./routes/incomes');
const accountsRoutes = require('./routes/accounts');
const companiesRoutes = require('./routes/companies');
const saidasRoutes = require('./routes/saidas');
const aportesRoutes = require('./routes/aportes');
const auditRoutes = require('./routes/auditLogs');
const retiradasRoutes = require('./routes/retiradas');
const transferenciasRoutes = require('./routes/transferencias');
const projectsRoutes = require('./routes/users');
const producaoRevendaRoutes = require('./routes/producaoRevenda');
const extratoRoutes = require('./routes/extrato');
const fechamentoRoutes = require('./routes/fechamento');
const consolidadasRoutes = require('./routes/consolidadas');
const debugRoutes = require('./routes/debug');
const settingsRoutes = require('./routes/settings');

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
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/audit-logs', auditRoutes);
apiRouter.use('/loans', require('./routes/loans'));
apiRouter.use('/eva', require('./routes/eva'));
apiRouter.use('/tts', ttsRoutes); // Google Cloud TTS

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
// API Root response moved to /health or handled by static files
// app.get('/', ...) check removed to allow frontend serving

// Serve static files from the React frontend app
const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));

// Handle SPA fallback
app.get('*', (req, res, next) => {
    // Skip API routes to let them 404 if not found
    if (req.url.startsWith('/api')) {
        return next();
    }
    const indexFile = path.join(frontendPath, 'index.html');
    res.sendFile(indexFile, (err) => {
        if (err) {
            res.status(404).json({ error: 'Frontend not found or 404' });
        }
    });
});

// 404 for unknown API routes
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Start server
const migrateFixAccounts = require('./migrate-fix-accounts');
const migratePaymentColumns = require('./add_payment_cols_all');
const migrateDataPrevistaAtraso = require('./migrate-add-data-prevista-atraso');
const migrateComprovanteUrl = require('./migrate-add-comprovante-url');
const migrateTransferenciaComprovante = require('./migrate_add_comprovante_transferencias');
const migrateFixTransferenciaNulls = require('./migrate_fix_transferencia_nulls');
// const migrateAddPaymentColumns = require('./migrate-add-payment-columns'); // File doesn't exist
const migrateAddComprovante = require('./migrate-add-comprovante-url');
const migrateInstallmentFields = require('./migrate_add_installment_fields');
const migrateAddEvaTimeout = require('./migrate_add_eva_timeout');
const migrateAddEvaVoiceSettings = require('./migrate_add_eva_voice_settings');
const migrateVoiceSettingsToBoolean = require('./migrate_voice_settings_to_boolean');
const migrateVoiceTierSystem = require('./migrate_voice_tier_system');
const migrateVoicePremiumDefault = require('./migrate_voice_premium_default');
const migrateInstallmentColumns = require('./migrate_add_installment_columns');
const migrateSystemSettings = require('./migrate_add_system_settings');
const migrateCreateAuditLogs = require('./migrate-create-audit-logs');
const migrateLoans = require('./migrate_loans');
const migratePreferredName = require('./migrate_preferred_name');
const migrateAddEvaContext = require('./migrate_add_eva_context');
const migrateEvaPreferences = require('./migrate-eva-user-preferences');
const migrateEvaVoiceRate = require('./migrate_add_eva_voice_rate');
const migrateAddGenderColumn = require('./migrate_add_gender_column');
const migrateFixVoiceRate = require('./migrate_fix_voice_rate');
const migrateSetEvaRate75 = require('./migrate_set_eva_rate_75.js');


loadErrorCatalog()
    .then(() => migrateFixAccounts())
    .then(async () => {
        await migratePaymentColumns();

        await migrateAddComprovante();

        await migrateInstallmentFields();

        await migrateAddEvaTimeout();

        await migrateAddEvaVoiceSettings();
        await migrateVoiceSettingsToBoolean(); // Convert to boolean
        await migrateVoiceTierSystem(); // Upgrade to 3-tier system (0/1/2)
        await migrateVoicePremiumDefault(); // Set Premium as default
        await migrateAddGenderColumn(); // Add gender column for LLM detection
        return migrateDataPrevistaAtraso(); // Continue the chain
    })
    .then(() => migrateComprovanteUrl())
    .then(() => migrateTransferenciaComprovante())
    .then(() => migrateFixTransferenciaNulls())
    .then(() => migrateInstallmentColumns())
    .then(() => migrateSystemSettings())
    .then(() => migrateCreateAuditLogs())
    .then(() => migrateLoans())
    .then(() => migratePreferredName())
    .then(() => migrateAddEvaContext()) // NEW: 3-Level Context Architecture
    .then(() => migrateEvaPreferences())
    .then(() => migrateEvaVoiceRate())
    .then(() => migrateFixVoiceRate()) // NEW: Force reset of high voice rates to 50
    .then(() => migrateSetEvaRate75()) // Update default to 75
    .then(() => {
        startServer();
    })
    .catch(err => {
        console.error('CRITICAL: Startup migration failed:', err);
        console.error('Starting server in DEGRADED mode (DB issues likely present)');
        startServer();
    });

// startServer();

function startServer() {
    // Prevent double start if multiple paths somehow triggered
    if (app.serverInstance) return;

    app.serverInstance = app.listen(PORT, '0.0.0.0', () => {
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
}

module.exports = app;
