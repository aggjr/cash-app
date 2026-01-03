/**
 * Screen Context Extractor
 * Extracts current screen filters and visual summary for EVA
 * Hybrid approach: sends filters + summary, backend fetches complete data
 */

class ScreenContextExtractor {
    /**
     * Extract screen context based on current URL/state
     */
    static extract() {
        const screenId = this.detectScreenType();

        if (!screenId) {
            return null;
        }

        const filters = this.extractFilters(screenId);
        const visualSummary = this.extractVisualSummary(screenId);

        return {
            screenId,
            filters,
            visualSummary,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Detect current screen type from URL or state
     */
    static detectScreenType() {
        const path = window.location.pathname;

        if (path.includes('/entradas') || path.includes('income')) {
            return 'entradas';
        } else if (path.includes('/saidas') || path.includes('expense')) {
            return 'saidas';
        } else if (path.includes('/previsao') || path.includes('/forecast')) {
            return 'previsao';
        } else if (path.includes('/producao') || path.includes('/revenda')) {
            return 'producao_revenda';
        } else if (path.includes('/consolidadas')) {
            return 'consolidadas';
        }

        return null;
    }

    /**
     * Extract applied filters from DOM
     */
    static extractFilters(screenId) {
        const filters = {};

        try {
            // Date filters - common across screens
            const mesSelect = document.querySelector('select[name="mes"], select#filter-mes');
            const anoSelect = document.querySelector('select[name="ano"], select#filter-ano');

            if (mesSelect && mesSelect.value) {
                filters.mes = parseInt(mesSelect.value);
            }
            if (anoSelect && anoSelect.value) {
                filters.ano = parseInt(anoSelect.value);
            }

            // Date range filters
            const dataInicioInput = document.querySelector('input[name="dataInicio"], input#data-inicio');
            const dataFimInput = document.querySelector('input[name="dataFim"], input#data-fim');

            if (dataInicioInput && dataInicioInput.value) {
                filters.dataInicio = dataInicioInput.value;
            }
            if (dataFimInput && dataFimInput.value) {
                filters.dataFim = dataFimInput.value;
            }

            // Type filter
            const tipoSelect = document.querySelector('select[name="tipo"], select#filter-tipo');
            if (tipoSelect && tipoSelect.value) {
                filters.tipo = tipoSelect.value;
            }

            // Status filter (Real vs Prevista)
            const statusSelect = document.querySelector('select[name="status"], select#filter-status');
            if (statusSelect && statusSelect.value) {
                filters.status = statusSelect.value;
            }

        } catch (error) {
            console.error('[ScreenContextExtractor] Error extracting filters:', error);
        }

        return filters;
    }

    /**
     * Extract visual summary from current screen
     */
    static extractVisualSummary(screenId) {
        const summary = {
            totalRecords: 0,
            totalValue: 0,
            hasData: false
        };

        try {
            // Count table rows
            const tableRows = document.querySelectorAll('table tbody tr:not(.no-data)');
            summary.totalRecords = tableRows.length;
            summary.hasData = tableRows.length > 0;

            // Look for total value in common places
            const totalValueEl = document.querySelector(
                '.total-value, .valor-total, [data-total-value], .summary-total'
            );

            if (totalValueEl) {
                const totalText = totalValueEl.textContent.trim();
                // Extract number from text like "R$ 125.000,50"
                const numberMatch = totalText.match(/[\d.,]+/);
                if (numberMatch) {
                    const cleanNumber = numberMatch[0].replace(/\./g, '').replace(',', '.');
                    summary.totalValue = parseFloat(cleanNumber);
                }
            }

            // Sample records (first 5 for context)
            summary.sampleRecords = this.extractSampleRecords(tableRows, 5);

        } catch (error) {
            console.error('[ScreenContextExtractor] Error extracting summary:', error);
        }

        return summary;
    }

    /**
     * Extract sample records from table rows
     */
    static extractSampleRecords(rows, limit = 5) {
        const records = [];

        for (let i = 0; i < Math.min(rows.length, limit); i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td');

            if (cells.length === 0) continue;

            const record = {
                descricao: cells[0]?.textContent?.trim() || '',
                tipo: cells[1]?.textContent?.trim() || '',
                valor: cells[2]?.textContent?.trim() || '',
                data: cells[3]?.textContent?.trim() || ''
            };

            records.push(record);
        }

        return records;
    }

    /**
     * Check if screen has data available
     */
    static hasScreenData() {
        const screenId = this.detectScreenType();
        if (!screenId) return false;

        const tableRows = document.querySelectorAll('table tbody tr:not(.no-data)');
        return tableRows.length > 0;
    }
}

export default ScreenContextExtractor;
