// Native Date implementation

const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

exports.calculateInstallments = (totalValue, count, type = 'dividir') => {
    const values = [];
    const total = parseFloat(totalValue);
    const n = parseInt(count);

    if (type === 'replicar') {
        for (let i = 0; i < n; i++) values.push(total);
    } else {
        // Dividir
        const base = Math.floor((total / n) * 100) / 100;
        let remainder = total - (base * n);
        // Fix float precision
        remainder = parseFloat(remainder.toFixed(2));

        for (let i = 0; i < n; i++) {
            let val = base;
            if (i === n - 1) val += remainder;
            values.push(parseFloat(val.toFixed(2)));
        }
    }
    return values;
};

exports.calculateDates = (startDate, count, interval = 'mensal', customDays = null) => {
    const dates = [];
    let current = new Date(startDate);

    for (let i = 0; i < count; i++) {
        dates.push(current.toISOString().split('T')[0]);

        if (interval === 'mensal') {
            current = addMonths(current, 1);
        } else if (interval === 'semanal') {
            current = addDays(current, 7);
        } else if (interval === 'quinzenal') {
            current = addDays(current, 15);
        } else if (interval === 'anual') {
            current = addMonths(current, 12);
        } else if (interval === 'personalizado' && customDays) {
            current = addDays(current, parseInt(customDays));
        }
    }
    return dates;
};
