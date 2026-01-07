/**
 * IVA Highlighter
 * Visual guidance system - highlights UI elements with step numbers and tooltips
 * Used for GUIDE action to teach users how to perform tasks
 */

export const IvaHighlighter = {
    activeHighlights: [],
    stylesInitialized: false,

    /**
     * Initialize CSS styles for highlights
     */
    initStyles() {
        if (this.stylesInitialized) return;

        const style = document.createElement('style');
        style.id = 'IVA-highlighter-styles';
        style.textContent = `
/* Pulse animation */
@keyframes IVA-pulse {
    0%, 100% {
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
    }
    50% {
        box-shadow: 0 0 0 15px rgba(76, 175, 80, 0);
    }
}

/* Fade in animation */
@keyframes IVA-fade-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
}

/* Highlight overlay */
.IVA-highlight-overlay {
    position: absolute;
    border: 3px solid #4CAF50;
    border-radius: 8px;
    pointer-events: none;
    z-index: 9998;
    animation: IVA-pulse 2s infinite, IVA-fade-in 0.3s ease;
    box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
}

/* Step badge */
.IVA-step-badge {
    position: absolute;
    top: -12px;
    left: -12px;
    width: 28px;
    height: 28px;
    background: #4CAF50;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 9999;
}

/* Tooltip */
.IVA-tooltip {
    position: absolute;
    background: #333;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    max-width: 250px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: IVA-fade-in 0.3s ease;
}

.IVA-tooltip::before {
    content: '';
    position: absolute;
    top: -6px;
    left: 20px;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid #333;
}
        `;
        document.head.appendChild(style);
        this.stylesInitialized = true;
    },

    /**
     * Highlight multiple elements with step numbers
     */
    highlightSteps(highlights) {
        console.log('[IvaHighlighter] Highlighting', highlights.length, 'steps');
        this.initStyles();
        this.clearAll();

        highlights.forEach((highlight, index) => {
            const element = document.querySelector(highlight.selector);
            if (!element) {
                console.warn('[IvaHighlighter] Element not found:', highlight.selector);
                return;
            }

            const rect = element.getBoundingClientRect();
            const overlay = this.createOverlay(rect, index + 1, highlight.tooltip);
            document.body.appendChild(overlay);
            this.activeHighlights.push(overlay);
        });
    },

    /**
     * Create highlight overlay
     */
    createOverlay(rect, stepNumber, tooltip) {
        const overlay = document.createElement('div');
        overlay.className = 'IVA-highlight-overlay';
        overlay.style.top = `${rect.top + window.scrollY}px`;
        overlay.style.left = `${rect.left + window.scrollX}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;

        // Step badge
        const badge = document.createElement('div');
        badge.className = 'IVA-step-badge';
        badge.textContent = stepNumber;
        overlay.appendChild(badge);

        // Tooltip
        if (tooltip) {
            const tooltipEl = document.createElement('div');
            tooltipEl.className = 'IVA-tooltip';
            tooltipEl.textContent = tooltip;
            tooltipEl.style.top = `${rect.height + 10}px`;
            tooltipEl.style.left = '0';
            overlay.appendChild(tooltipEl);
        }

        return overlay;
    },

    /**
     * Clear all active highlights
     */
    clearAll() {
        console.log('[IvaHighlighter] Clearing', this.activeHighlights.length, 'highlights');

        this.activeHighlights.forEach(overlay => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });

        this.activeHighlights = [];
    }
};

// Expose globally
window.IvaHighlighter = IvaHighlighter;

export default IvaHighlighter;
