import { getApiBaseUrl } from './apiConfig.js';
import { getHeaders } from '../main.js';

/**
 * Validates if a date is within the allowed range based on system settings
 * Shows user-friendly error messages
 * @param {string} date - Date string in YYYY-MM-DD format
 * @returns {Promise<{isValid: boolean, error: string|null, isUnlocked: boolean}>}
 */
export async function validateTransactionDate(date) {
    if (!date) {
        return { isValid: true, error: null, isUnlocked: false };
    }

    const API_BASE_URL = getApiBaseUrl();

    try {
        // Fetch settings to get numero_dias and unlock status
        const response = await fetch(`${API_BASE_URL}/settings`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            console.error('Failed to fetch settings for date validation');
            // If we can't fetch settings, allow the backend to handle validation
            return { isValid: true, error: null, isUnlocked: false };
        }

        const settings = await response.json();
        const { numero_dias, unlock_expires_at } = settings;

        // Check if unlock is active
        const isUnlocked = unlock_expires_at && new Date(unlock_expires_at) > new Date();

        if (isUnlocked) {
            // Unlock is active - allow any date
            return { isValid: true, error: null, isUnlocked: true };
        }

        // Parse date as local (not UTC)
        const dateObj = new Date(date + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Rule 1: Cannot be in the future
        if (dateObj > today) {
            return {
                isValid: false,
                error: 'Data real não pode ser uma data futura',
                isUnlocked: false
            };
        }

        // Rule 2: Cannot be older than (today - numero_dias)
        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() - numero_dias);

        if (dateObj < minDate) {
            const minDateStr = minDate.toLocaleDateString('pt-BR');
            return {
                isValid: false,
                error: `Data fora do período permitido. Permitido: de ${minDateStr} até hoje`,
                isUnlocked: false
            };
        }

        // Date is valid
        return { isValid: true, error: null, isUnlocked: false };

    } catch (error) {
        console.error('Error validating date:', error);
        // On error, let backend handle validation
        return { isValid: true, error: null, isUnlocked: false };
    }
}

/**
 * Shows a date validation error message in the UI
 * @param {HTMLElement} inputElement - The date input element
 * @param {string} errorMessage - The error message to display
 */
export function showDateError(inputElement, errorMessage) {
    if (!inputElement) return;

    // Remove any existing error message
    clearDateError(inputElement);

    // Add error styling to input
    inputElement.style.borderColor = '#EF4444';
    inputElement.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';

    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'date-validation-error';
    errorDiv.style.cssText = `
        color: #EF4444;
        font-size: 0.875rem;
        margin-top: 0.25rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    errorDiv.innerHTML = `
        <span>⚠️</span>
        <span>${errorMessage}</span>
    `;

    // Insert after the input
    inputElement.parentElement.insertBefore(errorDiv, inputElement.nextSibling);
}

/**
 * Clears date validation error from the UI
 * @param {HTMLElement} inputElement - The date input element
 */
export function clearDateError(inputElement) {
    if (!inputElement) return;

    // Reset input styling
    inputElement.style.borderColor = '';
    inputElement.style.boxShadow = '';

    // Remove error message
    const errorDiv = inputElement.parentElement.querySelector('.date-validation-error');
    if (errorDiv) {
        errorDiv.remove();
    }
}

/**
 * Shows an info message when system is unlocked
 * @param {HTMLElement} container - Container element to show the message in
 */
export function showUnlockInfo(container) {
    if (!container) return;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'unlock-info';
    infoDiv.style.cssText = `
        background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
        border: 1px solid #F59E0B;
        border-radius: 8px;
        padding: 0.75rem;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #92400E;
    `;
    infoDiv.innerHTML = `
        <span style="font-size: 1.25rem;">🔓</span>
        <span><strong>Sistema em modo de exceção:</strong> Qualquer data pode ser usada</span>
    `;

    container.prepend(infoDiv);
}
