require('dotenv').config();

console.log('========================================');
console.log('Environment Variables Check');
console.log('========================================');
console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET (will use: localhost)');
console.log('DB_PORT:', process.env.DB_PORT || 'NOT SET (will use: 3306)');
console.log('DB_USER:', process.env.DB_USER || 'NOT SET (will use: root)');
console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET (will use: cash_db)');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET');
console.log('========================================');
