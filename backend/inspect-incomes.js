const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const API_URL = 'http://localhost:3001/api';

async function checkIds() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

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

        const res = await axios.get(`${API_URL}/incomes?projectId=${projectId}`, config);
        if (res.data.length > 0) {
            console.log('Sample Data:');
            console.log('data_fato:', res.data[0].data_fato, 'Type:', typeof res.data[0].data_fato);
            console.log('data_prevista:', res.data[0].data_prevista_pagamento);
            console.log('data_real:', res.data[0].data_real_pagamento);
        } else {
            console.log('No incomes found.');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

checkIds();
