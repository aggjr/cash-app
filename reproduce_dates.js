const parseLocalDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(num => parseInt(num));
    return new Date(year, month - 1, day); // month is 0-indexed
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
                nextDate = new Date(prevDate);
                nextDate.setMonth(prevDate.getMonth() + 1);
                break;
            case 'trimestral':
                nextDate = new Date(prevDate);
                nextDate.setMonth(prevDate.getMonth() + 3);
                break;
            case 'semestral':
                nextDate = new Date(prevDate);
                nextDate.setMonth(prevDate.getMonth() + 6);
                break;
            case 'anual':
                nextDate = new Date(prevDate);
                nextDate.setFullYear(prevDate.getFullYear() + 1);
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

// Test Case 1: Standard Monthly from 28/12
const dates1 = calculateDates('2025-12-28', 12, 'mensal');
console.log('Standard 28/12:', dates1);

// Test Case 2: Rollover from 31/12
const dates2 = calculateDates('2025-12-31', 12, 'mensal');
console.log('Rollover 31/12:', dates2);

// Test Case 3: Custom Days that matches 31/01
// 28/12 -> 31/01 is 34 days
const dates3 = calculateDates('2025-12-28', 12, 'personalizado', 34);
console.log('Custom 34 days:', dates3);
