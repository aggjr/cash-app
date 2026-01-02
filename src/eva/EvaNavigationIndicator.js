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

        // Check if already has indicator
        const existing = element.querySelector('.eva-nav-arrow');
        if (existing) return existing;

        const arrow = document.createElement('span');
        arrow.className = 'eva-nav-arrow';
        arrow.innerHTML = '➜';
        arrow.style.cssText = `
            color: ${INDICATOR_COLOR};
            font-size: 1.5rem;
            margin-left: 0.5rem;
            animation: eva-arrow-pulse 1.5s ease-in-out infinite;
            display: inline-block;
            vertical-align: middle;
        `;

        element.appendChild(arrow);
        this.activeIndicators.push({ element, arrow });

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
                // Find the active menu item
                const activeItem = document.querySelector(`[data-item-id="${screenId}"]`);
                if (activeItem) {
                    // Add arrow to menu item
                    this.addArrowIndicator(activeItem);

                    // Highlight menu item
                    activeItem.style.backgroundColor = `${INDICATOR_COLOR}20`;

                    // Find and mark parent items (for submenus)
                    let parent = activeItem.closest('.tree-node');
                    while (parent) {
                        const parentLabel = parent.querySelector('.tree-node-label');
                        if (parentLabel) {
                            this.addArrowIndicator(parentLabel);
                            parentLabel.style.backgroundColor = `${INDICATOR_COLOR}15`;
                        }
                        parent = parent.parentElement?.closest('.tree-node');
                    }
                }

                // Highlight the main content area
                const mainContent = document.querySelector('#main-content');
                if (mainContent) {
                    this.addBorderHighlight(mainContent);
                }

                // Highlight the screen header
                const screenHeader = document.querySelector('.screen-title, h2, h1');
                if (screenHeader && screenHeader.offsetParent) {
                    this.addArrowIndicator(screenHeader.parentElement || screenHeader);
                }

            } catch (error) {
                console.error('[EVA Nav] Error marking path:', error);
            }
        }, 500); // Wait for navigation to complete
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
            const isMenuClick = e.target.closest('.tree-node-label');
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
    @keyframes eva-arrow-pulse {
        0%, 100% {
            transform: translateX(0);
            opacity: 0.8;
        }
        50% {
            transform: translateX(5px);
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
