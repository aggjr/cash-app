export const formatCurrency = (value) => {
    if (value === undefined || value === null || value === '') return '';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

export const parseCurrency = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    // Remove "R$", dots, and convert comma to dot
    const cleanValue = value.replace(/[^\d,-]/g, '').replace('.', '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
};
