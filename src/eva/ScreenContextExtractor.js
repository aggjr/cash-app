/**
 * EVA Screen Context Extractor
 * Extracts visible data from current screen for contextual Q&A
 */

export const ScreenContextExtractor = {
    /**
     * Get current screen identifier
     */
    getCurrentScreen() {
        // Check URL hash
        const hash = window.location.hash.replace('#', '');
        if (hash) return hash;

        // Check active menu item
        const activeMenu = document.querySelector('.tree-node.active, .menu-item.active, [class*="active"]');
        if (activeMenu) {
            const itemId = activeMenu.getAttribute('data-item-id');
            if (itemId) return itemId;

            // Fallback to text content
            return activeMenu.textContent?.trim().toLowerCase().replace(/\s+/g, '-');
        }

        // Check main content title
        const title = document.querySelector('h1, h2, .page-title, .screen-title');
        if (title) {
            return title.textContent?.trim().toLowerCase().replace(/\s+/g, '-');
        }

        return 'unknown';
    },

    /**
     * Extract table data from screen
     */
    extractTableData() {
        const tables = document.querySelectorAll('table');
        if (!tables.length) return null;

        const tablesData = [];

        tables.forEach((table, index) => {
            const headers = [];
            const rows = [];

            // Extract headers
            const headerCells = table.querySelectorAll('thead th');
            headerCells.forEach(th => {
                headers.push(th.textContent?.trim() || '');
            });

            // Extract rows (limit to first 10 for context)
            const bodyRows = Array.from(table.querySelectorAll('tbody tr')).slice(0, 10);
            bodyRows.forEach(tr => {
                const rowData = [];
                const cells = tr.querySelectorAll('td');
                cells.forEach(td => {
                    rowData.push(td.textContent?.trim() || '');
                });
                if (rowData.length > 0) {
                    rows.push(rowData);
                }
            });

            if (headers.length > 0 || rows.length > 0) {
                tablesData.push({
                    index,
                    headers,
                    rows,
                    totalRows: table.querySelectorAll('tbody tr').length
                });
            }
        });

        return tablesData.length > 0 ? tablesData : null;
    },

    /**
     * Extract form data from screen
     */
    extractFormData() {
        const forms = document.querySelectorAll('form, .modal form');
        if (!forms.length) return null;

        const formsData = [];

        forms.forEach((form, index) => {
            const fields = [];

            // Extract input fields
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                const label = form.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() ||
                    input.getAttribute('placeholder') ||
                    input.getAttribute('name') ||
                    'Campo sem rótulo';

                const value = input.value?.trim() || '';
                const type = input.type || input.tagName.toLowerCase();

                fields.push({
                    label,
                    value,
                    type
                });
            });

            if (fields.length > 0) {
                formsData.push({
                    index,
                    fields
                });
            }
        });

        return formsData.length > 0 ? formsData : null;
    },

    /**
     * Extract summary cards/stats
     */
    extractSummaryData() {
        const summaries = [];

        // Look for common summary card patterns
        const cards = document.querySelectorAll('.summary-card, .stat-card, .card, [class*="summary"]');

        cards.forEach(card => {
            const label = card.querySelector('.label, .title, h3, h4')?.textContent?.trim();
            const value = card.querySelector('.value, .amount, .count')?.textContent?.trim();

            if (label && value) {
                summaries.push({ label, value });
            }
        });

        return summaries.length > 0 ? summaries : null;
    },

    /**
     * Extract all context from current screen
     */
    extractFullContext() {
        const screen = this.getCurrentScreen();
        const tables = this.extractTableData();
        const forms = this.extractFormData();
        const summaries = this.extractSummaryData();

        // Get page title
        const pageTitle = document.querySelector('h1, h2, .page-title, .screen-title')?.textContent?.trim() || '';

        // Build context object
        const context = {
            screen,
            pageTitle,
            hasTables: !!tables,
            hasForms: !!forms,
            hasSummaries: !!summaries
        };

        // Add data if present
        if (tables) {
            context.tables = tables;
        }

        if (forms) {
            context.forms = forms;
        }

        if (summaries) {
            context.summaries = summaries;
        }

        return context;
    },

    /**
     * Format context for LLM prompt
     */
    formatContextForLLM(context) {
        let formatted = `CONTEXTO DA TELA ATUAL:\n`;
        formatted += `Tela: ${context.screen}\n`;

        if (context.pageTitle) {
            formatted += `Título: ${context.pageTitle}\n`;
        }

        formatted += `\n`;

        // Add summaries
        if (context.summaries) {
            formatted += `RESUMOS/CARDS:\n`;
            context.summaries.forEach(s => {
                formatted += `- ${s.label}: ${s.value}\n`;
            });
            formatted += `\n`;
        }

        // Add table data
        if (context.tables) {
            formatted += `TABELAS VISÍVEIS:\n`;
            context.tables.forEach(table => {
                formatted += `Tabela ${table.index + 1}:\n`;
                formatted += `Colunas: ${table.headers.join(' | ')}\n`;
                formatted += `Mostrando ${table.rows.length} de ${table.totalRows} registros\n`;

                // Add first few rows as example
                table.rows.slice(0, 3).forEach((row, idx) => {
                    formatted += `  Linha ${idx + 1}: ${row.join(' | ')}\n`;
                });

                if (table.rows.length > 3) {
                    formatted += `  ... (mais ${table.rows.length - 3} linhas)\n`;
                }
                formatted += `\n`;
            });
        }

        // Add form data
        if (context.forms) {
            formatted += `FORMULÁRIOS VISÍVEIS:\n`;
            context.forms.forEach(form => {
                formatted += `Formulário ${form.index + 1}:\n`;
                form.fields.forEach(field => {
                    const valueStr = field.value ? `: "${field.value}"` : ' (vazio)';
                    formatted += `  - ${field.label} (${field.type})${valueStr}\n`;
                });
                formatted += `\n`;
            });
        }

        return formatted;
    }
};

// Export to window
window.ScreenContextExtractor = ScreenContextExtractor;
