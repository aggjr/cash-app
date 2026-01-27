// Script para aplicar todas as alterações do frontend automaticamente
const fs = require('fs');
const path = require('path');

console.log('🚀 Aplicando alterações do frontend...\n');

// 1. Update CampanhaWizard.js - Add dispatch interval field in Step 2
const wizardPath = path.join(__dirname, '..', 'src', 'components', 'CampanhaWizard.js');

try {
    let wizardContent = fs.readFileSync(wizardPath, 'utf8');

    // Check if already modified
    if (wizardContent.includes('dispatch-interval')) {
        console.log('✅ Campo de intervalo já existe no Step 2');
    } else {
        // Add dispatch interval field after campaign-end
        const searchPattern = `         <div class="form-group" style="width: 140px;">
             <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Fim <span style="color:red; margin-left:2px;">*</span></label>
             <input type="date" id="campaign-end" class="form-input" value="\${state.config.dataFim}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
         </div>
     \`;`;

        const replacement = `         <div class="form-group" style="width: 140px;">
             <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Fim <span style="color:red; margin-left:2px;">*</span></label>
             <input type="date" id="campaign-end" class="form-input" value="\${state.config.dataFim}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
         </div>
         <div class="form-group" style="width: 140px;">
             <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:4px;">Intervalo (seg) <span style="color:red; margin-left:2px;">*</span></label>
             <input type="number" id="dispatch-interval" class="form-input" value="\${state.config.dispatchIntervalSeconds || 120}" min="30" max="3600" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
         </div>
     \`;`;

        wizardContent = wizardContent.replace(searchPattern, replacement);
        console.log('✅ Campo de intervalo adicionado ao Step 2');
    }

    // 2. Initialize dispatchIntervalSeconds in state
    if (!wizardContent.includes('dispatchIntervalSeconds:')) {
        // Find state initialization
        const statePattern = /const state = \{([^}]+)config: \{([^}]+)\}/;
        const match = wizardContent.match(statePattern);

        if (match) {
            const configContent = match[2];
            if (!configContent.includes('dispatchIntervalSeconds')) {
                const newConfig = configContent.trim() + ',\n                dispatchIntervalSeconds: 120';
                wizardContent = wizardContent.replace(
                    `config: {${configContent}}`,
                    `config: {${newConfig}\n            }`
                );
                console.log('✅ dispatchIntervalSeconds inicializado no state');
            }
        }
    }

    // 3. Add event listener for dispatch interval
    if (!wizardContent.includes('dispatch-interval')) {
        const bindEventsPattern = /const bindFormEvents = \(formDiv\) => \{/;
        const eventListener = `
        // Dispatch interval
        const dispatchIntervalInput = formDiv.querySelector('#dispatch-interval');
        if (dispatchIntervalInput) {
            dispatchIntervalInput.addEventListener('change', (e) => {
                state.config.dispatchIntervalSeconds = parseInt(e.target.value) || 120;
                console.log('Intervalo de disparo atualizado:', state.config.dispatchIntervalSeconds);
            });
        }
`;

        wizardContent = wizardContent.replace(
            bindEventsPattern,
            `const bindFormEvents = (formDiv) => {${eventListener}`
        );
        console.log('✅ Event listener adicionado');
    }

    // 4. Add dispatchIntervalSeconds to payload
    if (!wizardContent.includes('dispatchIntervalSeconds:') || wizardContent.indexOf('dispatchIntervalSeconds:') < wizardContent.indexOf('startExecution')) {
        const payloadPattern = /const payload = \{([^}]+)leadsIds:/;
        const match = wizardContent.match(payloadPattern);

        if (match) {
            const payloadContent = match[1];
            if (!payloadContent.includes('dispatchIntervalSeconds')) {
                wizardContent = wizardContent.replace(
                    'leadsIds:',
                    'dispatchIntervalSeconds: state.config.dispatchIntervalSeconds || 120,\n            leadsIds:'
                );
                console.log('✅ dispatchIntervalSeconds adicionado ao payload');
            }
        }
    }

    fs.writeFileSync(wizardPath, wizardContent, 'utf8');
    console.log('\n✅ CampanhaWizard.js atualizado com sucesso!');

} catch (error) {
    console.error('❌ Erro ao atualizar CampanhaWizard.js:', error.message);
}

console.log('\n🎉 Alterações do frontend aplicadas!');
