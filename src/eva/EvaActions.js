export const EvaActions = {
    NAVIGATE: 'NAVIGATE',
    EXPLAIN_SCREEN: 'EXPLAIN_SCREEN',
    FILL_FORM: 'FILL_FORM',
    CLICK_ACTION: 'CLICK_ACTION',

    // Action Handlers
    handle: async (action, payload) => {
        console.log(`[EVA] Executing action: ${action}`, payload);

        switch (action) {
            case 'NAVIGATE':
                if (window.cashApp && window.cashApp.navigate) {
                    window.cashApp.navigate(payload.target);
                    return { success: true, message: `Navegando para ${payload.target}` };
                }
                return { success: false, message: 'Sistema de navegação não disponível' };

            case 'EXPLAIN_SCREEN':
                // Will be implemented later
                return { success: true, message: 'Explaining screen...' };

            case 'FILL_FORM':
                // payload: { fields: { 'income-valor': '100', ... } }
                if (!payload.fields) return { success: false, message: 'Nenhum dado para preencher.' };

                let filledCount = 0;
                let missingFields = [];

                for (const [fieldId, value] of Object.entries(payload.fields)) {
                    // Try to find the element by ID
                    const element = document.getElementById(fieldId);

                    if (element) {
                        // Handle different input types
                        if (element.tagName === 'SELECT') {
                            element.value = value;
                        } else {
                            element.value = value;
                        }

                        // Dispatch events to satisfy frameworks/listeners
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        // Special case for our currency inputs requiring blur to format
                        element.dispatchEvent(new Event('blur', { bubbles: true }));

                        filledCount++;
                    } else {
                        missingFields.push(fieldId);
                    }
                }

                if (filledCount > 0) {
                    return {
                        success: true,
                        message: `Preenchi ${filledCount} campo(s).`,
                        missing: missingFields
                    };
                }
                return { success: false, message: 'Não encontrei os campos solicitados na tela.' };

            case 'CLICK_ACTION':
                // payload: { selector: '#btn-save' }
                const btn = document.querySelector(payload.selector);
                if (btn) {
                    btn.click();
                    return { success: true, message: 'Clique realizado com sucesso.' };
                }
                return { success: false, message: 'Botão/Ação não encontrado na tela.' };

            default:
                console.warn(`[EVA] Unknown action: ${action}`);
                return { success: false, message: `Ação desconhecida: ${action}` };
        }
    }
};
