#!/usr/bin/env node

/**
 * Script para aplicar TODAS as alterações do redesign de campanhas
 * Executa: node apply_all_changes.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Aplicando TODAS as alterações do redesign de campanhas...\n');

let successCount = 0;
let errorCount = 0;

// 1. Apply backend functions
console.log('📦 BACKEND');
console.log('─'.repeat(50));

try {
    execSync('node backend/controllers/add_functions.js', { stdio: 'inherit' });
    successCount++;
} catch (error) {
    console.error('❌ Erro ao adicionar funções ao controller');
    errorCount++;
}

try {
    execSync('node backend/routes/add_routes.js', { stdio: 'inherit' });
    successCount++;
} catch (error) {
    console.error('❌ Erro ao adicionar rotas');
    errorCount++;
}

console.log('');

// 2. Apply frontend changes to CampanhaWizard.js
console.log('🎨 FRONTEND - CampanhaWizard.js');
console.log('─'.repeat(50));

const wizardPath = path.join(__dirname, 'src', 'components', 'CampanhaWizard.js');

try {
    let content = fs.readFileSync(wizardPath, 'utf8');
    let modified = false;

    // Add dispatch interval field
    if (!content.includes('id="dispatch-interval"')) {
        content = content.replace(
            /(<input type="date" id="campaign-end"[^>]+>[\s\S]*?<\/div>[\s\S]*?`);/,
            `$&
         <div class="form-group" style="width: 140px;">
             <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Intervalo (seg) <span style="color:red; margin-left:2px;">*</span></label>
             <input type="number" id="dispatch-interval" class="form-input" value="\${state.config.dispatchIntervalSeconds || 120}" min="30" max="3600" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
         </div>
     \`;`
        );
        console.log('✅ Campo de intervalo adicionado');
        modified = true;
    } else {
        console.log('ℹ️  Campo de intervalo já existe');
    }

    // Add to state initialization
    if (!content.includes('dispatchIntervalSeconds:')) {
        content = content.replace(
            /(config:\s*\{[^}]*)(}\s*,)/,
            '$1,\n                dispatchIntervalSeconds: 120\n            $2'
        );
        console.log('✅ State inicializado');
        modified = true;
    } else {
        console.log('ℹ️  State já inicializado');
    }

    // Add event listener
    if (!content.includes("querySelector('#dispatch-interval')")) {
        content = content.replace(
            /(const bindFormEvents = \(formDiv\) => \{)/,
            `$1
        // Dispatch interval
        const dispatchIntervalInput = formDiv.querySelector('#dispatch-interval');
        if (dispatchIntervalInput) {
            dispatchIntervalInput.addEventListener('change', (e) => {
                state.config.dispatchIntervalSeconds = parseInt(e.target.value) || 120;
            });
        }
`
        );
        console.log('✅ Event listener adicionado');
        modified = true;
    } else {
        console.log('ℹ️  Event listener já existe');
    }

    // Add to payload
    const payloadRegex = /const payload = \{[^}]*leadsIds:/;
    if (payloadRegex.test(content) && !content.match(/dispatchIntervalSeconds:[^,]*,[\s\S]*?leadsIds:/)) {
        content = content.replace(
            /leadsIds:/,
            'dispatchIntervalSeconds: state.config.dispatchIntervalSeconds || 120,\n            leadsIds:'
        );
        console.log('✅ Payload atualizado');
        modified = true;
    } else {
        console.log('ℹ️  Payload já atualizado');
    }

    if (modified) {
        fs.writeFileSync(wizardPath, content, 'utf8');
        console.log('✅ CampanhaWizard.js atualizado');
        successCount++;
    } else {
        console.log('ℹ️  Nenhuma alteração necessária');
        successCount++;
    }
} catch (error) {
    console.error('❌ Erro ao atualizar CampanhaWizard.js:', error.message);
    errorCount++;
}

console.log('');
console.log('═'.repeat(50));
console.log(`✅ Sucesso: ${successCount} | ❌ Erros: ${errorCount}`);
console.log('═'.repeat(50));

if (errorCount === 0) {
    console.log('\n🎉 Todas as alterações foram aplicadas com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Acesse a tela de Campanhas');
    console.log('2. Clique no botão "🔧 Aplicar Migração"');
    console.log('3. Confirme a execução da migração do banco de dados');
    console.log('4. Teste criando uma nova campanha');
} else {
    console.log('\n⚠️  Algumas alterações falharam. Verifique os erros acima.');
    process.exit(1);
}
