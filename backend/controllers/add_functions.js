// Script para adicionar funções faltantes ao campanhasController.js
const fs = require('fs');
const path = require('path');

const controllerPath = path.join(__dirname, 'campanhasController.js');

const functionsToAdd = `

// Get dispatch details for a campaign (for real-time monitoring)
exports.getDispatchDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const [leads] = await db.query(\`
            SELECT 
                l.id,
                l.nome,
                l.email,
                l.telefone,
                lc.status_email,
                lc.status_whatsapp
            FROM leads l
            INNER JOIN leads_campanhas lc ON l.id = lc.lead_id
            WHERE lc.campanha_id = ?
            ORDER BY l.nome
        \`, [id]);

        res.json(leads);
    } catch (error) {
        console.error('Erro ao buscar detalhes de disparo:', error);
        res.status(500).json({ error: 'Erro ao buscar detalhes de disparo' });
    }
};

// Apply campaign redesign migration
exports.applyRedesignMigration = async (req, res) => {
    try {
        const { applyRedesignMigration } = require('../migrations/campaign_redesign_migration');
        console.log('🔧 Executando migração do redesign via endpoint...');
        const results = await applyRedesignMigration();
        
        if (results.success) {
            res.json({
                success: true,
                message: 'Migração aplicada com sucesso!',
                steps: results.steps,
                errors: results.errors
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Migração falhou',
                steps: results.steps,
                errors: results.errors
            });
        }
    } catch (error) {
        console.error('Erro ao executar migração:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao executar migração',
            error: error.message
        });
    }
};
`;

try {
    // Read current content
    let content = fs.readFileSync(controllerPath, 'utf8');

    // Check if functions already exist
    if (content.includes('exports.getDispatchDetails')) {
        console.log('✅ Função getDispatchDetails já existe');
    } else {
        // Append functions at the end
        content += functionsToAdd;
        fs.writeFileSync(controllerPath, content, 'utf8');
        console.log('✅ Funções adicionadas ao campanhasController.js');
    }
} catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
}
