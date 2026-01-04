/**
 * IVA Screen Actions Registry
 * Manages available UI interactions per screen (READ-ONLY)
 * Security: NO database write operations allowed
 */

class ivaScreenActions {
    static registry = {
        // ========================================
        // PREVISÃO DE FLUXO
        // ========================================
        previsao: {
            actions: [
                {
                    id: 'setDaysAhead',
                    type: 'SET_FILTER',
                    description: 'Filtrar X dias à frente na previsão de fluxo',
                    params: ['days'],
                    execute: async (days) => {
                        const input = document.querySelector('[data-IVA-days-filter]');
                        if (input) {
                            input.value = days;
                            input.dispatchEvent(new Event('change', { bubbles: true }));

                            // Trigger update if there's a button
                            const updateBtn = document.querySelector('[data-IVA-filter-btn]');
                            if (updateBtn) {
                                updateBtn.click();
                            }

                            await new Promise(r => setTimeout(r, 500));
                            return true;
                        }
                        return false;
                    }
                },
                {
                    id: 'setDateRange',
                    type: 'SET_FILTER',
                    description: 'Filtrar por intervalo de datas específico',
                    params: ['dataInicio', 'dataFim'],
                    execute: async (dataInicio, dataFim) => {
                        const startInput = document.querySelector('[data-IVA-date-start]');
                        const endInput = document.querySelector('[data-IVA-date-end]');

                        if (startInput && endInput) {
                            startInput.value = dataInicio;
                            endInput.value = dataFim;

                            const filterBtn = document.querySelector('[data-IVA-filter-btn]');
                            if (filterBtn) {
                                filterBtn.click();
                            }

                            await new Promise(r => setTimeout(r, 500));
                            return true;
                        }
                        return false;
                    }
                }
            ]
        },

        // ========================================
        // ENTRADAS (INCOME)
        // ========================================
        entradas: {
            actions: [
                {
                    id: 'filterByMonth',
                    type: 'SET_FILTER',
                    description: 'Filtrar entradas por mês e ano específico',
                    params: ['mes', 'ano'],
                    execute: async (mes, ano) => {
                        const mesSelect = document.querySelector('[name="mes"], [data-IVA-month-filter]');
                        const anoSelect = document.querySelector('[name="ano"], [data-IVA-year-filter]');

                        if (mesSelect && anoSelect) {
                            mesSelect.value = mes;
                            anoSelect.value = ano;

                            const filterBtn = document.querySelector('[data-IVA-filter-btn]');
                            if (filterBtn) {
                                filterBtn.click();
                            }

                            await new Promise(r => setTimeout(r, 500));
                            return true;
                        }
                        return false;
                    }
                },
                {
                    id: 'filterByType',
                    type: 'SET_FILTER',
                    description: 'Filtrar por tipo de entrada (Serviços, Vendas, etc)',
                    params: ['tipoId'],
                    execute: async (tipoId) => {
                        const tipoSelect = document.querySelector('[name="tipo"], [data-IVA-type-filter]');

                        if (tipoSelect) {
                            tipoSelect.value = tipoId;

                            const filterBtn = document.querySelector('[data-IVA-filter-btn]');
                            if (filterBtn) {
                                filterBtn.click();
                            }

                            await new Promise(r => setTimeout(r, 500));
                            return true;
                        }
                        return false;
                    }
                },
                {
                    id: 'filterByStatus',
                    type: 'SET_FILTER',
                    description: 'Filtrar por status (Realizada/Prevista)',
                    params: ['status'],
                    execute: async (status) => {
                        const statusSelect = document.querySelector('[name="status"], [data-IVA-status-filter]');

                        if (statusSelect) {
                            statusSelect.value = status;

                            const filterBtn = document.querySelector('[data-IVA-filter-btn]');
                            if (filterBtn) {
                                filterBtn.click();
                            }

                            await new Promise(r => setTimeout(r, 500));
                            return true;
                        }
                        return false;
                    }
                }
            ]
        },

        // ========================================
        // SAÍDAS (EXPENSES)
        // ========================================
        saidas: {
            actions: [
                {
                    id: 'filterByMonth',
                    type: 'SET_FILTER',
                    description: 'Filtrar saídas por mês e ano',
                    params: ['mes', 'ano'],
                    execute: async (mes, ano) => {
                        const mesSelect = document.querySelector('[name="mes"], [data-IVA-month-filter]');
                        const anoSelect = document.querySelector('[name="ano"], [data-IVA-year-filter]');

                        if (mesSelect && anoSelect) {
                            mesSelect.value = mes;
                            anoSelect.value = ano;

                            const filterBtn = document.querySelector('[data-IVA-filter-btn]');
                            if (filterBtn) {
                                filterBtn.click();
                            }

                            await new Promise(r => setTimeout(r, 500));
                            return true;
                        }
                        return false;
                    }
                },
                {
                    id: 'filterByType',
                    type: 'SET_FILTER',
                    description: 'Filtrar por tipo de saída',
                    params: ['tipoId'],
                    execute: async (tipoId) => {
                        const tipoSelect = document.querySelector('[name="tipo"], [data-IVA-type-filter]');

                        if (tipoSelect) {
                            tipoSelect.value = tipoId;

                            const filterBtn = document.querySelector('[data-IVA-filter-btn]');
                            if (filterBtn) {
                                filterBtn.click();
                            }

                            await new Promise(r => setTimeout(r, 500));
                            return true;
                        }
                        return false;
                    }
                }
            ]
        }
    };

    /**
     * Validate action is READ-ONLY (security check)
     */
    static isReadOnly(actionType) {
        const ALLOWED_TYPES = ['SET_FILTER', 'NAVIGATE', 'READ'];
        return ALLOWED_TYPES.includes(actionType);
    }

    /**
     * Get available actions for a screen
     */
    static getAvailableActions(screenId) {
        const screen = this.registry[screenId];
        return screen ? screen.actions : [];
    }

    /**
     * Execute an action with safety validation
     */
    static async executeAction(screenId, actionId, params) {
        const screen = this.registry[screenId];

        if (!screen) {
            console.error('[ivaScreenActions] Screen not found:', screenId);
            return {
                success: false,
                error: 'Tela não encontrada no registry'
            };
        }

        const action = screen.actions.find(a => a.id === actionId);

        if (!action) {
            console.error('[ivaScreenActions] Action not found:', actionId);
            return {
                success: false,
                error: 'Ação não encontrada'
            };
        }

        // 🔒 CRITICAL SECURITY CHECK
        if (!this.isReadOnly(action.type)) {
            console.error('[IVA Security] BLOCKED non-read-only action attempted:', action);
            return {
                success: false,
                error: 'Ação bloqueada por segurança. IVA não pode alterar dados do banco.'
            };
        }

        try {
            console.log(`[ivaScreenActions] Executing ${screenId}.${actionId} with params:`, params);
            const result = await action.execute(...params);
            console.log(`[ivaScreenActions] Execution result:`, result);
            return { success: result };
        } catch (error) {
            console.error('[ivaScreenActions] Execution error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Describe actions in human-readable format for LLM
     */
    static describeActions(screenId) {
        const actions = this.getAvailableActions(screenId);

        if (actions.length === 0) {
            return 'Nenhuma ação disponível nesta tela';
        }

        let description = `Ações disponíveis na tela ${screenId}:\n`;
        actions.forEach((action, index) => {
            description += `${index + 1}. ${action.id}: ${action.description}\n`;
            description += `   Parâmetros: ${action.params.join(', ')}\n`;
        });

        return description;
    }

    /**
     * Get actions formatted for LLM context
     */
    static getActionsForLLM(screenId) {
        const actions = this.getAvailableActions(screenId);

        return actions.map(action => ({
            id: action.id,
            description: action.description,
            params: action.params,
            type: action.type
        }));
    }
}

export default ivaScreenActions;

