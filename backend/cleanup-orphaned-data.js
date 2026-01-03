const db = require('./config/database');

async function cleanOrphanedData() {
    console.log('🧹 Cleaning orphaned data from project_users...');

    try {
        const connection = await db.getConnection();

        // Delete project_users entries where user doesn't exist
        const [orphanedUsers] = await connection.query(`
            DELETE pu FROM project_users pu
            LEFT JOIN users u ON pu.user_id = u.id
            WHERE u.id IS NULL
        `);
        console.log(`✅ Cleaned ${orphanedUsers.affectedRows} orphaned user references`);

        // Delete project_users entries where project doesn't exist
        const [orphanedProjects] = await connection.query(`
            DELETE pu FROM project_users pu
            LEFT JOIN projects p ON pu.project_id = p.id
            WHERE p.id IS NULL
        `);
        console.log(`✅ Cleaned ${orphanedProjects.affectedRows} orphaned project references`);

        connection.release();
        console.log('✅ Orphaned data cleanup completed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error cleaning orphaned data:', error);
        process.exit(1);
    }
}

cleanOrphanedData();
