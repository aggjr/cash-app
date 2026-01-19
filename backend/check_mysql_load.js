try {
    require('mysql2');
    console.log('MySQL2 module loaded successfully.');
    process.exit(0);
} catch (e) {
    console.error('Failed to load MySQL2:', e.message);
    process.exit(1);
}
