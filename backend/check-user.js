const db = require('./config/database');
const bcrypt = require('bcryptjs');

async function checkUser() {
    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', ['agomes@foccusgestao.com.br']);
        console.log('User found:', users.length > 0);
        if (users.length > 0) {
            console.log('User ID:', users[0].id);
            // check password 'senha12345678'
            // const match = await bcrypt.compare('senha12345678', users[0].password);
            // console.log('Password match:', match);

            // Check project_users
            const [projects] = await db.query('SELECT * FROM project_users WHERE user_id = ?', [users[0].id]);
            console.log('Projects:', projects.length);

            if (projects.length > 0) {
                const hashedPassword = await bcrypt.hash('senha12345678', 10);
                await db.query('UPDATE project_users SET password = ? WHERE user_id = ?', [hashedPassword, users[0].id]);
                console.log('Password reset for all projects.');
            } else {
                console.log('User has no projects. Creating one...');
                const hashedPassword = await bcrypt.hash('senha12345678', 10);
                const [projResult] = await db.query('INSERT INTO projects (name) VALUES (?)', ['Empresa Teste']);
                const projectId = projResult.insertId;
                await db.query('INSERT INTO project_users (user_id, project_id, role, password) VALUES (?, ?, ?, ?)', [users[0].id, projectId, 'master', hashedPassword]);
                console.log('Project created and user linked.');
            }
        } else {
            console.log('Creating new user...');
            const hashedPassword = await bcrypt.hash('senha12345678', 10);
            const [result] = await db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', ['Augusto Gomes', 'agomes@foccusgestao.com.br', hashedPassword]);
            const userId = result.insertId;
            console.log('User created with ID:', userId);

            // Create project
            const [projResult] = await db.query('INSERT INTO projects (name) VALUES (?)', ['Empresa Teste']);
            const projectId = projResult.insertId;
            console.log('Project created with ID:', projectId);

            // Link
            await db.query('INSERT INTO project_users (user_id, project_id, role, password) VALUES (?, ?, ?, ?)', [userId, projectId, 'master', hashedPassword]);
            console.log('User linked to project.');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        // db.end(); // process exit handles it
        process.exit();
    }
}

checkUser();
