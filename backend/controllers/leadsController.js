const db = require('../config/database');

// Listar todos os leads
exports.getAll = async (req, res) => {
    try {
        const { grupoId, campanhaId } = req.query;

        // Base Query with joins for N:N Grupos and Caracteristicas
        let query = `
      SELECT 
        l.*,
        GROUP_CONCAT(DISTINCT gl.nome SEPARATOR ' | ') as grupos_nomes,
        GROUP_CONCAT(DISTINCT gl.id) as grupos_ids,
        GROUP_CONCAT(DISTINCT c.nome SEPARATOR ' | ') as caracteristicas_nomes,
        GROUP_CONCAT(DISTINCT c.id) as caracteristicas_ids,
        COUNT(DISTINCT lc.campanha_id) as total_campanhas
      FROM leads l
      LEFT JOIN leads_grupos lg ON l.id = lg.lead_id
      LEFT JOIN grupos_leads gl ON lg.grupo_id = gl.id
      LEFT JOIN leads_caracteristicas lcar ON l.id = lcar.lead_id
      LEFT JOIN caracteristicas c ON lcar.caracteristica_id = c.id
      LEFT JOIN leads_campanhas lc ON l.id = lc.lead_id
    `;

        const conditions = [];
        const params = [];

        if (grupoId) {
            // Filter by existing relationship in leads_grupos
            conditions.push('l.id IN (SELECT lead_id FROM leads_grupos WHERE grupo_id = ?)');
            params.push(grupoId);
        }

        if (campanhaId) {
            conditions.push('lc.campanha_id = ?');
            params.push(campanhaId);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY l.id ORDER BY l.nome';

        const [leads] = await db.query(query, params);

        // Parse IDs/Nomes string to arrays if needed, but here we keep as rows for frontend
        // Frontend expects "grupos_ids" string or we parse it? 
        // LeadModal expects arrays. We can map it here or in frontend.
        // Let's parse generated strings into real arrays for clean API
        const leadsParsed = leads.map(lead => ({
            ...lead,
            grupos: lead.grupos_ids ? lead.grupos_ids.split(',').map(Number) : [],
            // grupos_nomes passed as string "A | B" is what user requested for display
            caracteristicas: lead.caracteristicas_ids ? lead.caracteristicas_ids.split(',').map(Number) : []
        }));

        res.json(leadsParsed);
    } catch (error) {
        console.error('Erro ao buscar leads:', error);
        res.status(500).json({ error: 'Erro ao buscar leads', details: error.message, sqlMessage: error.sqlMessage });
    }
};

// Buscar lead por ID
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;

        // Use same logic as getAll but filtered
        const [leads] = await db.query(`
      SELECT 
        l.*,
        GROUP_CONCAT(DISTINCT gl.nome SEPARATOR ' | ') as grupos_nomes,
        GROUP_CONCAT(DISTINCT gl.id) as grupos_ids,
        GROUP_CONCAT(DISTINCT c.nome SEPARATOR ' | ') as caracteristicas_nomes,
        GROUP_CONCAT(DISTINCT c.id) as caracteristicas_ids
      FROM leads l
      LEFT JOIN leads_grupos lg ON l.id = lg.lead_id
      LEFT JOIN grupos_leads gl ON lg.grupo_id = gl.id
      LEFT JOIN leads_caracteristicas lcar ON l.id = lcar.lead_id
      LEFT JOIN caracteristicas c ON lcar.caracteristica_id = c.id
      WHERE l.id = ?
      GROUP BY l.id
    `, [id]);

        if (leads.length === 0) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        // Buscar campanhas associadas (Detail view)
        const [campanhas] = await db.query(`
      SELECT 
        c.*,
        lc.status as status_lead,
        lc.observacoes as observacoes_lead,
        lc.data_associacao
      FROM campanhas c
      INNER JOIN leads_campanhas lc ON c.id = lc.campanha_id
      WHERE lc.lead_id = ?
    `, [id]);

        const lead = leads[0];
        lead.campanhas = campanhas;
        lead.grupos = lead.grupos_ids ? lead.grupos_ids.split(',').map(Number) : [];
        lead.caracteristicas = lead.caracteristicas_ids ? lead.caracteristicas_ids.split(',').map(Number) : [];

        res.json(lead);
    } catch (error) {
        console.error('Erro ao buscar lead:', error);
        res.status(500).json({ error: 'Erro ao buscar lead' });
    }
};

// Criar novo lead
exports.create = async (req, res) => {
    try {
        const { nome, email, telefone, grupos, caracteristicas, observacoes } = req.body;
        // grupos, caracteristicas expect array of IDs

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        if (email && !isValidEmail(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        // 1. Insert Lead
        const [result] = await db.query(
            'INSERT INTO leads (nome, email, telefone, observacoes) VALUES (?, ?, ?, ?)',
            [nome, email || null, telefone || null, observacoes || null]
        );

        const leadId = result.insertId;

        // 2. Insert Groups
        if (Array.isArray(grupos) && grupos.length > 0) {
            const grupoValues = grupos.map(gid => [leadId, gid]);
            await db.query('INSERT INTO leads_grupos (lead_id, grupo_id) VALUES ?', [grupoValues]);
        }

        // 3. Insert Characteristics
        if (Array.isArray(caracteristicas) && caracteristicas.length > 0) {
            const charValues = caracteristicas.map(cid => [leadId, cid]);
            await db.query('INSERT INTO leads_caracteristicas (lead_id, caracteristica_id) VALUES ?', [charValues]);
        }

        // Fetch created item
        res.status(201).json({ id: leadId, message: 'Lead criado com sucesso' });
    } catch (error) {
        console.error('Erro ao criar lead:', error);
        res.status(500).json({ error: 'Erro ao criar lead' });
    }
};

// Atualizar lead
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, email, telefone, grupos, caracteristicas, observacoes } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        if (email && !isValidEmail(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        // 1. Update Basic Info
        const [result] = await db.query(
            'UPDATE leads SET nome = ?, email = ?, telefone = ?, observacoes = ? WHERE id = ?',
            [nome, email || null, telefone || null, observacoes || null, id]
        );

        if (result.affectedRows === 0) {
            // Check existence logic could be here, but usually affectedRows=0 means ID not found if update didn't change values?
            // Actually 'UPDATE keys on match' can return 0 if values same.
            // Check existence explicitly if paranoid, or just assume success/not-found.
            const [check] = await db.query('SELECT id FROM leads WHERE id = ?', [id]);
            if (check.length === 0) return res.status(404).json({ error: 'Lead não encontrado' });
        }

        // 2. Update Groups (Sync Strategy: Delete All + Insert New)
        await db.query('DELETE FROM leads_grupos WHERE lead_id = ?', [id]);
        if (Array.isArray(grupos) && grupos.length > 0) {
            const grupoValues = grupos.map(gid => [id, gid]);
            await db.query('INSERT INTO leads_grupos (lead_id, grupo_id) VALUES ?', [grupoValues]);
        }

        // 3. Update Characteristics
        await db.query('DELETE FROM leads_caracteristicas WHERE lead_id = ?', [id]);
        if (Array.isArray(caracteristicas) && caracteristicas.length > 0) {
            const charValues = caracteristicas.map(cid => [id, cid]);
            await db.query('INSERT INTO leads_caracteristicas (lead_id, caracteristica_id) VALUES ?', [charValues]);
        }

        res.json({ message: 'Lead atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar lead:', error);
        res.status(500).json({ error: 'Erro ao atualizar lead' });
    }
};

// Deletar lead
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            'DELETE FROM leads WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        res.json({ message: 'Lead deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar lead:', error);
        res.status(500).json({ error: 'Erro ao deletar lead' });
    }
};

// Associar lead a campanha
exports.associarCampanha = async (req, res) => {
    try {
        const { id } = req.params;
        const { campanhaId, status, observacoes } = req.body;

        if (!campanhaId) {
            return res.status(400).json({ error: 'campanhaId é obrigatório' });
        }

        await db.query(
            'INSERT INTO leads_campanhas (lead_id, campanha_id, status, observacoes) VALUES (?, ?, ?, ?)',
            [id, campanhaId, status || 'pendente', observacoes || null]
        );

        res.status(201).json({ message: 'Lead associado à campanha com sucesso' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Lead já está associado a esta campanha' });
        }
        console.error('Erro ao associar lead à campanha:', error);
        res.status(500).json({ error: 'Erro ao associar lead' });
    }
};

// Desassociar lead de campanha
exports.desassociarCampanha = async (req, res) => {
    try {
        const { id, campanhaId } = req.params;

        const [result] = await db.query(
            'DELETE FROM leads_campanhas WHERE lead_id = ? AND campanha_id = ?',
            [id, campanhaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Associação não encontrada' });
        }

        res.json({ message: 'Lead desassociado da campanha com sucesso' });
    } catch (error) {
        console.error('Erro ao desassociar lead:', error);
        res.status(500).json({ error: 'Erro ao desassociar lead' });
    }
};

// Atualizar status do lead em uma campanha
exports.atualizarStatusCampanha = async (req, res) => {
    try {
        const { id, campanhaId } = req.params;
        const { status, observacoes } = req.body;

        const validStatuses = ['pendente', 'contatado', 'respondeu', 'converteu', 'rejeitou'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        const [result] = await db.query(
            'UPDATE leads_campanhas SET status = ?, observacoes = ? WHERE lead_id = ? AND campanha_id = ?',
            [status, observacoes || null, id, campanhaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Associação não encontrada' });
        }

        res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
};

// Função auxiliar para validar email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}
