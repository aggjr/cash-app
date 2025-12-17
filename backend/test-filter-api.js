const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const API_URL = 'http://localhost:3001/api';

async function testFilter() {
    let connection;
    try {
        // 1. Authenticate
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cash_db'
        });

        const [users] = await connection.query('SELECT * FROM users LIMIT 1');
        const [projects] = await connection.query('SELECT id FROM projects WHERE id = 4 LIMIT 1');
        const user = users[0];
        const projectId = 4; // Force Project 4 as seen in user screenshot

        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
        const token = jwt.sign({ id: user.id, email: user.email, currentProject: { id: projectId } }, JWT_SECRET);

        // 2. Call API with GT 500 filter
        console.log('\n--- TESTING GT 500 FILTER ---');
        // Params mimicking what frontend sends: filter_valor_op=gt, filter_valor_val=500
        const url = `${API_URL}/incomes?projectId=${projectId}&filter_valor_op=gt&filter_valor_val=500`;
        console.log(`URL: ${url}`);

        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

        console.log(`Status: ${res.status}`);
        console.log(`Count: ${res.data.data.length}`);

        if (res.data.data.length > 0) {
            console.log('Returned values:');
            res.data.data.forEach(item => {
                console.log(`- R$ ${item.valor} (Is Number? ${typeof item.valor})`);
            });

            // Validation
            const invalid = res.data.data.filter(i => parseFloat(i.valor) <= 500);
            if (invalid.length > 0) {
                console.error('❌ FAILED: Found values <= 500!');
                invalid.forEach(i => console.error(`  - ${i.valor}`));
            } else {
                console.log('✅ PASSED: All values are > 500');
            }
        } else {
            console.log('⚠️ No data returned. Cannot verify filtering logic.');
            // Let's verify if there IS data > 500 in DB
            const [rows] = await connection.query('SELECT valor FROM entradas WHERE project_id = ? AND valor > 500', [projectId]);
            console.log(`DB Count of > 500: ${rows.length}`);
            if (rows.length > 0) {
                console.error('❌ FAILED: DB has data > 500 but API returned none!');
            }
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) console.error(error.response.data);
    } finally {
        if (connection) await connection.end();
    }
}

testFilter();
