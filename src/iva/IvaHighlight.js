/**
 * ivaHighlight - Visual Guidance System
 * Highlights UI elements when IVA is guiding the user
 */

const HIGHLIGHT_COLOR = '#DAB177'; // System golden color
const HIGHLIGHT_DURATION = 3000; // 3 seconds
const PULSE_ANIMATION = 'IVA-pulse 1.5s ease-in-out infinite';

export const ivaHighlight = {
    // Currently highlighted elements
    currentHighlights: [],

    // Add golden highlight to an element
    highlight(element, options = {}) {
        if (!element) return;

        const duration = options.duration || HIGHLIGHT_DURATION;
        const pulse = options.pulse !== false; // Default true

        // Store original styles
        const originalBorder = element.style.border;
        const originalBoxShadow = element.style.boxShadow;
        const originalAnimation = element.style.animation;
        const originalPosition = element.style.position;
        const originalZIndex = element.style.zIndex;

        // Apply highlight
        element.style.position = element.style.position || 'relative';
        element.style.zIndex = '1000';
        element.style.border = `3px solid ${HIGHLIGHT_COLOR}`;
        element.style.boxShadow = `0 0 20px ${HIGHLIGHT_COLOR}80, inset 0 0 10px ${HIGHLIGHT_COLOR}40`;

        if (pulse) {
            element.style.animation = PULSE_ANIMATION;
        }

        // Smooth scroll into view
        if (options.scroll !== false) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }

        // Store reference
        const highlightData = {
            element,
            originalStyles: {
                border: originalBorder,
                boxShadow: originalBoxShadow,
                animation: originalAnimation,
                position: originalPosition,
                zIndex: originalZIndex
            }
        };

        this.currentHighlights.push(highlightData);

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => this.removeHighlight(element), duration);
        }

        return highlightData;
    },

    // Remove highlight from specific element
    removeHighlight(element) {
        const index = this.currentHighlights.findIndex(h => h.element === element);
        if (index === -1) return;

        const { originalStyles } = this.currentHighlights[index];

        // Restore original styles
        element.style.border = originalStyles.border;
        element.style.boxShadow = originalStyles.boxShadow;
        element.style.animation = originalStyles.animation;
        element.style.position = originalStyles.position;
        element.style.zIndex = originalStyles.zIndex;

        // Remove from array
        this.currentHighlights.splice(index, 1);
    },

    // Remove all highlights
    clearAll() {
        while (this.currentHighlights.length > 0) {
            const { element } = this.currentHighlights[0];
            this.removeHighlight(element);
        }
    },

    // Highlight by selector
    highlightSelector(selector, options) {
        const element = document.querySelector(selector);
        if (element) {
            return this.highlight(element, options);
        }
        console.warn('[ivaHighlight] Element not found:', selector);
        return null;
    },

    // Highlight multiple elements sequentially
    async highlightSequence(selectors, options = {}) {
        const delay = options.delay || 500;

        for (const selector of selectors) {
            this.highlightSelector(selector, { ...options, duration: delay * 2 });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Add CSS animation to document
const styleElement = document.createElement('style');
styleElement.textContent = `
    @keyframes IVA-pulse {
        0%, 100% {
            box-shadow: 0 0 20px ${HIGHLIGHT_COLOR}80, inset 0 0 10px ${HIGHLIGHT_COLOR}40;
        }
        50% {
            box-shadow: 0 0 30px ${HIGHLIGHT_COLOR}CC, inset 0 0 15px ${HIGHLIGHT_COLOR}60;
        }
    }
`;
document.head.appendChild(styleElement);


