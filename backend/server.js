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
const projectsRoutes = require('./routes/projects');
const producaoRevendaRoutes = require('./routes/producaoRevenda');
const extratoRoutes = require('./routes/extrato');
const fechamentoRoutes = require('./routes/fechamento');
const consolidadasRoutes = require('./routes/consolidadas');
const debugRoutes = require('./routes/debug');
const settingsRoutes = require('./routes/settings');
const userManagementRoutes = require('./routes/userManagement');
const marketingRoutes = require('./routes/marketing');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// GLOBAL REQUEST LOGGER
const fileLogger = require('./utils/fileLogger');
app.use((req, res, next) => {
    fileLogger.log(`Incoming Request: ${req.method} ${req.url}`);
    next();
});

// API Router
const apiRouter = express.Router();

// Force UTF-8 encoding for API responses only
apiRouter.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/accounts', accountsRoutes);
apiRouter.use('/companies', companiesRoutes);
apiRouter.use('/incomes', incomesRoutes);
apiRouter.use('/saidas', saidasRoutes);
apiRouter.use('/users', userManagementRoutes); // New global user mgt
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

apiRouter.use('/tts', ttsRoutes); // Google Cloud TTS
apiRouter.use('/user-preferences', require('./routes/userPreferences'));
apiRouter.use('/marketing', marketingRoutes); // Marketing module
apiRouter.use('/integration', require('./routes/integration')); // External integrations (WhatsApp)
apiRouter.use('/migration', require('./routes/migration')); // TEMPORARY: Auto-migration endpoint

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


const migrateInstallmentColumns = require('./migrate_add_installment_columns');
const migrateSystemSettings = require('./migrate_add_system_settings');
const migrateCreateAuditLogs = require('./migrate-create-audit-logs');
const migrateLoans = require('./migrate_loans');
const migratePreferredName = require('./migrate_add_preferred_name');

const migrateAuditLogUndo = require('./migrate_audit_log_undo');
const migrateAccountCompanyRequired = require('./migrate_account_company_required');
const migrateRemoveAccountType = require('./migrate_remove_account_type');
const migrateAddUserCompany = require('./migrate_add_user_company');
const migrateMarketingTables = require('./migrations/create_marketing_tables');


loadErrorCatalog()
    .then(() => migrateFixAccounts())
    .then(async () => {
        await migratePaymentColumns();

        await migrateAddComprovante();

        await migrateInstallmentFields();


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
    .then(() => migratePreferredName())
    // .then(() => migrateAddUserRoles()) // NEW: User Roles (Job Title/Dept) - MISSING IMPORT
    // .then(() => migrateAddScreenFamiliarity()) // NEW: Screen familiarity tracking - MISSING IMPORT
    .then(() => migrateAuditLogUndo()) // NEW: Audit log undo capability
    .then(() => migrateAccountCompanyRequired()) // NEW: Enforce company_id NOT NULL
    .then(() => migrateRemoveAccountType()) // NEW: Remove account_type column
    .then(() => migrateAddUserCompany()) // NEW: Add company_id to project_users
    .then(() => require('./migrate_add_user_preferences')()) // NEW: User preferences table
    .then(() => migrateMarketingTables()) // NEW: Marketing module tables
    .then(() => require('./migrations/update_leads_multirelations')()) // NEW: Multi-groups and characteristics support
    .then(() => require('./migrations/create_caracteristica_values')()) // NEW: Characteristic values support
    .then(() => require('./migrations/update_leads_chars_values')()) // NEW: Lead characteristic selected values
    .then(() => require('./migrate_add_campaign_messages')()) // NEW: Campaign Message columns
    .then(() => startServer())

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

