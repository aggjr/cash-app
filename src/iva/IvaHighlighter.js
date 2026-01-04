/**
 * IVA Highlighter
 * Visual guidance system - highlights UI elements with step numbers and tooltips
 * Used for GUIDE action to teach users how to perform tasks
 */

class ivaHighlighter {
    static activeHighlights = [];
    static stylesInitialized = false;

    /**
     * Initialize CSS styles for highlights
     */
    static initStyles() {
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
                animation: IVA-fade-in 0.3s ease-out, IVA-pulse 2s infinite;
                transition: all 0.3s ease;
            }

            /* Step badge */
            .IVA-step-badge {
                font-family: var(--font-main, sans-serif);
                animation: IVA-fade-in 0.5s ease-out;
            }

            /* Tooltip */
            .IVA-tooltip {
                font-family: var(--font-main, sans-serif);
                line-height: 1.5;
                animation: IVA-fade-in 0.4s ease-out 0.2s both;
            }

            .IVA-tooltip strong {
                display: block;
                margin-bottom: 4px;
                font-size: 15px;
            }

            /* Arrow for tooltip */
            .IVA-tooltip::before {
                content: '';
                position: absolute;
                top: -8px;
                left: 20px;
                width: 0;
                height: 0;
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-bottom: 8px solid #333;
            }
        `;
        document.head.appendChild(style);
        this.stylesInitialized = true;
    }

    /**
     * Highlight multiple elements with step-by-step guidance
     * @param {Array} highlights - Array of highlight objects
     */
    static highlightElements(highlights) {
        // Initialize styles if needed
        this.initStyles();

        // Clear any previous highlights
        this.clearAll();

        if (!highlights || highlights.length === 0) {
            console.warn('[ivaHighlighter] No highlights provided');
            return;
        }

        console.log('[ivaHighlighter] Highlighting', highlights.length, 'elements');

        highlights.forEach((highlight, index) => {
            const element = document.querySelector(highlight.selector);

            if (!element) {
                console.warn('[ivaHighlighter] Element not found:', highlight.selector);
                return;
            }

            // Create and add highlight overlay
            const overlay = this.createHighlight(element, index + 1, highlight);
            document.body.appendChild(overlay);
            this.activeHighlights.push(overlay);

            // Scroll to first element smoothly
            if (index === 0) {
                setTimeout(() => {
                    element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }, 100);
            }
        });

        // Auto-clear after 30 seconds
        setTimeout(() => {
            this.clearAll();
        }, 30000);
    }

    /**
     * Create highlight overlay for an element
     */
    static createHighlight(element, stepNumber, highlight) {
        const rect = element.getBoundingClientRect();

        // Main overlay container
        const overlay = document.createElement('div');
        overlay.className = 'IVA-highlight-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: ${rect.top + window.scrollY - 10}px;
            left: ${rect.left + window.scrollX - 10}px;
            width: ${rect.width + 20}px;
            height: ${rect.height + 20}px;
            border: 3px solid #4CAF50;
            border-radius: 8px;
            background: rgba(76, 175, 80, 0.1);
            pointer-events: none;
            z-index: 9998;
        `;

        // Step number badge
        const badge = document.createElement('div');
        badge.className = 'IVA-step-badge';
        badge.textContent = stepNumber;
        badge.style.cssText = `
            position: absolute;
            top: -15px;
            left: -15px;
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
        `;
        overlay.appendChild(badge);

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'IVA-tooltip';
        tooltip.innerHTML = `
            <strong>${highlight.label}</strong>
            ${highlight.description}
        `;

        // Calculate tooltip position (below or above element based on space)
        const tooltipTop = rect.bottom + window.scrollY + 15;
        const tooltipMaxBottom = window.innerHeight + window.scrollY;
        const positionAbove = tooltipTop + 100 > tooltipMaxBottom;

        tooltip.style.cssText = `
            position: absolute;
            ${positionAbove ?
                `bottom: ${rect.height + 30}px;` :
                `top: ${rect.height + 25}px;`
            }
            left: 0;
            background: #333;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            max-width: 320px;
            min-width: 200px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            line-height: 1.5;
        `;

        // Adjust arrow position if tooltip is above
        if (positionAbove) {
            const arrow = document.createElement('div');
            arrow.style.cssText = `
                position: absolute;
                bottom: -8px;
                left: 20px;
                width: 0;
                height: 0;
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-top: 8px solid #333;
            `;
            tooltip.appendChild(arrow);
        }

        overlay.appendChild(tooltip);

        return overlay;
    }

    /**
     * Clear all active highlights
     */
    static clearAll() {
        console.log('[ivaHighlighter] Clearing', this.activeHighlights.length, 'highlights');

        this.activeHighlights.forEach(overlay => {
            if (overlay && overlay.parentNode) {
                overlay.remove();
            }
        });

        this.activeHighlights = [];
    }

    /**
     * Highlight single element (convenience method)
     */
    static highlightElement(selector, label, description) {
        this.highlightElements([{
            selector,
            label,
            description
        }]);
    }
}

export default ivaHighlighter;

