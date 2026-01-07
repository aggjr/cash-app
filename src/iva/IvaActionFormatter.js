/**
 * IVA Action Formatter
 * Formats discovered actions for LLM consumption
 */

export class IvaActionFormatter {

    /**
     * Formats actions for LLM
     */
    static formatForLLM(actions) {
        return actions.map(action => ({
            id: action.id,
            type: action.type,
            category: action.category,
            label: action.label,
            description: action.description,
            params: action.params,
            options: action.options, // For selects
            filterType: action.filterType // For filters
        }));
    }

    /**
     * Generates natural language description of available actions
     */
    static generateNaturalDescription(actions) {
        const descriptions = {
            primary: [],
            filter: [],
            export: [],
            row: [],
            secondary: []
        };

        actions.forEach(action => {
            descriptions[action.category]?.push(action.label);
        });

        let text = 'Ações disponíveis nesta tela:\n\n';

        if (descriptions.primary.length > 0) {
            text += `**Ações principais**: ${descriptions.primary.join(', ')}\n`;
        }

        if (descriptions.filter.length > 0) {
            text += `**Filtros**: ${descriptions.filter.join(', ')}\n`;
        }

        if (descriptions.export.length > 0) {
            text += `**Exportação**: ${descriptions.export.join(', ')}\n`;
        }

        if (descriptions.row.length > 0) {
            text += `**Ações em linhas**: ${descriptions.row.join(', ')}\n`;
        }

        return text;
    }

    /**
     * Groups actions by category
     */
    static groupByCategory(actions) {
        const grouped = {
            primary: [],
            filter: [],
            export: [],
            row: [],
            secondary: []
        };

        actions.forEach(action => {
            grouped[action.category]?.push(action);
        });

        return grouped;
    }

    /**
     * Filters actions by type
     */
    static filterByType(actions, type) {
        return actions.filter(action => action.type === type);
    }
}
