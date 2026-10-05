
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

        style.textContent += `
            body.cash-print-all,
            body.cash-print-all #app,
            body.cash-print-all .glass-panel,
            body.cash-print-all #table-container,
            body.cash-print-all .table-wrapper,
            body.cash-print-all .extrato-table-wrapper,
            body.cash-print-all .fechamento-table-wrapper,
            body.cash-print-all #tree-container,
            body.cash-print-all #tree-manager,
            body.cash-print-all #consolidadas-table-container,
            body.cash-print-all #previsao-table-container {
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
            }
        `;

        document.head.appendChild(style);

        document.body.classList.add('cash-print-all');
        window.addEventListener('afterprint', () => {
            document.body.classList.remove('cash-print-all');
        }, { once: true });
    },

    /**
     * Asks whether to print the current page or every page of the active filter.
     * @returns {Promise<'page'|'all'|null>}
     */
    askPrintScope: ({ total, shown }) => {
        return new Promise((resolve) => {
            let container = document.getElementById('custom-dialog-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'custom-dialog-container';
                document.body.appendChild(container);
            }

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'dialog-box animate-float-in';
            dialog.innerHTML = `
                <div class="dialog-header">
                    <h3>Imprimir</h3>
                </div>
                <div class="dialog-body">
                    <p>O filtro tem <strong>${total}</strong> registros. Esta página mostra <strong>${shown}</strong>.</p>
                    <p>Imprimir somente esta página ou todas as páginas deste filtro?</p>
                </div>
                <div class="dialog-footer" style="display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:flex-end;">
                    <button type="button" class="btn-secondary dialog-cancel-btn">Cancelar</button>
                    <button type="button" class="btn-secondary dialog-page-btn">Somente esta página</button>
                    <button type="button" class="btn-primary dialog-all-btn">Todas as páginas</button>
                </div>
            `;

            overlay.appendChild(dialog);
            container.appendChild(overlay);

            let settled = false;
            const close = (result) => {
                if (settled) return;
                settled = true;
                document.removeEventListener('keydown', handleKeydown);
                dialog.classList.add('animate-float-out');
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    if (container.contains(overlay)) container.removeChild(overlay);
                    resolve(result);
                }, 200);
            };

            const handleKeydown = (e) => {
                if (!document.body.contains(dialog)) return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    close(null);
                }
            };
            document.addEventListener('keydown', handleKeydown);

            dialog.querySelector('.dialog-cancel-btn').onclick = () => close(null);
            dialog.querySelector('.dialog-page-btn').onclick = () => close('page');
            dialog.querySelector('.dialog-all-btn').onclick = () => close('all');
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(null);
            });

            setTimeout(() => dialog.querySelector('.dialog-all-btn')?.focus(), 50);
        });
    },

    /**
     * Prints the current page, or asks and prints every filtered page when the list is paginated.
     */
    printWithChoice: async (options = {}) => {
        const state = typeof options.getState === 'function' ? options.getState() : null;
        const total = Number(state?.total) || 0;
        const limit = Number(state?.limit) || 0;
        const canExpand = state
            && total > limit
            && typeof options.load === 'function'
            && typeof options.setLimit === 'function';

        if (!canExpand) {
            PrintHelper.autoConfigureOrientation(options.selector || 'table');
            window.print();
            return;
        }

        const scope = await PrintHelper.askPrintScope({ total, shown: Math.min(limit, total) });
        if (!scope) return;
        if (scope === 'all') {
            await PrintHelper.printFilteredPages(options);
            return;
        }

        PrintHelper.autoConfigureOrientation(options.selector || 'table');
        window.print();
    },

    /**
     * Prints every row that matches the current filter, across all pages.
     * Screen lists stay at 50 rows; this temporarily loads the full filtered set.
     * getState/setLimit must close over the screen's pagination binding, because load() replaces that object.
     * @param {{ getState: () => { page?: number, limit?: number, total?: number }, setLimit: (n: number) => void, load: (page?: number) => Promise<void>, selector?: string }} options
     */
    printFilteredPages: async ({ getState, setLimit, load, selector = 'table' }) => {
        const state = typeof getState === 'function' ? getState() : {};
        const savedPage = Number(state?.page) || 1;
        const savedLimit = Number(state?.limit) || 50;
        const total = Number(state?.total) || 0;
        const expanded = total > savedLimit && typeof load === 'function' && typeof setLimit === 'function';

        const restore = async () => {
            if (!expanded) return;
            setLimit(savedLimit);
            await load(savedPage);
        };

        try {
            if (expanded) {
                setLimit(total);
                await load(1);
            }

            PrintHelper.autoConfigureOrientation(selector);

            await new Promise((resolve) => {
                let settled = false;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    window.removeEventListener('afterprint', finish);
                    resolve();
                };
                window.addEventListener('afterprint', finish);
                requestAnimationFrame(() => window.print());
                setTimeout(finish, 180000);
            });
        } catch (error) {
            console.error('[PrintHelper] Falha ao imprimir o filtro completo:', error);
            window.alert('Não foi possível preparar a impressão de todos os registros filtrados.');
        } finally {
            try {
                await restore();
            } catch (error) {
                console.error('[PrintHelper] Falha ao restaurar a página após imprimir:', error);
            }
        }
    }
};
