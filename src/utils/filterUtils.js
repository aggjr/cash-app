export const buildApiParams = (activeFilters, sortConfig, pagination, projectId) => {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    if (pagination) {
        params.append('page', pagination.page);
        params.append('limit', pagination.limit);
    }
    if (sortConfig && sortConfig.key) {
        params.append('sortBy', sortConfig.key);
        params.append('order', sortConfig.direction);
    }

    Object.keys(activeFilters).forEach(key => {
        const filter = activeFilters[key];

        // Special Boolean / Receipt Logic
        if (key === 'comprovante_url' || filter.type === 'boolean') {
            if (filter.value === 'with_file' || filter.value === 'true') params.append('hasReceipt', 'true');
            if (filter.value === 'without_file' || filter.value === 'false') params.append('hasReceipt', 'false');
            return;
        }

        // Global Search (Legacy)
        if (filter.search) {
            params.append('search', filter.search);
        }

        // --- Unified Dynamic Filters ---

        // 1. Lists (IN) - Handles numIn, textIn, dateIn
        const listValues = filter.numIn || filter.textIn || filter.dateIn;
        if (listValues && listValues.length > 0) {
            params.append(`filter_${key}_in`, listValues.join(','));
        }

        // 2. Operators (OP, VAL, START, END)
        // Detect if we have an operator-based filter
        const hasOperator = !!filter.operator;
        const mainVal = (filter.val1 !== undefined && filter.val1 !== '') ? filter.val1 : (filter.start || '');

        if (hasOperator && (mainVal !== '' || filter.operator === 'between')) { // 'between' might rely on val2 only? No, usually needs both.

            if (filter.operator === 'eq') {
                // Exact match
                params.append(`filter_${key}_op`, 'eq');
                params.append(`filter_${key}_val`, mainVal);
            }
            else if (filter.operator === 'before') {
                // "Before X" -> <= X (mapped to end date/val)
                params.append(`filter_${key}_end`, mainVal);
            }
            else if (filter.operator === 'after') {
                // "After X" -> >= X (mapped to start date/val)
                params.append(`filter_${key}_start`, mainVal);
            }
            else if (filter.operator === 'between') {
                if (mainVal) params.append(`filter_${key}_start`, mainVal);
                if (filter.val2 || filter.end) params.append(`filter_${key}_end`, filter.val2 || filter.end);
            }
            else {
                // Generic Operators: gt, gte, lt, lte, contains, starts_with, ends_with, neq
                params.append(`filter_${key}_op`, filter.operator);
                params.append(`filter_${key}_val`, mainVal);
            }
        } else {
            // 3. Fallback / Legacy
            // If no operator is set, check for direct Start/End (e.g. from old date range pickers if any remain)
            if (filter.start) params.append(`filter_${key}_start`, filter.start);
            if (filter.end) params.append(`filter_${key}_end`, filter.end);

            // Legacy .text property fallback
            if (filter.text) {
                params.append(`filter_${key}_op`, 'contains');
                params.append(`filter_${key}_val`, filter.text);
            }
        }
    });

    console.log('=== FILTER UTILS DEBUG ===');
    console.log('activeFilters:', activeFilters);
    console.log('Generated params:', params.toString());

    return params;
};
