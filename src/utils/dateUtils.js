/**
 * Date Utility Functions for CASH Application
 * 
 * IMPORTANT: All date handling uses LOCAL timezone and YYYY-MM-DD string format
 * to avoid timezone conversion bugs that occur when using JavaScript Date objects
 * for dates that represent calendar days (not timestamps).
 */

/**
 * Converts any date format to YYYY-MM-DD string
 * Handles strings, Date objects, and database date values
 * 
 * @param {string|Date|null} dateValue - Date in any format
 * @returns {string} Date in YYYY-MM-DD format, or empty string if invalid
 * 
 * @example
 * toDateString('2025-12-14T00:00:00.000Z') // '2025-12-14'
 * toDateString(new Date(2025, 11, 14))     // '2025-12-14'
 * toDateString('2025-12-14')               // '2025-12-14'
 */
export function toDateString(dateValue) {
    if (!dateValue) return '';

    // If already a string, extract first 10 characters (YYYY-MM-DD)
    if (typeof dateValue === 'string') {
        return dateValue.substring(0, 10);
    }

    // If it's a Date object, format using LOCAL getters (not UTC)
    // This prevents timezone shifting bugs
    if (dateValue instanceof Date) {
        const year = dateValue.getFullYear();
        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return '';
}

/**
 * Formats YYYY-MM-DD string to Brazilian DD/MM/YYYY format for display
 * 
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Date in DD/MM/YYYY format, or empty string if invalid
 * 
 * @example
 * formatDateBR('2025-12-14') // '14/12/2025'
 */
export function formatDateBR(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return '';
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
}

/**
 * Formats YYYY-MM-DD string to short Brazilian DD/MM format for compact display
 * 
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Date in DD/MM format, or empty string if invalid
 * 
 * @example
 * formatDateShortBR('2025-12-14') // '14/12'
 */
export function formatDateShortBR(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return '';
    const [year, month, day] = parts;
    return `${day}/${month}`;
}

/**
 * Parses Brazilian DD/MM/YYYY or DD/MM/YY format to YYYY-MM-DD
 * 
 * @param {string} brDate - Date in DD/MM/YYYY or DD/MM/YY format
 * @returns {string} Date in YYYY-MM-DD format, or empty string if invalid
 * 
 * @example
 * parseDateBR('14/12/2025') // '2025-12-14'
 * parseDateBR('14/12/25')   // '2025-12-14'
 */
export function parseDateBR(brDate) {
    if (!brDate || typeof brDate !== 'string') return '';
    const parts = brDate.split('/');
    if (parts.length < 2 || parts.length > 3) return '';

    const [day, month, year] = parts;

    // Handle 2-digit years (assume 2000s)
    const fullYear = year && year.length === 2 ? `20${year}` : year;

    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Checks if a date string is valid
 * 
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {boolean} True if valid date string
 * 
 * @example
 * isValidDate('2025-12-14') // true
 * isValidDate('2025-13-40') // false
 * isValidDate('invalid')    // false
 */
export function isValidDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return false;

    const parts = dateString.split('-');
    if (parts.length !== 3) return false;

    const [year, month, day] = parts.map(p => parseInt(p, 10));

    // Basic validation
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Check actual date validity using Date object
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;
}

/**
 * Gets today's date as YYYY-MM-DD string in LOCAL timezone
 * 
 * @returns {string} Today's date in YYYY-MM-DD format
 * 
 * @example
 * getToday() // '2025-12-23' (if today is Dec 23, 2025)
 */
export function getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
