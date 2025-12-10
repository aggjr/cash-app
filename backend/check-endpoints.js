const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const API_URL = 'http://localhost:3001/api';

async function checkEndpoints() {
    let connection;
    try {
        console.log('1. Configuring...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

        // Get user for token
        const [users] = await connection.query('SELECT * FROM users LIMIT 1');
        const [projects] = await connection.query('SELECT id FROM projects LIMIT 1');

        if (!users.length) process.exit(1);

        const user = users[0];
        const projectId = projects[0].id;

        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
        const token = jwt.sign(
            { id: user.id, email: user.email, currentProject: { id: projectId } },
            JWT_SECRET
        );

        const config = { headers: { Authorization: `Bearer ${token}` } };

        console.log('2. Testing /api/tipo_entrada...');
        try {
            const res1 = await axios.get(`${API_URL}/tipo_entrada`, config);
            console.log(`   ✅ Status: ${res1.status}, Items: ${res1.data.length}`);
        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`, e.response?.data);
        }

        console.log(`3. Testing /api/companies?projectId=${projectId}...`);
        try {
            const res2 = await axios.get(`${API_URL}/companies?projectId=${projectId}`, config);
            console.log(`   ✅ Status: ${res2.status}, Items: ${res2.data.length}`);
        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`, e.response?.data);
        }

        console.log(`4. Testing /api/accounts?projectId=${projectId}...`);
        try {
            const res3 = await axios.get(`${API_URL}/accounts?projectId=${projectId}`, config);
            console.log(`   ✅ Status: ${res3.status}, Items: ${res3.data.length}`);
        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`, e.response?.data);
        }

    } catch (error) {
        console.error('Setup failed:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

checkEndpoints();
