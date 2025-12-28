const parseLocalDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(num => parseInt(num));
    return new Date(year, month - 1, day); // month is 0-indexed
};

// NEW LOGIC
const addMonths = (date, months) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== day) {
        d.setDate(0);
    }
    return d;
};

const calculateDates = (baseDate, count, interval, customDays = null) => {
    const dates = [baseDate];

    for (let i = 1; i < count; i++) {
        const prevDate = parseLocalDate(dates[i - 1]);
        let nextDate;

        switch (interval) {
            case 'semanal':
                nextDate = new Date(prevDate);
                nextDate.setDate(prevDate.getDate() + 7);
                break;
            case 'quinzenal':
                nextDate = new Date(prevDate);
                nextDate.setDate(prevDate.getDate() + 15);
                break;
            case 'mensal':
                nextDate = addMonths(prevDate, 1);
                break;
            case 'trimestral':
                nextDate = addMonths(prevDate, 3);
                break;
            case 'semestral':
                nextDate = addMonths(prevDate, 6);
                break;
            case 'anual':
                nextDate = addMonths(prevDate, 12);
                break;
            case 'personalizado':
                nextDate = new Date(prevDate);
                nextDate.setDate(prevDate.getDate() + (customDays || 1));
                break;
            default:
                nextDate = prevDate;
        }

        // Format to YYYY-MM-DD
        const year = nextDate.getFullYear();
        const month = String(nextDate.getMonth() + 1).padStart(2, '0');
        const day = String(nextDate.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }

    return dates;
};

// Rollover 31/12 with new logic
// Expected: 31/12, 31/01, 28/02, 31/03...
const dates2 = calculateDates('2025-12-31', 12, 'mensal');
console.log('Fixed Rollover 31/12:', dates2);
