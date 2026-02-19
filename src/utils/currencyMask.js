/**
 * Currency Mask Utility
 * Implements "shift-left" input behavior for Brazilian Real (BRL).
 * 
 * Behavior:
 * - Strips all non-digit characters.
 * - Treats the number as cents (divides by 100).
 * - Formats as pt-BR currency (e.g. 1 -> 0,01).
 */

export const formatCurrency = (value) => {
    // 1. Get digits and sign
    let str = String(value);
    const isNegative = str.includes('-');
    const digits = str.replace(/\D/g, '');

    // 2. Handle empty
    if (!digits) return '';

    // 3. Parse cents
    const cents = parseInt(digits, 10);

    // 4. Convert to float
    const floatVal = cents / 100;

    // 5. Format
    const formatted = floatVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return isNegative ? '-' + formatted : formatted;
};

export const parseCurrency = (str) => {
    if (!str) return 0;
    // Check sign before stripping
    const isNegative = String(str).includes('-');

    // Remove "R$", trim, remove dots (thousands), replace comma with dot
    // But since our mask output is "1.000,00", we can just:
    const clean = String(str).replace(/\./g, '').replace(',', '.');
    // Remove any other non-numeric chars except dot
    const numStr = clean.replace(/[^0-9.]/g, '');

    let floatVal = parseFloat(numStr) || 0;
    if (isNegative) floatVal = floatVal * -1;

    return floatVal;
};

// Use this to render initial values from float
export const formatFloatToCurrency = (num) => {
    if (num === undefined || num === null) return '';
    // Handle negative numbers standard formatting
    return Number(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * attachCurrencyMask
 * @param {HTMLInputElement} inputElement 
 * @param {Function} onValidate 
 * @param {Object} options { allowNegative: boolean, negativeColor: string, positiveColor: string }
 */
export const attachCurrencyMask = (inputElement, onValidate = null, options = {}) => {
    if (!inputElement) return;

    const {
        allowNegative = false,
        negativeColor = null, // e.g. '#EF4444'
        positiveColor = null  // e.g. '#10B981'
    } = options;

    const updateColor = (val) => {
        if (!negativeColor && !positiveColor) return;

        const isNegative = String(val).includes('-');
        if (isNegative && negativeColor) {
            inputElement.style.color = negativeColor;
        } else if (!isNegative && positiveColor) {
            inputElement.style.color = positiveColor;
        } else {
            inputElement.style.color = ''; // reset
        }
    };

    const handleInput = (e) => {
        let val = e.target.value;

        // Handle negative input toggling if allowed
        if (allowNegative && e.data === '-') {
            if (val.includes('-')) {
                // If already has -, maybe remove it? Or standard behavior usually toggles or keeps.
                // Let's assume if they type - and it's already negative, we do nothing or maybe toggle.
                // Simple approach: check if content became negative. formatCurrency handles existing -.
                // If user typed - into empty, it becomes -.
            } else {
                // Prepend -
                val = '-' + val;
            }
        }

        // Special case: if user deletes everything but '-', clear it?
        // Or if they type '-' on empty.

        // If data is '-' and value was empty, formatCurrency might strip it if we don't pass it right.
        // formatCurrency logic: includes('-') -> preserves.

        const formatted = formatCurrency(val);

        if (val !== formatted) {
            // Check if user is trying to type negative
            if (allowNegative && val === '-') {
                // Allow just '-' to sit there? formatCurrency returns '' if no digits.
                // We need to allow state where just '-' exists? 
                // Currently formatCurrency returns '' if !digits. 
                // Let's keep it simple: wait for digits.
                // But users like seeing the minus sign.
                // Update formatCurrency to not return '' if digits empty but has sign? No, tricky.
            } else {
                e.target.value = formatted;
            }
        }

        // Force update if it resolved to valid number
        if (formatted) {
            e.target.value = formatted;
            updateColor(formatted);
        }

        if (onValidate) onValidate();
    };

    const handleFocus = (e) => {
        // Move cursor to end to facilitate appending digits
        setTimeout(() => {
            e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
        }, 0);
    };

    const handleBlur = (e) => {
        // Ensure format and validate
        // Optional: if empty or zero, maybe clear? 
        // Current requirement: just ensure mask.
        e.target.value = formatCurrency(e.target.value);
        updateColor(e.target.value);
        if (onValidate) onValidate();
    };

    // Handle keydown for '-' toggle and Backspace convenience
    const handleKeyDown = (e) => {
        if (!allowNegative) return;

        if (e.key === '-') {
            e.preventDefault();
            let val = e.target.value;
            if (val.includes('-')) {
                e.target.value = val.replace('-', '');
            } else {
                e.target.value = '-' + val;
            }
            // Trigger input event to reformat
            e.target.dispatchEvent(new Event('input'));
            return;
        }

        if (e.key === 'Backspace') {
            const val = e.target.value;
            if (val && val.includes('-')) {
                const digits = val.replace(/\D/g, '');
                const intVal = parseInt(digits, 10);

                // If 0 or NaN (empty), remove negative sign
                if (!intVal) {
                    // Start or End of input? 
                    // If cursor is at start, default backspace might do nothing.
                    // If we just force remove '-', it works.
                    // But we should only do this if the result would be zero.
                    // Actually, let's just allow it if it is 0,00.
                    // But wait, standard backspace on -0,00 removes last digit.
                    // The user wants to remove the SIGN.
                    // So we force remove sign.
                    e.preventDefault();
                    e.target.value = val.replace('-', '');
                    e.target.dispatchEvent(new Event('input'));
                }
            }
        }
    };

    inputElement.addEventListener('input', handleInput);
    if (allowNegative) {
        inputElement.addEventListener('keydown', handleKeyDown);
    }
    inputElement.addEventListener('focus', handleFocus);
    inputElement.addEventListener('blur', handleBlur);

    // Initial check
    if (inputElement.value) {
        updateColor(inputElement.value);
        inputElement.value = formatCurrency(inputElement.value);
    }
};
