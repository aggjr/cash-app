const db = require('./config/database');
const { getExtrato } = require('./controllers/extratoController');

async function verify() {
    try {
        console.log('--- Verifying Extrato Transfer Logic ---');

        const [projects] = await db.query("SELECT id FROM projects LIMIT 1");
        if (!projects.length) throw new Error("No projects found");
        const projectId = projects[0].id;

        const [companies] = await db.query("SELECT id FROM empresas LIMIT 1");
        if (!companies.length) throw new Error("No companies found");
        const companyId = companies[0].id;

        // Create 2 fake accounts
        const acc1Name = `Test Acc 1 ${Date.now()}`;
        const acc2Name = `Test Acc 2 ${Date.now()}`;

        // Correct columns for contas: name, company_id, project_id, initial_balance usually defaults to 0 if not provided
        const [res1] = await db.query("INSERT INTO contas (name, company_id, project_id) VALUES (?, ?, ?)", [acc1Name, companyId, projectId]);
        const acc1Id = res1.insertId;

        const [res2] = await db.query("INSERT INTO contas (name, company_id, project_id) VALUES (?, ?, ?)", [acc2Name, companyId, projectId]);
        const acc2Id = res2.insertId;

        console.log(`Created Accounts: ${acc1Id} -> ${acc2Id}`);

        // Create Transfer (Retirada from Acc1 to Acc2)
        const amount = 100.00;
        const date = new Date().toISOString().substring(0, 10);

        await db.query(`
            INSERT INTO retiradas (data_fato, data_real, valor, descricao, company_id, account_id, destination_account_id, project_id)
            VALUES (?, ?, ?, 'Transfer Test', ?, ?, ?, ?)
        `, [date, date, amount, companyId, acc1Id, acc2Id, projectId]);

        console.log('Created Transfer');

        // 2. Query Extrato for Acc 1 (Source) -> Should be OUT (Transferência (Saída))
        const req1 = { query: { projectId, accountId: acc1Id, startDate: date, endDate: date } };
        const res1Mock = {
            json: (data) => {
                const tx = data.transactions[0];
                if (tx && tx.direction === 'OUT' && tx.tipo === 'Transferência (Saída)') {
                    console.log('PASS: Acc 1 (Source) is OUT / Transferência (Saída)');
                } else {
                    console.log('FAIL: Acc 1 (Source) - ', JSON.stringify(tx));
                }
            },
            status: (c) => ({ json: (d) => console.error('Error:', c, d) })
        };
        await getExtrato(req1, res1Mock);

        // 3. Query Extrato for Acc 2 (Destination) -> Should be IN (Transferência (Entrada))
        const req2 = { query: { projectId, accountId: acc2Id, startDate: date, endDate: date } };
        const res2Mock = {
            json: (data) => {
                const tx = data.transactions.find(t => t.tipo === 'Transferência (Entrada)');
                if (tx && tx.direction === 'IN') {
                    console.log('PASS: Acc 2 (Dest) is IN / Transferência (Entrada)');
                } else {
                    console.log('FAIL: Acc 2 (Dest) - ', JSON.stringify(data.transactions));
                }
            },
            status: (c) => ({ json: (d) => console.error('Error:', c, d) })
        };
        await getExtrato(req2, res2Mock);

        console.log('--- Verification Done ---');

    } catch (e) {
        console.error('Verification Failed:', e);
    }
    process.exit();
}

verify();
