import { EvaHighlight } from './EvaHighlight.js';

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

                    // Highlight the full navigation path after navigation completes
                    setTimeout(() => {
                        EvaActions.highlightNavigationPath(payload.target);
                    }, 500); // Wait for navigation to complete

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
                        // Highlight the field before filling
                        EvaHighlight.highlight(element, { duration: 2000 });

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
                if (!payload.selector) return { success: false, message: 'Nenhum seletor fornecido.' };

                const elements = document.querySelectorAll(payload.selector);

                if (elements.length > 0) {
                    // Try each element until one succeeds
                    for (const btn of elements) {
                        if (btn && btn.offsetParent !== null) { // Check if visible
                            // Highlight the button before clicking
                            EvaHighlight.highlight(btn, { duration: 1500 });

                            // Click after brief delay
                            setTimeout(() => btn.click(), 300);
                            return { success: true, message: 'Cliquei no botão.' };
                        }
                    }
                }

                return { success: false, message: 'Botão não encontrado ou não visível.' };

            default:
                console.warn(`[EVA] Unknown action: ${action}`);
                return { success: false, message: `Ação desconhecida: ${action}` };
        }
    },

    /**
     * Highlight the complete navigation path (parent menu → submenu → screen area)
     * This helps users understand where they are in the system hierarchy
     */
    highlightNavigationPath(targetScreen) {
        console.log('[EVA] Highlighting navigation path for:', targetScreen);

        // Step 1: Find the active menu item (submenu)
        const activeMenuItem = document.querySelector('.tree-node-content.active, .menu-item.active');

        // Step 2: Find parent menu if exists (climb up the DOM tree)
        let parentMenu = null;
        if (activeMenuItem) {
            // Look for parent tree node or menu group
            const treeNode = activeMenuItem.closest('.tree-node');
            if (treeNode) {
                // Find the parent node by looking for preceding tree-node at lower indent level
                const currentMargin = parseInt(treeNode.style.marginLeft) || 0;
                let currentElement = treeNode.previousElementSibling;

                while (currentElement) {
                    if (currentElement.classList.contains('tree-node')) {
                        const elementMargin = parseInt(currentElement.style.marginLeft) || 0;
                        if (elementMargin < currentMargin) {
                            parentMenu = currentElement.querySelector('.tree-node-content');
                            break;
                        }
                    }
                    currentElement = currentElement.previousElementSibling;
                }
            }
        }

        // Step 3: Find the main content area
        const contentArea = document.querySelector('.glass-panel, .content-area, main');

        // Step 4: Highlight in sequence (top-down hierarchy)
        const highlights = [];

        if (parentMenu) {
            highlights.push({ element: parentMenu, label: 'Menu Principal' });
        }

        if (activeMenuItem) {
            highlights.push({ element: activeMenuItem, label: 'Submenu' });
        }

        if (contentArea) {
            highlights.push({ element: contentArea, label: 'Tela' });
        }

        // Apply highlights with slight delays for visual sequence
        highlights.forEach((item, index) => {
            setTimeout(() => {
                console.log(`[EVA] Highlighting ${item.label}`, item.element);
                EvaHighlight.highlight(item.element, {
                    duration: 3500 - (index * 500), // Decreasing duration
                    pulse: index < 2 // Only pulse menu items, not content area
                });
            }, index * 200); // 200ms between each highlight
        });

        return highlights.length;
    }
};
