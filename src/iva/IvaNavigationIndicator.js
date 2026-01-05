/**
 * ivaNavigationIndicator - Persistent Visual Navigation Guide
 * Shows golden arrows and highlights for IVA-guided navigation
 * Stays visible until user navigates manually or closes IVA
 */

const INDICATOR_COLOR = '#00425F'; // System Primary Blue (Dark Teal)

export const IvaNavigationIndicator = {
    activeIndicators: [],
    isEvaNavigating: false,

    /**
     * Add persistent arrow indicator next to menu item
     */
    addArrowIndicator(element) {
        if (!element) return null;

        // Ensure we target the label for close proximity to text
        // If element is the container (.menu-item), try to find .menu-label
        const target = element.classList.contains('menu-label') ? element : (element.querySelector('.menu-label') || element);

        // Check if already has indicator
        const existing = target.querySelector('.IVA-nav-arrow');
        if (existing) return existing;

        const arrow = document.createElement('span');
        arrow.className = 'IVA-nav-arrow';
        arrow.innerHTML = '⬅'; // Left arrow pointing to text
        arrow.style.cssText = `
            color: ${INDICATOR_COLOR};
            font-size: 1.2rem;
            margin-left: 3px;
            animation: IVA-arrow-pulse-left 1.5s ease-in-out infinite;
            display: inline-block;
            vertical-align: middle;
            font-weight: bold;
            line-height: 1;
        `;

        target.appendChild(arrow);
        this.activeIndicators.push({ element: target, arrow }); // Track using target

        return arrow;
    },

    /**
     * Add golden border to element (persistent)
     */
    addBorderHighlight(element) {
        if (!element) return;

        // Store original styles
        const original = {
            border: element.style.border,
            boxShadow: element.style.boxShadow,
            position: element.style.position,
            zIndex: element.style.zIndex
        };

        element.dataset.ivaOriginalBorder = JSON.stringify(original);

        element.style.position = element.style.position || 'relative';
        element.style.zIndex = '999';
        element.style.border = `3px solid ${INDICATOR_COLOR}`;
        element.style.boxShadow = `0 0 20px ${INDICATOR_COLOR}80, inset 0 0 10px ${INDICATOR_COLOR}40`;
        element.style.animation = 'IVA-border-glow 2s ease-in-out infinite';

        this.activeIndicators.push({ element, type: 'border' });
    },

    /**
     * Mark full navigation path (menu > submenu > screen)
     */
    markNavigationPath(screenId) {
        console.log('[IVA Nav] Marking navigation path for:', screenId);
        this.isEvaNavigating = true;

        // Clear previous indicators first
        this.clearAll();

        setTimeout(() => {
            try {
                // Strategy 1: Find by data-id attribute (matches Sidebar.js)
                let activeItem = document.querySelector(`.menu-item[data-id="${screenId}"]`);

                // Strategy 2: If not found, search by text content
                if (!activeItem) {
                    console.log('[IVA Nav] Searching menu by screen name...');
                    const labels = document.querySelectorAll('.menu-label');
                    for (const label of labels) {
                        const text = label.textContent.trim().toLowerCase();
                        const searchId = screenId.toLowerCase().replace(/-/g, ' ');
                        if (text.includes(searchId) || searchId.includes(text)) {
                            activeItem = label.closest('.menu-item');
                            console.log('[IVA Nav] Found menu item by text:', text);
                            break;
                        }
                    }
                }

                if (activeItem) {
                    console.log('[IVA Nav] Menu item found!', activeItem);

                    // Scroll into view if needed
                    activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Add arrow to menu item (will target label internally)
                    this.addArrowIndicator(activeItem);

                    // Highlight menu item ROW - store original background
                    activeItem.dataset.ivaOriginalBg = activeItem.style.backgroundColor || '';
                    activeItem.style.backgroundColor = `${INDICATOR_COLOR}20`;
                    this.activeIndicators.push({ element: activeItem, type: 'background' });

                    // Find and mark parent items (for submenus)
                    // Structure: .menu-item-wrapper > .submenu > .menu-item-wrapper > .menu-item
                    let parentSubmenu = activeItem.closest('.submenu');
                    while (parentSubmenu) {
                        // The submenu is inside a wrapper. The previous sibling of the submenu in the wrapper is NOT the item.
                        // Wait, Sidebar.js structure: wrapper > menu-item, submenu.
                        // So submenu sibling is menu-item.
                        const parentWrapper = parentSubmenu.closest('.menu-item-wrapper');
                        const parentItem = parentWrapper ? parentWrapper.querySelector('.menu-item') : null;

                        if (parentItem && parentItem !== activeItem) {
                            console.log('[IVA Nav] Found parent menu item:', parentItem.querySelector('.menu-label')?.textContent);
                            this.addArrowIndicator(parentItem);
                            parentItem.dataset.ivaOriginalBg = parentItem.style.backgroundColor || '';
                            parentItem.style.backgroundColor = `${INDICATOR_COLOR}15`;
                            this.activeIndicators.push({ element: parentItem, type: 'background' });
                            // Expand submenu if needed? usually handled by click but we just highlight
                            parentSubmenu.style.display = 'block';
                        }

                        parentSubmenu = parentWrapper ? parentWrapper.parentElement.closest('.submenu') : null;
                    }
                } else {
                    console.warn('[IVA Nav] Menu item not found for:', screenId);
                }

                // Highlight modal or main content area (EXCLUDING FOOTER)
                // Priority: .modal > .settings-panel > content within #main-content
                let targetContainer = document.querySelector('.modal.show, .modal.visible, [role="dialog"]');

                if (!targetContainer) {
                    targetContainer = document.querySelector('.settings-panel');
                }

                // CRITICAL: Search ONLY inside #main-content to avoid highlighting footer
                if (!targetContainer) {
                    const mainContent = document.querySelector('#main-content');
                    if (mainContent) {
                        // Look for content containers INSIDE main-content only
                        targetContainer = mainContent.querySelector('.glass-panel, .card, .panel, .dashboard-container, main > div:first-child');
                    }
                }

                if (targetContainer) {
                    console.log('[IVA Nav] Highlighting container:', targetContainer.className || targetContainer.id);
                    this.addBorderHighlight(targetContainer);
                } else {
                    console.warn('[IVA Nav] No container found to highlight');
                }

            } catch (error) {
                console.error('[IVA Nav] Error marking path:', error);
            }
        }, 800); // Increased wait time for modals to render
    },

    /**
     * Clear all navigation indicators
     */
    clearAll() {
        console.log('[IVA Nav] Clearing all indicators');

        this.activeIndicators.forEach(({ element, arrow, type }) => {
            try {
                // Remove arrows
                if (arrow && arrow.parentNode) {
                    arrow.remove();
                }

                // Restore border highlights
                if (type === 'border' && element.dataset.ivaOriginalBorder) {
                    const original = JSON.parse(element.dataset.ivaOriginalBorder);
                    element.style.border = original.border;
                    element.style.boxShadow = original.boxShadow;
                    element.style.position = original.position;
                    element.style.zIndex = original.zIndex;
                    element.style.animation = '';
                    delete element.dataset.ivaOriginalBorder;
                }

                // Restore background colors
                if (type === 'background' && element.dataset.ivaOriginalBg !== undefined) {
                    element.style.backgroundColor = element.dataset.ivaOriginalBg;
                    delete element.dataset.ivaOriginalBg;
                }

                // Legacy cleanup for any remaining colored backgrounds
                if (element.style.backgroundColor?.includes(INDICATOR_COLOR)) {
                    element.style.backgroundColor = '';
                }
            } catch (error) {
                console.error('[IVA Nav] Error removing indicator:', error);
            }
        });

        this.activeIndicators = [];
        this.isEvaNavigating = false;
    },

    /**
     * Auto-clear when user navigates manually (not via IVA)
     */
    setupManualNavigationDetector() {
        // Clear on manual menu clicks
        document.addEventListener('click', (e) => {
            const isMenuClick = e.target.closest('.menu-item');
            const isEvaClick = e.target.closest('.IVA-chat, #IVA-icon');

            if (isMenuClick && !isEvaClick && this.isEvaNavigating) {
                console.log('[IVA Nav] Manual navigation detected, clearing indicators');
                this.clearAll();
            }
        });

        // Also listen for global navigation events
        // Intercept the navigate function to detect ANY navigation
        if (window.cashApp && window.cashApp.navigate) {
            const originalNavigate = window.cashApp.navigate;
            window.cashApp.navigate = (itemId) => {
                // Clear highlights if navigating away from IVA-guided screen
                if (this.isEvaNavigating) {
                    console.log('[IVA Nav] Screen change detected, clearing indicators');
                    this.clearAll();
                }
                // Call original navigate
                return originalNavigate(itemId);
            };
        }
    },

    /**
     * Initialize indicator system
     */
    init() {
        this.setupManualNavigationDetector();
        console.log('[IVA Nav] Indicator system initialized');
    }
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes IVA-arrow-pulse-left {
        0%, 100% {
            transform: translateX(0);
            opacity: 0.8;
        }
        50% {
            transform: translateX(-5px); /* Move Left towards text */
            opacity: 1;
        }
    }

    @keyframes IVA-border-glow {
        0%, 100% {
            box-shadow: 0 0 20px ${INDICATOR_COLOR}80, inset 0 0 10px ${INDICATOR_COLOR}40;
        }
        50% {
            box-shadow: 0 0 30px ${INDICATOR_COLOR}CC, inset 0 0 15px ${INDICATOR_COLOR}60;
        }
    }

    .IVA-nav-arrow {
        pointer-events: none;
        user-select: none;
    }
`;
document.head.appendChild(style);

// Auto-initialize when module loads
IvaNavigationIndicator.init();



