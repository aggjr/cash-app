/**
 * IVA Collective Observer
 * 
 * Observa passivamente o uso do sistema por TODOS os usuários
 * e registra conhecimento coletivo no nível MODULE.
 * 
 * Características:
 * - Ultra-leve (~0.6ms por clique)
 * - Envio em lote (a cada 10s)
 * - Conhecimento compartilhado entre todos os usuários
 */

class IvaCollectiveObserver {
    constructor() {
        this.usageQueue = [];
        this.currentScreen = null;
        this.sendTimer = null;
        this.initialized = false;
    }

    /**
     * Inicializar observador
     */
    initialize() {
        if (this.initialized) return;

        // Listener global de cliques
        document.addEventListener('click', (e) => this.observeClick(e), true);

        // Listener de navegação
        window.addEventListener('hashchange', () => this.observeNavigation());

        this.initialized = true;
        console.log('[IVA Collective Observer] Initialized');
    }

    /**
     * Observar clique do usuário
     */
    observeClick(event) {
        const element = event.target.closest('button, a, [role="button"], .btn');
        if (!element) return;

        // Ignorar cliques em elementos da própria IVA
        if (element.closest('.iva-widget, .iva-chat')) return;

        const usage = {
            type: 'CLICK',
            screen_id: this.getCurrentScreen(),
            element_id: element.id || element.getAttribute('data-action') || element.getAttribute('data-id'),
            element_text: element.textContent?.trim().substring(0, 100), // Limitar tamanho
            element_type: 'BUTTON',
            timestamp: Date.now()
        };

        // Só registrar se tiver ID ou texto
        if (usage.element_id || usage.element_text) {
            this.recordUsage(usage);
        }
    }

    /**
     * Observar navegação
     */
    observeNavigation() {
        const newScreen = this.getCurrentScreen();

        if (newScreen && newScreen !== this.currentScreen) {
            const usage = {
                type: 'NAVIGATION',
                from_screen: this.currentScreen,
                to_screen: newScreen,
                timestamp: Date.now()
            };

            this.recordUsage(usage);
            this.currentScreen = newScreen;
        }
    }

    /**
     * Registrar uso (adicionar à fila)
     */
    recordUsage(usage) {
        this.usageQueue.push(usage);
        this.scheduleSend();
    }

    /**
     * Agendar envio em lote
     */
    scheduleSend() {
        clearTimeout(this.sendTimer);

        this.sendTimer = setTimeout(() => {
            if (this.usageQueue.length > 0) {
                this.sendBatch();
            }
        }, 10000); // 10 segundos
    }

    /**
     * Enviar lote para backend
     */
    async sendBatch() {
        const batch = [...this.usageQueue];
        this.usageQueue = [];

        try {
            const response = await fetch('/api/iva/record-collective-usage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    module_code: 'CASH',
                    usages: batch
                })
            });

            if (!response.ok) {
                console.warn('[IVA Collective Observer] Failed to send batch:', response.statusText);
            }
        } catch (error) {
            console.error('[IVA Collective Observer] Error sending batch:', error);
            // Não re-adicionar à fila para evitar loop infinito
        }
    }

    /**
     * Obter tela atual
     */
    getCurrentScreen() {
        // Tentar múltiplas formas de identificar a tela
        const screenId =
            document.querySelector('[data-screen-id]')?.getAttribute('data-screen-id') ||
            document.querySelector('.screen-container')?.id ||
            window.location.hash.replace('#', '') ||
            'unknown';

        return screenId;
    }

    /**
     * Forçar envio imediato (útil antes de fechar página)
     */
    flush() {
        if (this.usageQueue.length > 0) {
            clearTimeout(this.sendTimer);
            this.sendBatch();
        }
    }
}

// Criar instância global
window.ivaCollectiveObserver = new IvaCollectiveObserver();

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.ivaCollectiveObserver.initialize();
    });
} else {
    window.ivaCollectiveObserver.initialize();
}

// Enviar dados pendentes antes de fechar página
window.addEventListener('beforeunload', () => {
    window.ivaCollectiveObserver.flush();
});

export default IvaCollectiveObserver;
