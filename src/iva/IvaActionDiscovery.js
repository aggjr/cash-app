/**
 * IVA Action Discovery
 * Dynamically discovers all available actions on the current screen
 */

export class IvaActionDiscovery {

    /**
     * Discovers ALL actions available on the current screen
     */
    static discoverAllActions() {
        const actions = [];

        // 1. Primary buttons (create, add, new)
        actions.push(...this.discoverPrimaryButtons());

        // 2. Export buttons (PDF, Excel)
        actions.push(...this.discoverExportButtons());

        // 3. Filters (date, company, account, etc)
        actions.push(...this.discoverFilters());

        // 4. Row actions (edit, delete, view)
        actions.push(...this.discoverRowActions());

        // 5. Secondary buttons (cancel, back, etc)
        actions.push(...this.discoverSecondaryButtons());

        console.log(`[IVA Discovery] Found ${actions.length} actions`);
        return actions;
    }

    /**
     * Discovers primary action buttons
     */
    static discoverPrimaryButtons() {
        const actions = [];

        const selectors = [
            '.btn-primary',
            'button[class*="primary"]'
        ];

        const buttons = document.querySelectorAll(selectors.join(','));

        buttons.forEach(btn => {
            if (!btn.offsetParent) return; // Skip invisible

            const text = btn.textContent.trim();
            const id = btn.id || this.generateId(text);

            actions.push({
                id: `action-${id}`,
                type: 'button',
                category: 'primary',
                label: text,
                description: `Clica no botão "${text}"`,
                element: btn,
                selector: this.getSelector(btn),
                params: []
            });
        });

        return actions;
    }

    /**
     * Discovers export buttons
     */
    static discoverExportButtons() {
        const actions = [];

        // Find buttons with export-related text or icons
        const allButtons = document.querySelectorAll('button');

        allButtons.forEach(btn => {
            if (!btn.offsetParent) return;

            const text = btn.textContent.trim();
            const title = btn.title || '';

            // Check for PDF
            if (text.includes('PDF') || text.includes('🖨️') || title.includes('PDF')) {
                actions.push({
                    id: 'export-pdf',
                    type: 'export',
                    category: 'secondary',
                    label: text || 'PDF',
                    description: 'Exporta dados para PDF',
                    element: btn,
                    selector: this.getSelector(btn),
                    params: []
                });
            }

            // Check for Excel
            if (text.includes('Excel') || text.includes('📊') || title.includes('Excel')) {
                actions.push({
                    id: 'export-excel',
                    type: 'export',
                    category: 'secondary',
                    label: text || 'Excel',
                    description: 'Exporta dados para Excel',
                    element: btn,
                    selector: this.getSelector(btn),
                    params: []
                });
            }
        });

        return actions;
    }

    /**
     * Discovers filter inputs and controls
     */
    static discoverFilters() {
        const actions = [];

        // 1. Date filters
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            const label = this.findLabel(input);
            const id = input.id || this.generateId(label);

            actions.push({
                id: `filter-${id}`,
                type: 'filter',
                category: 'filter',
                filterType: 'date',
                label: label || 'Filtro de data',
                description: `Filtra por ${label || 'data'}`,
                element: input,
                selector: this.getSelector(input),
                params: ['value']
            });
        });

        // 2. Select filters
        const selects = document.querySelectorAll('select:not([disabled])');
        selects.forEach(select => {
            const label = this.findLabel(select);
            const id = select.id || this.generateId(label);
            const options = Array.from(select.options).map(opt => ({
                value: opt.value,
                text: opt.textContent
            }));

            actions.push({
                id: `filter-${id}`,
                type: 'filter',
                category: 'filter',
                filterType: 'select',
                label: label || 'Filtro',
                description: `Filtra por ${label || 'opção'}`,
                element: select,
                selector: this.getSelector(select),
                params: ['value'],
                options: options
            });
        });

        // 3. Search inputs
        const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="Pesquisar"]');
        searchInputs.forEach(input => {
            const label = this.findLabel(input) || input.placeholder;
            const id = input.id || this.generateId(label);

            actions.push({
                id: `search-${id}`,
                type: 'filter',
                category: 'filter',
                filterType: 'search',
                label: label || 'Buscar',
                description: `Busca por ${label || 'texto'}`,
                element: input,
                selector: this.getSelector(input),
                params: ['query']
            });
        });

        return actions;
    }

    /**
     * Discovers row-level actions in tables
     */
    static discoverRowActions() {
        const actions = [];

        // Find first table row to identify actions
        const firstRow = document.querySelector('table tbody tr:first-child');
        if (!firstRow) return actions;

        // Find action buttons in the row
        const actionButtons = firstRow.querySelectorAll('button, a[href="#"]');

        actionButtons.forEach(btn => {
            const text = btn.textContent.trim() || btn.title || btn.getAttribute('aria-label') || '';

            // Identify action type
            let actionType = 'unknown';
            if (/edit|editar|✏️/i.test(text)) actionType = 'edit';
            else if (/delete|excluir|remover|🗑️/i.test(text)) actionType = 'delete';
            else if (/view|ver|visualizar|👁️/i.test(text)) actionType = 'view';

            if (actionType !== 'unknown') {
                actions.push({
                    id: `row-${actionType}`,
                    type: 'row-action',
                    category: 'row',
                    actionType: actionType,
                    label: text || actionType,
                    description: `${actionType} item da tabela`,
                    element: btn,
                    selector: this.getRowActionSelector(btn),
                    params: ['rowId'],
                    requiresRowSelection: true
                });
            }
        });

        return actions;
    }

    /**
     * Discovers secondary buttons
     */
    static discoverSecondaryButtons() {
        const actions = [];

        const secondaryButtons = document.querySelectorAll('.btn-secondary, button[class*="secondary"]');

        secondaryButtons.forEach(btn => {
            if (!btn.offsetParent) return;

            const text = btn.textContent.trim();
            const id = btn.id || this.generateId(text);

            actions.push({
                id: `action-${id}`,
                type: 'button',
                category: 'secondary',
                label: text,
                description: `Clica no botão "${text}"`,
                element: btn,
                selector: this.getSelector(btn),
                params: []
            });
        });

        return actions;
    }

    /**
     * Finds label associated with an input element
     */
    static findLabel(element) {
        // 1. Label with 'for' attribute
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent.trim();
        }

        // 2. Parent label
        const parentLabel = element.closest('label');
        if (parentLabel) return parentLabel.textContent.trim();

        // 3. Previous sibling label
        const prevLabel = element.previousElementSibling;
        if (prevLabel && prevLabel.tagName === 'LABEL') {
            return prevLabel.textContent.trim();
        }

        // 4. Placeholder
        if (element.placeholder) return element.placeholder;

        // 5. Name or ID
        return element.name || element.id || 'Campo';
    }

    /**
     * Generates unique CSS selector for element
     */
    static getSelector(element) {
        if (element.id) return `#${element.id}`;

        const classes = Array.from(element.classList).join('.');
        if (classes) return `${element.tagName.toLowerCase()}.${classes}`;

        // Fallback: nth-child
        const parent = element.parentElement;
        const index = Array.from(parent.children).indexOf(element);
        return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
    }

    /**
     * Generates selector for row action
     */
    static getRowActionSelector(button) {
        const classes = Array.from(button.classList).join('.');
        return classes ? `.${classes}` : button.tagName.toLowerCase();
    }

    /**
     * Generates ID from text
     */
    static generateId(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
}
