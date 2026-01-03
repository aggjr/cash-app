import { EvaHighlight } from './EvaHighlight.js';

export const EvaActions = {
    NAVIGATE: 'NAVIGATE',
    EXPLAIN_SCREEN: 'EXPLAIN_SCREEN',
    FILL_FORM: 'FILL_FORM',
    CLICK_ACTION: 'CLICK_ACTION',

    // Convenience methods
    navigate: async (target) => {
        return EvaActions.handle('NAVIGATE', { target });
    },

    // Action Handlers
    handle: async (action, payload) => {
        console.log(`[EVA] Executing action: ${action}`, payload);

        switch (action) {
            case 'NAVIGATE':
                if (window.cashApp && window.cashApp.navigate) {
                    window.cashApp.navigate(payload.target);

                    // Use persistent navigation indicators
                    setTimeout(() => {
                        console.log('[EVA] Starting persistent navigation indicators...');
                        try {
                            // Import and use new indicator system
                            import('./EvaNavigationIndicator.js').then(module => {
                                module.EvaNavigationIndicator.markNavigationPath(payload.target);
                            });
                        } catch (error) {
                            console.error('[EVA] Error showing indicators:', error);
                        }
                    }, 800); // Wait for navigation to complete

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
        console.log('[EVA] Current DOM state:', {
            allTreeNodes: document.querySelectorAll('.tree-node').length,
            allTreeNodeContents: document.querySelectorAll('.tree-node-content').length,
            activeTreeNodes: document.querySelectorAll('.tree-node-content.active').length
        });

        // Step 1: Find the active menu item (submenu) - try multiple selectors
        let activeMenuItem = document.querySelector('.tree-node-content.active');
        if (!activeMenuItem) {
            activeMenuItem = document.querySelector('.menu-item.active');
        }
        if (!activeMenuItem) {
            // Try finding by data-id matching target
            const allNodes = document.querySelectorAll('.tree-node-content');
            for (const node of allNodes) {
                const treeNode = node.closest('.tree-node');
                if (treeNode && treeNode.dataset.id === targetScreen) {
                    activeMenuItem = node;
                    break;
                }
            }
        }

        console.log('[EVA] Active menu item found:', !!activeMenuItem, activeMenuItem);

        // Step 2: Find parent menu if exists (climb up the DOM tree)
        let parentMenu = null;
        if (activeMenuItem) {
            // Look for parent tree node or menu group
            const treeNode = activeMenuItem.closest('.tree-node');
            console.log('[EVA] Active item tree node:', treeNode);

            if (treeNode) {
                // Find the parent node by looking for preceding tree-node at lower indent level
                const currentMargin = parseInt(treeNode.style.marginLeft) || 0;
                console.log('[EVA] Current margin:', currentMargin);

                let currentElement = treeNode.previousElementSibling;

                while (currentElement) {
                    if (currentElement.classList.contains('tree-node')) {
                        const elementMargin = parseInt(currentElement.style.marginLeft) || 0;
                        console.log('[EVA] Checking sibling margin:', elementMargin);

                        if (elementMargin < currentMargin) {
                            parentMenu = currentElement.querySelector('.tree-node-content');
                            console.log('[EVA] Parent menu found!');
                            break;
                        }
                    }
                    currentElement = currentElement.previousElementSibling;
                }
            }
        }

        console.log('[EVA] Parent menu found:', !!parentMenu, parentMenu);

        // Step 3: Find the main content area - try multiple selectors
        let contentArea = document.querySelector('.glass-panel');
        if (!contentArea) {
            contentArea = document.querySelector('.content-area');
        }
        if (!contentArea) {
            contentArea = document.querySelector('main');
        }
        if (!contentArea) {
            // Fallback: find largest div in main content
            const mainContent = document.querySelector('#main-content, .main-content');
            if (mainContent) {
                contentArea = mainContent.querySelector('div');
            }
        }

        console.log('[EVA] Content area found:', !!contentArea, contentArea);

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

        console.log('[EVA] Total elements to highlight:', highlights.length);

        // Apply highlights with slight delays for visual sequence
        highlights.forEach((item, index) => {
            setTimeout(() => {
                console.log(`[EVA] 🌟 Highlighting ${item.label}`, item.element);
                try {
                    EvaHighlight.highlight(item.element, {
                        duration: 3500 - (index * 500), // Decreasing duration
                        pulse: index < 2 // Only pulse menu items, not content area
                    });
                    console.log(`[EVA] ✓ Successfully highlighted ${item.label}`);
                } catch (error) {
                    console.error(`[EVA] ✗ Error highlighting ${item.label}:`, error);
                }
            }, index * 200); // 200ms between each highlight
        });

        return highlights.length;
    }
};
