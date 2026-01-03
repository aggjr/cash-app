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

// Test Reverse Logic
// 31/03 - 1 month should be 28/02
const date1 = new Date('2026-03-31');
const prev1 = addMonths(date1, -1);
console.log('31/03 - 1 month =', prev1.toISOString().split('T')[0]);

// 28/02 - 1 month should be 28/01
const date2 = new Date('2026-02-28');
const prev2 = addMonths(date2, -1);
console.log('28/02 - 1 month =', prev2.toISOString().split('T')[0]);

// 31/05 - 1 month should be 30/04
const date3 = new Date('2026-05-31');
const prev3 = addMonths(date3, -1);
console.log('31/05 - 1 month =', prev3.toISOString().split('T')[0]);
