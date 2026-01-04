const db = require('../config/database');
const { logAudit } = require('../utils/auditLogger');

// Get settings for a project
const getSettings = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const projectId = req.user.projectId;

        const [settings] = await connection.query(
            'SELECT * FROM system_settings WHERE project_id = ?',
            [projectId]
        );

        if (settings.length === 0) {
            // Initialize default settings if not exists
            await connection.query(
                'INSERT INTO system_settings (project_id, numero_dias, tempo_minutos_liberacao, iva_timeout, iva_voice_premium, iva_voice_male) VALUES (?, 3, 5, 2, 2, 0)',
                [projectId]
            );

            return res.json({
                id: null,
                project_id: projectId,
                numero_dias: 3,
                tempo_minutos_liberacao: 5,
                iva_timeout: 2,
                iva_voice_premium: 2,  // Premium as default
                iva_voice_male: 0,      // Female as default
                unlock_expires_at: null
            });
        }

        res.json(settings[0]);
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    } finally {
        connection.release();
    }
};

// Update a single setting field
const updateSetting = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const projectId = req.user.projectId;
        const { field } = req.params;
        const { value } = req.body;

        // Check if field is allowed
        const allowedFields = ['numero_dias', 'tempo_minutos_liberacao', 'iva_timeout', 'iva_voice_rate', 'iva_voice_premium', 'iva_voice_male'];
        if (!allowedFields.includes(field)) {
            return res.status(400).json({ error: 'Campo não permitido' });
        }

        let numValue = value;
        if (field !== 'iva_voice_premium' && field !== 'iva_voice_male') {
            numValue = parseInt(value);
            if (isNaN(numValue)) {
                return res.status(400).json({ error: 'Valor deve ser um número' });
            }
        }

        // Validate iva_timeout (1-10 seconds)
        if (field === 'iva_timeout') {
            const timeoutValue = parseInt(value);
            if (isNaN(timeoutValue) || timeoutValue < 1 || timeoutValue > 10) {
                return res.status(400).json({ error: 'iva_timeout deve estar entre 1 e 10 segundos' });
            }
        }

        // Validate iva_voice_premium (0, 1, or 2)
        if (field === 'iva_voice_premium') {
            if (![0, 1, 2].includes(numValue)) {
                return res.status(400).json({ error: 'iva_voice_premium deve ser 0 (gratuita), 1 (standard) ou 2 (premium)' });
            }
        }

        // Validate iva_voice_male (0 or 1)
        if (field === 'iva_voice_male') {
            if (![0, 1].includes(numValue)) {
                return res.status(400).json({ error: 'iva_voice_male deve ser 0 (feminina) ou 1 (masculina)' });
            }
        }

        // Special validation for iva_voice_rate (-100 to +100)
        if (field === 'iva_voice_rate') {
            if (numValue < -100 || numValue > 100) {
                return res.status(400).json({ error: 'Velocidade da voz deve estar entre -100% e +100%' });
            }
        }
        else if (field !== 'iva_voice_premium' && field !== 'iva_voice_male') { // Only apply positive check to numeric fields that are not voice settings
            // Other fields must be positive
            if (numValue <= 0) {
                return res.status(400).json({ error: 'Valor deve ser um número positivo' });
            }
        }

        // Update the specific field
        const valueToSave = (field === 'iva_voice_type' || field === 'iva_voice_gender') ? value : numValue;

        await connection.query(
            `UPDATE system_settings SET ${field} = ? WHERE project_id = ?`,
            [valueToSave, projectId]
        );

        // Return updated settings
        const [settings] = await connection.query(
            'SELECT * FROM system_settings WHERE project_id = ?',
            [projectId]
        );

        res.json(settings[0]);
        logAudit(req, 'UPDATE', 'system_settings', null, { field, value: valueToSave });
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ error: 'Erro ao atualizar configuração' });
    } finally {
        connection.release();
    }
};

// Activate temporary unlock
const activateTemporaryUnlock = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const projectId = req.user.projectId;

        // Get current settings
        const [settings] = await connection.query(
            'SELECT tempo_minutos_liberacao FROM system_settings WHERE project_id = ?',
            [projectId]
        );

        if (settings.length === 0) {
            return res.status(404).json({ error: 'Configurações não encontradas' });
        }

        const minutes = settings[0].tempo_minutos_liberacao;

        // Calculate expiration time
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + minutes);

        // Update unlock expiration
        await connection.query(
            'UPDATE system_settings SET unlock_expires_at = ? WHERE project_id = ?',
            [expiresAt, projectId]
        );

        res.json({
            success: true,
            message: `Edições liberadas por ${minutes} minutos`,
            expires_at: expiresAt,
            minutes: minutes
        });
        logAudit(req, 'UPDATE', 'system_settings', null, { action: 'UNLOCK_EDITING', minutes });
    } catch (error) {
        console.error('Error activating unlock:', error);
        res.status(500).json({ error: 'Erro ao ativar liberação temporária' });
    } finally {
        connection.release();
    }
}; // Close activateTemporaryUnlock

// Cancel temporary unlock
const cancelTemporaryUnlock = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const projectId = req.user.projectId;

        // Clear unlock expiration (set to NULL)
        await connection.query(
            'UPDATE system_settings SET unlock_expires_at = NULL WHERE project_id = ?',
            [projectId]
        );

        res.json({
            success: true,
            message: 'Liberação temporária cancelada. Sistema retornou ao modo normal'
        });
        logAudit(req, 'UPDATE', 'system_settings', null, { action: 'LOCK_EDITING' });
    } catch (error) {
        console.error('Error canceling unlock:', error);
        res.status(500).json({ error: 'Erro ao cancelar liberação temporária' });
    } finally {
        connection.release();
    }
};

// Check unlock status
const checkUnlockStatus = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const projectId = req.user.projectId;

        const [settings] = await connection.query(
            'SELECT unlock_expires_at FROM system_settings WHERE project_id = ?',
            [projectId]
        );

        if (settings.length === 0) {
            return res.json({ unlocked: false });
        }

        const expiresAt = settings[0].unlock_expires_at;
        const now = new Date();

        if (expiresAt && new Date(expiresAt) > now) {
            const remainingMs = new Date(expiresAt) - now;
            const remainingMinutes = Math.ceil(remainingMs / 60000);

            return res.json({
                unlocked: true,
                expires_at: expiresAt,
                remaining_minutes: remainingMinutes
            });
        }

        res.json({ unlocked: false });
    } catch (error) {
        console.error('Error checking unlock status:', error);
        res.status(500).json({ error: 'Erro ao verificar status de liberação' });
    } finally {
        connection.release();
    }
};

module.exports = {
    getSettings,
    updateSetting,
    activateTemporaryUnlock,
    cancelTemporaryUnlock,
    checkUnlockStatus
};

