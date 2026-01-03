const db = require('./backend/config/database');

async function checkTables() {
    try {
        console.log('Checking tables...');
        const [tables] = await db.query('SHOW TABLES');
        console.log('Tables:', tables.map(t => Object.values(t)[0]));

        console.log('\nChecking projects structure:');
        try {
            const [projectsCols] = await db.query('DESCRIBE projects');
            console.log(projectsCols);
        } catch (e) { console.log('projects table error:', e.message); }

        console.log('\nChecking project_users structure:');
        try {
            const [puCols] = await db.query('DESCRIBE project_users');
            console.log(puCols);
        } catch (e) { console.log('project_users table error:', e.message); }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkTables();
