const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const API_URL = 'http://localhost:3001/api';

async function checkIncomes() {
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

        console.log(`✅ Fetched ${res.data.length} incomes`);
        if (res.data.length > 0) {
            console.log('Sample Item:');
            console.log(' - Tipo Entrada:', res.data[0].tipo_entrada_name);
            console.log(' - Descricao:', res.data[0].descricao);
        } else {
            console.log('No data to verify structure.');
        }

    } catch (error) {
        console.error('Check failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    } finally {
        if (connection) await connection.end();
    }
}

checkIncomes();
