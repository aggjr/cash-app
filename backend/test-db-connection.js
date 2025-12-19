const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
    console.log('\n========================================');
    console.log('🔍 Testing Database Connection');
    console.log('========================================\n');

    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        connectTimeout: 10000 // 10 seconds
    };

    console.log('Configuration:');
    console.log(`  Host: ${config.host}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  User: ${config.user}`);
    console.log(`  Password: ${config.password ? '***' + config.password.slice(-3) : 'NOT SET'}`);
    console.log(`  Database: ${process.env.DB_NAME || 'cash_db'}\n`);

    try {
        console.log('Step 1: Testing connection to MySQL server...');
        const connection = await mysql.createConnection(config);
        console.log('✅ Connected to MySQL server successfully!\n');

        console.log('Step 2: Checking if database exists...');
        const [databases] = await connection.query('SHOW DATABASES');
        const dbExists = databases.some(db => db.Database === (process.env.DB_NAME || 'cash_db'));

        if (dbExists) {
            console.log(`✅ Database '${process.env.DB_NAME || 'cash_db'}' exists!\n`);
        } else {
            console.log(`❌ Database '${process.env.DB_NAME || 'cash_db'}' does NOT exist!`);
            console.log('Available databases:');
            databases.forEach(db => console.log(`  - ${db.Database}`));
            console.log('\n💡 Creating database...');
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'cash_db'}\``);
            console.log(`✅ Database '${process.env.DB_NAME || 'cash_db'}' created!\n`);
        }

        console.log('Step 3: Testing connection to the specific database...');
        await connection.changeUser({ database: process.env.DB_NAME || 'cash_db' });
        console.log('✅ Connected to database successfully!\n');

        console.log('Step 4: Checking tables...');
        const [tables] = await connection.query('SHOW TABLES');
        if (tables.length > 0) {
            console.log(`✅ Found ${tables.length} tables:`);
            tables.forEach(table => {
                const tableName = Object.values(table)[0];
                console.log(`  - ${tableName}`);
            });
        } else {
            console.log('⚠️  No tables found. Database needs to be initialized.');
        }

        await connection.end();

        console.log('\n========================================');
        console.log('✅ All tests passed!');
        console.log('========================================\n');

    } catch (error) {
        console.log('\n========================================');
        console.log('❌ Connection test FAILED!');
        console.log('========================================\n');
        console.log('Error details:');
        console.log(`  Code: ${error.code}`);
        console.log(`  Message: ${error.message}`);
        console.log(`  SQL State: ${error.sqlState || 'N/A'}\n`);

        if (error.code === 'ETIMEDOUT') {
            console.log('💡 Troubleshooting tips for ETIMEDOUT:');
            console.log('  1. Try changing DB_HOST to 127.0.0.1 instead of localhost');
            console.log('  2. Check if MySQL is listening on port 3306');
            console.log('  3. Verify firewall is not blocking the connection');
            console.log('  4. Check if MySQL is configured to accept connections\n');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('💡 Troubleshooting tips for ACCESS DENIED:');
            console.log('  1. Verify DB_PASSWORD in .env file is correct');
            console.log('  2. Check if user has proper permissions');
            console.log('  3. Try connecting with MySQL Workbench to verify credentials\n');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('💡 Troubleshooting tips for CONNECTION REFUSED:');
            console.log('  1. Verify MySQL service is running');
            console.log('  2. Check if MySQL is listening on the correct port');
            console.log('  3. Try: Get-Service MySQL80 (PowerShell)\n');
        }

        process.exit(1);
    }
}

testConnection();
