/**
 * EvaNavigationIndicator - Persistent Visual Navigation Guide
 * Shows golden arrows and highlights for EVA-guided navigation
 * Stays visible until user navigates manually or closes EVA
 */

const INDICATOR_COLOR = '#DAB177'; // System golden color

export const EvaNavigationIndicator = {
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
        const existing = target.querySelector('.eva-nav-arrow');
        if (existing) return existing;

        const arrow = document.createElement('span');
        arrow.className = 'eva-nav-arrow';
        arrow.innerHTML = '⬅'; // Left arrow pointing to text
        arrow.style.cssText = `
            color: ${INDICATOR_COLOR};
            font-size: 1.2rem;
            margin-left: 3px;
            animation: eva-arrow-pulse-left 1.5s ease-in-out infinite;
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

        element.dataset.evaOriginalBorder = JSON.stringify(original);

        element.style.position = element.style.position || 'relative';
        element.style.zIndex = '999';
        element.style.border = `3px solid ${INDICATOR_COLOR}`;
        element.style.boxShadow = `0 0 20px ${INDICATOR_COLOR}80, inset 0 0 10px ${INDICATOR_COLOR}40`;
        element.style.animation = 'eva-border-glow 2s ease-in-out infinite';

        this.activeIndicators.push({ element, type: 'border' });
    },

    /**
     * Mark full navigation path (menu > submenu > screen)
     */
    markNavigationPath(screenId) {
        console.log('[EVA Nav] Marking navigation path for:', screenId);
        this.isEvaNavigating = true;

        // Clear previous indicators first
        this.clearAll();

        setTimeout(() => {
            try {
                // Strategy 1: Find by data-id attribute (matches Sidebar.js)
                let activeItem = document.querySelector(`.menu-item[data-id="${screenId}"]`);

                // Strategy 2: If not found, search by text content
                if (!activeItem) {
                    console.log('[EVA Nav] Searching menu by screen name...');
                    const labels = document.querySelectorAll('.menu-label');
                    for (const label of labels) {
                        const text = label.textContent.trim().toLowerCase();
                        const searchId = screenId.toLowerCase().replace(/-/g, ' ');
                        if (text.includes(searchId) || searchId.includes(text)) {
                            activeItem = label.closest('.menu-item');
                            console.log('[EVA Nav] Found menu item by text:', text);
                            break;
                        }
                    }
                }

                if (activeItem) {
                    console.log('[EVA Nav] Menu item found!', activeItem);

                    // Add arrow to menu item (will target label internally)
                    this.addArrowIndicator(activeItem);

                    // Highlight menu item ROW
                    activeItem.style.backgroundColor = `${INDICATOR_COLOR}20`;

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
                            console.log('[EVA Nav] Found parent menu item:', parentItem.querySelector('.menu-label')?.textContent);
                            this.addArrowIndicator(parentItem);
                            parentItem.style.backgroundColor = `${INDICATOR_COLOR}15`;
                            // Expand submenu if needed? usually handled by click but we just highlight
                            parentSubmenu.style.display = 'block';
                        }

                        parentSubmenu = parentWrapper ? parentWrapper.parentElement.closest('.submenu') : null;
                    }
                } else {
                    console.warn('[EVA Nav] Menu item not found for:', screenId);
                }

                // Highlight modal or main content area (more focused)
                // Priority: .modal > .settings-panel > .content-wrapper > #main-content
                let targetContainer = document.querySelector('.modal.show, .modal.visible, [role="dialog"]');

                if (!targetContainer) {
                    targetContainer = document.querySelector('.settings-panel');
                }

                if (!targetContainer) {
                    // Look for more specific content areas before falling back to main-content
                    targetContainer = document.querySelector('.content-wrapper, .main-panel, .screen-container');
                }

                if (!targetContainer) {
                    // Try to find the actual content box, not the full screen
                    const mainContent = document.querySelector('#main-content');
                    if (mainContent) {
                        // Strategy 1: Look for specific content classes
                        const contentBox = mainContent.querySelector('.glass-panel, .card, .panel, .dashboard-container');

                        // Strategy 2: Look for the first substantial child of <main>
                        const mainSection = mainContent.querySelector('main > div');

                        targetContainer = contentBox || mainSection || mainContent;
                    }
                }

                if (targetContainer) {
                    console.log('[EVA Nav] Highlighting container:', targetContainer.className || targetContainer.id);
                    this.addBorderHighlight(targetContainer);
                } else {
                    console.warn('[EVA Nav] No container found to highlight');
                }

            } catch (error) {
                console.error('[EVA Nav] Error marking path:', error);
            }
        }, 800); // Increased wait time for modals to render
    },

    /**
     * Clear all navigation indicators
     */
    clearAll() {
        console.log('[EVA Nav] Clearing all indicators');

        this.activeIndicators.forEach(({ element, arrow, type }) => {
            try {
                // Remove arrows
                if (arrow && arrow.parentNode) {
                    arrow.remove();
                }

                // Restore border highlights
                if (type === 'border' && element.dataset.evaOriginalBorder) {
                    const original = JSON.parse(element.dataset.evaOriginalBorder);
                    element.style.border = original.border;
                    element.style.boxShadow = original.boxShadow;
                    element.style.position = original.position;
                    element.style.zIndex = original.zIndex;
                    element.style.animation = '';
                    delete element.dataset.evaOriginalBorder;
                }

                // Remove background colors
                if (element.style.backgroundColor?.includes(INDICATOR_COLOR)) {
                    element.style.backgroundColor = '';
                }
            } catch (error) {
                console.error('[EVA Nav] Error removing indicator:', error);
            }
        });

        this.activeIndicators = [];
        this.isEvaNavigating = false;
    },

    /**
     * Auto-clear when user navigates manually (not via EVA)
     */
    setupManualNavigationDetector() {
        // Clear on manual menu clicks
        document.addEventListener('click', (e) => {
            const isMenuClick = e.target.closest('.menu-item');
            const isEvaClick = e.target.closest('.eva-chat, #eva-icon');

            if (isMenuClick && !isEvaClick && this.isEvaNavigating) {
                console.log('[EVA Nav] Manual navigation detected, clearing indicators');
                this.clearAll();
            }
        });
    },

    /**
     * Initialize indicator system
     */
    init() {
        this.setupManualNavigationDetector();
        console.log('[EVA Nav] Indicator system initialized');
    }
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes eva-arrow-pulse-left {
        0%, 100% {
            transform: translateX(0);
            opacity: 0.8;
        }
        50% {
            transform: translateX(-5px); /* Move Left towards text */
            opacity: 1;
        }
    }

    @keyframes eva-border-glow {
        0%, 100% {
            box-shadow: 0 0 20px ${INDICATOR_COLOR}80, inset 0 0 10px ${INDICATOR_COLOR}40;
        }
        50% {
            box-shadow: 0 0 30px ${INDICATOR_COLOR}CC, inset 0 0 15px ${INDICATOR_COLOR}60;
        }
    }

    .eva-nav-arrow {
        pointer-events: none;
        user-select: none;
    }
`;
document.head.appendChild(style);

// Auto-initialize when module loads
EvaNavigationIndicator.init();
