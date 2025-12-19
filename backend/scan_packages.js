const fs = require('fs');
const path = require('path');

function findPackageJson(dir) {
    let results = [];
    try {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(findPackageJson(file));
            } else {
                if (file.endsWith('package.json')) {
                    results.push(file);
                }
            }
        });
    } catch (e) {
        // Ignore permission errors etc
    }
    return results;
}

const root = path.join(__dirname, 'node_modules');
console.log('Scanning ' + root + ' ...');
const files = findPackageJson(root);

console.log('Found ' + files.length + ' package.json files. Validating...');

files.forEach(f => {
    try {
        const content = fs.readFileSync(f, 'utf8');
        JSON.parse(content);
    } catch (e) {
        console.error('INVALID JSON:', f);
        console.error(e.message);
    }
});

console.log('Done.');
