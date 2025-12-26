const db = require('../config/database');

/**
 * Validates if a date is within the allowed range based on system settings
 * @param {Date|string} dateToValidate - The date to validate
 * @param {number} projectId - The project ID to get settings for
 * @returns {Promise<{isValid: boolean, error: string|null, details: object}>}
 */
async function validateDateWithinRange(dateToValidate, projectId) {
    try {
        // Convert to Date object if string
        const date = typeof dateToValidate === 'string'
            ? new Date(dateToValidate)
            : dateToValidate;

        if (isNaN(date.getTime())) {
            return {
                isValid: false,
                error: 'Data inválida',
                details: null
            };
        }

        // Get system settings for the project
        const [settings] = await db.query(
            'SELECT numero_dias, unlock_expires_at FROM system_settings WHERE project_id = ?',
            [projectId]
        );

        // If no settings found, initialize with defaults
        if (settings.length === 0) {
            await db.query(
                'INSERT INTO system_settings (project_id, numero_dias, tempo_minutos_liberacao) VALUES (?, 3, 5)',
                [projectId]
            );
            return validateDateWithinRange(dateToValidate, projectId);
        }

        const config = settings[0];
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today

        // Check if unlock is active
        if (config.unlock_expires_at) {
            const unlockExpires = new Date(config.unlock_expires_at);
            if (unlockExpires > new Date()) {
                // Unlock is active - allow any date
                return {
                    isValid: true,
                    error: null,
                    details: {
                        unlocked: true,
                        expiresAt: unlockExpires
                    }
                };
            }
        }

        // Normalize date for comparison (midnight)
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        // Rule 1: Cannot be in the future
        if (dateOnly > now) {
            return {
                isValid: false,
                error: 'Data real não pode ser uma data futura',
                details: {
                    maxDate: now,
                    providedDate: dateOnly
                }
            };
        }

        // Rule 2: Cannot be older than (today - numero_dias)
        const minDate = new Date(now);
        minDate.setDate(minDate.getDate() - config.numero_dias);

        if (dateOnly < minDate) {
            const minDateStr = minDate.toLocaleDateString('pt-BR');
            return {
                isValid: false,
                error: `Data fora do período permitido. Permitido: de ${minDateStr} até hoje`,
                details: {
                    minDate: minDate,
                    maxDate: now,
                    providedDate: dateOnly,
                    numeroDias: config.numero_dias
                }
            };
        }

        // Date is valid
        return {
            isValid: true,
            error: null,
            details: {
                minDate: minDate,
                maxDate: now,
                unlocked: false
            }
        };

    } catch (error) {
        console.error('Error validating date:', error);
        return {
            isValid: false,
            error: 'Erro ao validar data',
            details: { originalError: error.message }
        };
    }
}

/**
 * Check if unlock is currently active for a project
 * @param {number} projectId - The project ID
 * @returns {Promise<{isUnlocked: boolean, expiresAt: Date|null}>}
 */
async function checkUnlockStatus(projectId) {
    try {
        const [settings] = await db.query(
            'SELECT unlock_expires_at FROM system_settings WHERE project_id = ?',
            [projectId]
        );

        if (settings.length === 0 || !settings[0].unlock_expires_at) {
            return { isUnlocked: false, expiresAt: null };
        }

        const unlockExpires = new Date(settings[0].unlock_expires_at);
        const now = new Date();

        if (unlockExpires > now) {
            return { isUnlocked: true, expiresAt: unlockExpires };
        }

        return { isUnlocked: false, expiresAt: null };
    } catch (error) {
        console.error('Error checking unlock status:', error);
        return { isUnlocked: false, expiresAt: null };
    }
}

module.exports = {
    validateDateWithinRange,
    checkUnlockStatus
};
