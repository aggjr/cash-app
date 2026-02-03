const mysql = require('mysql2/promise');

/**
 * Script to rename project from "Projeto de Ariana" to "Projeto do Juri"
 * This script can be executed directly on Easypanel
 */

async function renameProject() {
    let connection;

    try {
        // Database connection configuration
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'cash_db'
        });

        console.log('✅ Connected to database');

        // Check current project name
        const [currentProjects] = await connection.query(
            `SELECT id, name FROM projects WHERE name LIKE '%Ariana%'`
        );

        if (currentProjects.length === 0) {
            console.log('⚠️  No project found with "Ariana" in the name');
            console.log('📋 Listing all projects:');
            const [allProjects] = await connection.query('SELECT id, name FROM projects');
            allProjects.forEach(p => console.log(`   - ID ${p.id}: ${p.name}`));
            return;
        }

        console.log(`\n📋 Found ${currentProjects.length} project(s) to rename:`);
        currentProjects.forEach(p => console.log(`   - ID ${p.id}: ${p.name}`));

        // Rename the project
        const [result] = await connection.query(
            `UPDATE projects SET name = ? WHERE name LIKE ?`,
            ['Projeto do Juri', '%Ariana%']
        );

        console.log(`\n✅ Successfully renamed ${result.affectedRows} project(s)`);

        // Verify the change
        const [updatedProjects] = await connection.query(
            `SELECT id, name FROM projects WHERE name = ?`,
            ['Projeto do Juri']
        );

        console.log('\n✅ Verification - Updated project:');
        updatedProjects.forEach(p => console.log(`   - ID ${p.id}: ${p.name}`));

    } catch (error) {
        console.error('❌ Error renaming project:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n✅ Database connection closed');
        }
    }
}

// Execute the script
renameProject()
    .then(() => {
        console.log('\n🎉 Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });
