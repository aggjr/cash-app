// Script para adicionar rotas faltantes ao marketing.js
const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, 'marketing.js');

const routesToAdd = `
// Detalhes de disparo (para monitoramento em tempo real)
router.get('/campanhas/:id/dispatch-details', campanhasController.getDispatchDetails);

// Aplicar migração do redesign
router.post('/campanhas/apply-redesign-migration', campanhasController.applyRedesignMigration);

`;

try {
    // Read current content
    let content = fs.readFileSync(routesPath, 'utf8');

    // Check if routes already exist
    if (content.includes('dispatch-details')) {
        console.log('✅ Rota dispatch-details já existe');
    } else {
        // Insert before module.exports
        content = content.replace(
            'module.exports = router;',
            routesToAdd + 'module.exports = router;'
        );
        fs.writeFileSync(routesPath, content, 'utf8');
        console.log('✅ Rotas adicionadas ao marketing.js');
    }
} catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
}
