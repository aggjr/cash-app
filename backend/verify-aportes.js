const db = require('./config/database');
const { createAporte, updateAporte, deleteAporte, listAportes } = require('./controllers/aporteController');

async function verify() {
    try {
        console.log('--- Verifying Aportes Operations ---');

        const [projects] = await db.query("SELECT id FROM projects LIMIT 1");
        if (!projects.length) throw new Error("No projects found");
        const projectId = projects[0].id;

        const [companies] = await db.query("SELECT id FROM empresas LIMIT 1");
        if (!companies.length) throw new Error("No companies found");
        const companyId = companies[0].id;

        // Create Account
        const accName = `Aporte Test Acc ${Date.now()}`;
        const [accRes] = await db.query("INSERT INTO contas (name, company_id, project_id, initial_balance, current_balance) VALUES (?, ?, ?, 0, 0)", [accName, companyId, projectId]);
        const accountId = accRes.insertId;
        console.log(`Created Account: ${accountId}`);

        // Mock Req/Res helpers
        const mockRes = (label) => ({
            json: (data) => console.log(`${label} JSON:`, JSON.stringify(data, null, 2)),
            status: (code) => ({ json: (data) => console.log(`${label} ${code}:`, JSON.stringify(data, null, 2)) })
        });
        const next = (e) => console.error('Error:', e);

        // 1. CREATE APORTE
        const amount = 500.00;
        const date = new Date().toISOString().substring(0, 10);
        console.log(`Creating Aporte of ${amount}...`);

        let createdId;
        const reqCreate = { body: { dataFato: date, valor: amount, descricao: 'Initial Injection', companyId, accountId, projectId } };
        const resCreate = {
            status: (code) => ({
                json: (data) => {
                    createdId = data.id;
                    console.log(`Created Aporte ID: ${createdId}`);
                }
            })
        };
        await createAporte(reqCreate, resCreate, next);

        // Verify Balance
        const [accAfterCreate] = await db.query("SELECT current_balance FROM contas WHERE id = ?", [accountId]);
        console.log(`Balance after Create: ${accAfterCreate[0].current_balance} (Expected: 500)`);

        // 2. LIST APORTES
        console.log('Listing Aportes...');
        const reqList = { query: { projectId } };
        await listAportes(reqList, mockRes('List'), next);

        // 3. UPDATE APORTE (Increase value)
        const newAmount = 1000.00; // Increase by 500
        console.log(`Updating Aporte to ${newAmount}...`);
        const reqUpdate = { params: { id: createdId }, body: { valor: newAmount } };
        await updateAporte(reqUpdate, mockRes('Update'), next);

        // Verify Balance
        const [accAfterUpdate] = await db.query("SELECT current_balance FROM contas WHERE id = ?", [accountId]);
        console.log(`Balance after Update: ${accAfterUpdate[0].current_balance} (Expected: 1000)`);

        // 4. DELETE APORTE
        console.log('Deleting Aporte...');
        const reqDelete = { params: { id: createdId } };
        await deleteAporte(reqDelete, mockRes('Delete'), next);

        // Verify Balance
        const [accAfterDelete] = await db.query("SELECT current_balance FROM contas WHERE id = ?", [accountId]);
        console.log(`Balance after Delete: ${accAfterDelete[0].current_balance} (Expected: 0)`);

        console.log('--- Verification Done ---');

    } catch (e) {
        console.error('Verification Failed:', e);
    }
    process.exit();
}

verify();
