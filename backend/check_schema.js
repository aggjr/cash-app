const db = require('./config/database');

const checkSchema = async () => {
    try {
        const [rows] = await db.execute('DESCRIBE project_users');
        console.log('Schema of project_users:');
        console.table(rows);
    } catch (error) {
        console.error('Error describing table:', error);
    } finally {
        process.exit();
    }
};

checkSchema();
