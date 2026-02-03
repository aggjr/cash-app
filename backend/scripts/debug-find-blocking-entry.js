const db = require('../config/database');

async function debugBlockingEntries() {
    try {
        console.log('--- Starting Search for Blocking Entries ---');

        // 1. Find the 'tipo_entrada' id for "Ariana (Inativo)"
        // Using LIKE to be safe with exact spelling
        const [types] = await db.query(
            'SELECT * FROM tipo_entrada WHERE label LIKE "%Ariana%"'
        );

        if (types.length === 0) {
            console.log('No tipo_entrada found with name containing "Ariana"');
            process.exit(0);
        }

        console.log(`Found ${types.length} candidate types:`);
        types.forEach(t => console.log(` - ID: ${t.id}, Label: "${t.label}", Active: ${t.active}, ProjectId: ${t.project_id}`));

        // 2. For each found type, check for referencing 'entradas'
        for (const type of types) {
            console.log(`\nChecking usages for Type ID: ${type.id} (${type.label})...`);

            const [entries] = await db.query(
                `SELECT e.id, e.descricao, e.valor, e.data_fato, e.active, p.name as project_name 
                 FROM entradas e 
                 JOIN projects p ON e.project_id = p.id
                 WHERE e.tipo_entrada_id = ?`,
                [type.id]
            );

            if (entries.length > 0) {
                console.log(`FOUND ${entries.length} referencing entries in 'entradas' table:`);
                entries.forEach(e => {
                    console.log(`  > Entry ID: ${e.id} | Desc: "${e.descricao}" | Val: ${e.valor} | Date: ${e.data_fato} | Active: ${e.active} | Project: ${e.project_name}`);
                });
            } else {
                console.log('  > No referencing entries found in "entradas".');
            }

            // Also check if it is a parent to other types (though CASCADE should handle this, good to verify)
            const [children] = await db.query(
                'SELECT * FROM tipo_entrada WHERE parent_id = ?',
                [type.id]
            );
            if (children.length > 0) {
                console.log(`  > WARNING: Used as parent by ${children.length} other types (IDs: ${children.map(c => c.id).join(', ')}).`);
            }
        }

        console.log('\n--- End of Search ---');
        process.exit(0);

    } catch (error) {
        console.error('Error in debug script:', error);
        process.exit(1);
    }
}

debugBlockingEntries();
