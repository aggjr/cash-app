/**
 * EVA Tracking Routes
 * Endpoints for tracking user interactions with EVA and screens
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

/**
 * POST /api/eva/track-navigation
 * Track when user navigates to a screen
 * Increments familiarity counter
 */
router.post('/track-navigation', auth, async (req, res) => {
    try {
        const { screen } = req.body;
        const userId = req.user.id;

        if (!screen) {
            return res.status(400).json({ error: 'Screen ID required' });
        }

        console.log(`[EVA Tracking] User ${userId} navigated to ${screen}`);

        // Get current familiarity
        const [users] = await db.query(
            'SELECT eva_screen_familiarity FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        let familiarity = users[0].eva_screen_familiarity || {};

        // Increment counter for this screen
        familiarity[screen] = (familiarity[screen] || 0) + 1;

        // Update in DB
        await db.query(
            'UPDATE users SET eva_screen_familiarity = ? WHERE id = ?',
            [JSON.stringify(familiarity), userId]
        );

        console.log(`[EVA Tracking] Updated familiarity: ${screen} = ${familiarity[screen]}`);

        res.json({
            success: true,
            familiarity: familiarity[screen]
        });

    } catch (error) {
        console.error('[EVA Tracking] Error:', error);
        res.status(500).json({ error: 'Failed to track navigation' });
    }
});

module.exports = router;
