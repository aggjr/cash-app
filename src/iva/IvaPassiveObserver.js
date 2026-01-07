import { getApiBaseUrl } from '../utils/apiConfig.js';

/**
 * IVA Passive Observer
 * Observes user behavior and learns silently
 */
export class IvaPassiveObserver {
    static observationQueue = [];
    static flushInterval = null;

    /**
     * Initialize passive observer
     */
    static init() {
        // Only observe if IVA is enabled
        const ivaEnabled = localStorage.getItem('iva_visible') !== 'false';

        if (ivaEnabled) {
            this.observeMenuNavigation();
            this.observeFilterUsage();
            this.observeButtonClicks();
            this.startFlushInterval();

            console.log('[IVA Observer] 👁️ Passive learning initialized');
        }
    }

    /**
     * Observe menu navigation
     */
    static observeMenuNavigation() {
        document.addEventListener('click', async (e) => {
            const menuItem = e.target.closest('.menu-item');

            if (menuItem && menuItem.dataset.id) {
                const screenId = menuItem.dataset.id;
                const menuPath = this.getMenuPath(menuItem);

                // Sample 20% of navigations (avoid overhead)
                if (Math.random() < 0.2) {
                    console.log('[IVA Observer] 👁️ Observed navigation:', screenId);

                    this.queueObservation({
                        type: 'navigation',
                        screen_id: screenId,
                        menu_path: menuPath
                    });
                }
            }
        }, true);
    }

    /**
     * Observe filter usage
     */
    static observeFilterUsage() {
        document.addEventListener('change', async (e) => {
            const filterInput = e.target.closest('[data-filter-type]');

            if (filterInput) {
                const filterType = filterInput.dataset.filterType;
                const screenId = this.getCurrentScreenId();

                if (Math.random() < 0.2) {
                    console.log('[IVA Observer] 👁️ Observed filter:', filterType);

                    this.queueObservation({
                        type: 'filter_usage',
                        screen_id: screenId,
                        filter_type: filterType,
                        filter_id: filterInput.id
                    });
                }
            }
        }, true);
    }

    /**
     * Observe button clicks
     */
    static observeButtonClicks() {
        document.addEventListener('click', async (e) => {
            const button = e.target.closest('button, .btn');

            if (button && !button.closest('.menu-item') && !button.closest('#ai-consultant-wrapper')) {
                const buttonText = button.textContent.trim();
                const buttonId = button.id;
                const screenId = this.getCurrentScreenId();

                // Ignore system buttons
                if (this.isSystemButton(buttonText)) return;

                if (Math.random() < 0.2) {
                    console.log('[IVA Observer] 👁️ Observed button:', buttonText);

                    this.queueObservation({
                        type: 'button_click',
                        screen_id: screenId,
                        button_id: buttonId,
                        button_label: buttonText,
                        button_type: this.inferButtonType(buttonText)
                    });
                }
            }
        }, true);
    }

    /**
     * Queue observation for batch sending
     */
    static queueObservation(observation) {
        this.observationQueue.push(observation);

        // Flush if queue is large
        if (this.observationQueue.length >= 10) {
            this.flushObservations();
        }
    }

    /**
     * Flush observations to backend
     */
    static async flushObservations() {
        if (this.observationQueue.length === 0) return;

        const observations = [...this.observationQueue];
        this.observationQueue = [];

        try {
            // Send each observation
            for (const obs of observations) {
                await fetch(`${getApiBaseUrl()}/IVA/observe`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(obs)
                });
            }

            console.log(`[IVA Observer] 📤 Flushed ${observations.length} observations`);
        } catch (error) {
            console.error('[IVA Observer] Error flushing:', error);
        }
    }

    /**
     * Start periodic flush
     */
    static startFlushInterval() {
        // Flush every 30 seconds
        this.flushInterval = setInterval(() => {
            this.flushObservations();
        }, 30000);
    }

    /**
     * Get menu path from menu item
     */
    static getMenuPath(menuItem) {
        const parts = [];
        let current = menuItem;

        while (current) {
            const label = current.querySelector('.menu-label')?.textContent;
            if (label) parts.unshift(label);

            // Go up to parent
            const parent = current.closest('.submenu')?.previousElementSibling;
            current = parent?.closest('.menu-item');
        }

        return parts.join(' > ');
    }

    /**
     * Get current screen ID
     */
    static getCurrentScreenId() {
        const activeMenu = document.querySelector('.menu-item.active');
        return activeMenu?.dataset.id || 'unknown';
    }

    /**
     * Check if button is a system button (ignore)
     */
    static isSystemButton(text) {
        const lower = text.toLowerCase();
        return lower.includes('fechar') ||
            lower.includes('cancelar') ||
            lower.includes('ok') ||
            lower.includes('sim') ||
            lower.includes('não');
    }

    /**
     * Infer button type from text
     */
    static inferButtonType(text) {
        const lower = text.toLowerCase();

        if (lower.includes('novo') || lower.includes('criar') || lower.includes('adicionar')) {
            return 'create';
        }
        if (lower.includes('exportar') || lower.includes('pdf') || lower.includes('excel')) {
            return 'export';
        }
        if (lower.includes('filtrar') || lower.includes('buscar') || lower.includes('pesquisar')) {
            return 'filter';
        }

        return 'action';
    }
}

export default IvaPassiveObserver;
