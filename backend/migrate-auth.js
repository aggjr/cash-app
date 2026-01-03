require('dotenv').config();
const db = require('./config/database');
const bcrypt = require('bcryptjs');

async function run() {
    try {
        console.log('Starting Auth Migration...');

        // 1. Create Users Table
        console.log('Creating users table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Create Projects Table
        console.log('Creating projects table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                owner_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 3. Create Project Users Table (Many-to-Many)
        console.log('Creating project_users table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS project_users (
                project_id INT NOT NULL,
                user_id INT NOT NULL,
                role ENUM('master', 'user') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (project_id, user_id),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 4. Add project_id to existing tables
        const dataTables = ['tipo_entrada', 'tipo_saida', 'tipo_producao_revenda'];

        for (const table of dataTables) {
            console.log(`Checking ${table} for project_id...`);
            try {
                await db.query(`ALTER TABLE ${table} ADD COLUMN project_id INT`);
                console.log(`Added project_id to ${table}`);

                // Add FK constraint (optional but good practice, might fail if data exists without project)
                // We will skip FK for now to avoid issues with existing data, 
                // but we should assign a default project later if needed.
            } catch (error) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    console.log(`project_id already exists in ${table}`);
                } else {
                    throw error;
                }
            }
        }

        console.log('Migration completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

run();
