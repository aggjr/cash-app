/**
 * ivaHighlight - Visual Guidance System
 * Highlights UI elements when IVA is guiding the user
 */

const HIGHLIGHT_COLOR = '#2F6C81'; // System Teal/Blue (Matches standard buttons)
const HIGHLIGHT_DURATION = 5000; // Increased to 5s for better visibility
const PULSE_ANIMATION = 'IVA-pulse 2s ease-in-out infinite';

export const IvaHighlight = {
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
    },

    // Highlight specific text on screen (Data Search)
    // NOW SUPPORTS: exact match for cell boundaries
    highlightText(text, options = {}) {
        console.log(`[ivaHighlight] Searching for text: "${text}"`);
        if (!text || text.length < 2) return 0;

        // Clean search term
        const searchTerm = text.toString().toLowerCase().trim();

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let count = 0;
        let node;
        const matches = [];

        // 1. Find matches in DOM
        while (node = walker.nextNode()) {
            // Ignore hidden/script/style tags
            if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) continue;

            const content = node.textContent.toLowerCase();

            // Check exact or partial match
            if (content.includes(searchTerm)) {
                let element = node.parentElement;

                // Move up to finding the real "container" (TD, TH, Button, Input)
                // This ensures we highlight the "cell" or "box" not just the span
                let steps = 0;
                while (
                    element &&
                    steps < 3 &&
                    !['TD', 'TH', 'BUTTON', 'INPUT', 'A'].includes(element.tagName) &&
                    !element.className.includes('card') &&
                    !element.className.includes('field')
                ) {
                    element = element.parentElement;
                    steps++;
                }

                // Check visibility
                if (element && element.offsetParent !== null) {
                    matches.push(element);
                }
            }
        }

        // 2. Filter duplicate elements (unlikely with TreeWalker on text, but safe due to parent climbing)
        const uniqueMatches = [...new Set(matches)];

        // 3. Highlight them
        uniqueMatches.forEach(el => {
            this.highlight(el, { ...options, pulse: true, scroll: count === 0 }); // Scroll only to first
            count++;
        });

        if (count > 0) {
            console.log(`[ivaHighlight] Found and highlighted ${count} occurrences of "${text}"`);
        } else {
            console.warn(`[ivaHighlight] Text "${text}" not found in visible DOM.`);
        }

        return count;
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



