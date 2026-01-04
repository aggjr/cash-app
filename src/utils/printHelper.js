
/**
 * Utility to manage print settings, specifically page orientation.
 */

export const PrintHelper = {
    /**
     * Automatically sets the page orientation (Portrait/Landscape) based on the content width.
     * @param {string} selector - CSS selector for the main content table/container.
     * @param {number} threshold - Width in pixels. If content > threshold, use Landscape. Default 750px (~A4 Portrait printable width).
     */
    autoConfigureOrientation: (selector = 'table', threshold = 780) => {
        // Remove existing print-orientation style if any
        const existingStyle = document.getElementById('dynamic-print-style');
        if (existingStyle) existingStyle.remove();

        const element = document.querySelector(selector);
        let useLandscape = false;

        if (element) {
            // Get the scrollWidth (actual content width)
            // We clone to measure unrestricted width if needed, but usually current scrollWidth is enough if table is overflowed
            const width = element.scrollWidth;
            // Also check offsetWidth to see if it's already constrained

            console.log(`[PrintHelper] Detected width for '${selector}': ${width}px. Threshold: ${threshold}px.`);

            if (width > threshold) {
                useLandscape = true;
            }
        }

        // Create style element
        const style = document.createElement('style');
        style.id = 'dynamic-print-style';
        style.media = 'print';

        if (useLandscape) {
            console.log('[PrintHelper] Setting orientation to LANDSCAPE');
            style.textContent = `
                @page { 
                    size: landscape; 
                    margin: 10mm; /* Narrow margins for max space */
                }
            `;
        } else {
            console.log('[PrintHelper] Setting orientation to PORTRAIT');
            style.textContent = `
                @page { 
                    size: portrait; 
                    margin: 15mm;
                }
            `;
        }

        document.head.appendChild(style);
    }
};
