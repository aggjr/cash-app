const express = require('express');
const router = express.Router();
const db = require('../config/database');

// DEBUG ENDPOINT - Remove this in production!
router.get('/database', async (req, res) => {
    try {
        console.log('=== DEBUG DATABASE ENDPOINT CALLED ===');

        // Get all users
        const [users] = await db.query('SELECT id, name, email, is_active, created_at FROM users');

        // Get all projects
        const [projects] = await db.query('SELECT * FROM projects');

        // Get all project_users
        const [projectUsers] = await db.query('SELECT project_id, user_id, role, created_at FROM project_users');

        // Get the JOIN that login uses
        const [loginQuery] = await db.query(`
            SELECT 
                u.id as user_id,
                u.email,
                u.name as user_name,
                p.id as project_id,
                p.name as project_name,
                pu.role
            FROM users u
            JOIN project_users pu ON u.id = pu.user_id
            JOIN projects p ON pu.project_id = p.id
        `);

        res.json({
            timestamp: new Date(),
            database: process.env.DB_NAME || 'cash',
            tables: {
                users: {
                    count: users.length,
                    data: users
                },
                projects: {
                    count: projects.length,
                    data: projects
                },
                project_users: {
                    count: projectUsers.length,
                    data: projectUsers
                },
                login_join_result: {
                    count: loginQuery.length,
                    data: loginQuery
                }
            }
        });
    } catch (error) {
        console.error('=== DEBUG ENDPOINT ERROR ===', error);
        res.status(500).json({
            error: error.message,
            code: error.code,
            sql: error.sql
        });
    }
});

module.exports = router;
