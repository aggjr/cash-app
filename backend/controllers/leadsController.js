const db = require('../config/database');

// Listar todos os leads
exports.getAll = async (req, res) => {
    try {
        const { grupoId, campanhaId } = req.query;

        let query = `
      SELECT 
        l.*,
        g.nome as grupo_nome,
        COUNT(DISTINCT lc.campanha_id) as total_campanhas
      FROM leads l
      LEFT JOIN grupos_leads g ON l.grupo_id = g.id
      LEFT JOIN leads_campanhas lc ON l.id = lc.lead_id
    `;

        const conditions = [];
        const params = [];

        if (grupoId) {
            conditions.push('l.grupo_id = ?');
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

        const [leads] = await db.execute(query, params);

        res.json(leads);
    } catch (error) {
        console.error('Erro ao buscar leads:', error);
        res.status(500).json({ error: 'Erro ao buscar leads' });
    }
};

// Buscar lead por ID
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;

        const [leads] = await db.execute(`
      SELECT 
        l.*,
        g.nome as grupo_nome
      FROM leads l
      LEFT JOIN grupos_leads g ON l.grupo_id = g.id
      WHERE l.id = ?
    `, [id]);

        if (leads.length === 0) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        // Buscar campanhas associadas
        const [campanhas] = await db.execute(`
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

        res.json(lead);
    } catch (error) {
        console.error('Erro ao buscar lead:', error);
        res.status(500).json({ error: 'Erro ao buscar lead' });
    }
};

// Criar novo lead
exports.create = async (req, res) => {
    try {
        const { nome, email, telefone, grupoId, observacoes } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        // Validar email se fornecido
        if (email && !isValidEmail(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        const [result] = await db.execute(
            'INSERT INTO leads (nome, email, telefone, grupo_id, observacoes) VALUES (?, ?, ?, ?, ?)',
            [nome, email || null, telefone || null, grupoId || null, observacoes || null]
        );

        const [novoLead] = await db.execute(
            'SELECT * FROM leads WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json(novoLead[0]);
    } catch (error) {
        console.error('Erro ao criar lead:', error);
        res.status(500).json({ error: 'Erro ao criar lead' });
    }
};

// Atualizar lead
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, email, telefone, grupoId, observacoes } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        // Validar email se fornecido
        if (email && !isValidEmail(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        const [result] = await db.execute(
            'UPDATE leads SET nome = ?, email = ?, telefone = ?, grupo_id = ?, observacoes = ? WHERE id = ?',
            [nome, email || null, telefone || null, grupoId || null, observacoes || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        const [leadAtualizado] = await db.execute(
            'SELECT * FROM leads WHERE id = ?',
            [id]
        );

        res.json(leadAtualizado[0]);
    } catch (error) {
        console.error('Erro ao atualizar lead:', error);
        res.status(500).json({ error: 'Erro ao atualizar lead' });
    }
};

// Deletar lead
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.execute(
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

        await db.execute(
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

        const [result] = await db.execute(
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

        const [result] = await db.execute(
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
