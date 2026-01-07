/**
 * IVA Action Executor
 * Executes discovered actions on the current screen
 */

export class IvaActionExecutor {

    /**
     * Executes a discovered action
     */
    static async executeAction(action, params = {}) {
        console.log('[IVA Executor] Executing:', action.id, params);

        switch (action.type) {
            case 'button':
                return this.executeButtonClick(action);

            case 'filter':
                return this.executeFilter(action, params);

            case 'export':
                return this.executeExport(action);

            case 'row-action':
                return this.executeRowAction(action, params);

            default:
                return { success: false, error: 'Unknown action type' };
        }
    }

    /**
     * Executes button click
     */
    static executeButtonClick(action) {
        try {
            const element = action.element || document.querySelector(action.selector);
            if (!element) {
                return { success: false, error: 'Element not found' };
            }

            element.click();
            return { success: true, message: `Clicou em "${action.label}"` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Executes filter action
     */
    static executeFilter(action, params) {
        try {
            const element = action.element || document.querySelector(action.selector);
            if (!element) {
                return { success: false, error: 'Filter element not found' };
            }

            // Set value based on filter type
            if (action.filterType === 'date') {
                element.value = params.value || params.date;
            } else if (action.filterType === 'select') {
                element.value = params.value;
            } else if (action.filterType === 'search') {
                element.value = params.query;
            }

            // Trigger change events
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('input', { bubbles: true }));

            // Trigger any custom event handlers
            if (element.onchange) element.onchange();
            if (element.oninput) element.oninput();

            return {
                success: true,
                message: `Filtro "${action.label}" aplicado`
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Executes export action
     */
    static executeExport(action) {
        return this.executeButtonClick(action);
    }

    /**
     * Executes row action
     */
    static executeRowAction(action, params) {
        try {
            // Find row by ID
            const row = document.querySelector(`tr[data-id="${params.rowId}"]`);
            if (!row) {
                return { success: false, error: 'Row not found' };
            }

            // Find action button in row
            const button = row.querySelector(action.selector);
            if (!button) {
                return { success: false, error: 'Action button not found in row' };
            }

            button.click();
            return {
                success: true,
                message: `Ação "${action.actionType}" executada na linha`
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
