const db = require('../config/database');
const AppError = require('../utils/AppError');

/**
 * Get a specific preference for the current user
 */
exports.getPreference = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { key } = req.params;

        const [rows] = await db.query(
            'SELECT preference_value FROM user_preferences WHERE user_id = ? AND preference_key = ?',
            [userId, key]
        );

        if (rows.length === 0) {
            return res.json({ value: null });
        }

        res.json({ value: rows[0].preference_value });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all preferences for the current user
 */
exports.getAllPreferences = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const [rows] = await db.query(
            'SELECT preference_key, preference_value FROM user_preferences WHERE user_id = ?',
            [userId]
        );

        const preferences = {};
        rows.forEach(row => {
            preferences[row.preference_key] = row.preference_value;
        });

        res.json(preferences);
    } catch (error) {
        next(error);
    }
};

/**
 * Set/update a preference for the current user
 */
exports.setPreference = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { key } = req.params;
        const { value } = req.body;

        if (value === undefined) {
            throw new AppError('VAL-002', 'Preference value is required');
        }

        // Use INSERT ... ON DUPLICATE KEY UPDATE for upsert
        await db.query(
            `INSERT INTO user_preferences (user_id, preference_key, preference_value) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE preference_value = ?, updated_at = CURRENT_TIMESTAMP`,
            [userId, key, JSON.stringify(value), JSON.stringify(value)]
        );

        res.json({
            message: 'Preference saved successfully',
            key,
            value
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a specific preference
 */
exports.deletePreference = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { key } = req.params;

        await db.query(
            'DELETE FROM user_preferences WHERE user_id = ? AND preference_key = ?',
            [userId, key]
        );

        res.json({ message: 'Preference deleted successfully' });
    } catch (error) {
        next(error);
    }
};
