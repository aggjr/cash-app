const db = require('../config/database');

// Listar todas as campanhas
exports.getAll = async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
      SELECT 
        c.*,
        COUNT(DISTINCT lc.lead_id) as total_leads,
        COUNT(DISTINCT gc.grupo_id) as total_grupos
      FROM campanhas c
      LEFT JOIN leads_campanhas lc ON c.id = lc.campanha_id
      LEFT JOIN grupos_campanhas gc ON c.id = gc.campanha_id
    `;

        if (status) {
            query += ' WHERE c.status = ?';
        }

        query += ' GROUP BY c.id ORDER BY c.created_at DESC';

        const params = status ? [status] : [];
        const [campanhas] = await db.query(query, params);

        res.json(campanhas);
    } catch (error) {
        console.error('Erro ao buscar campanhas:', error);
        res.status(500).json({ error: 'Erro ao buscar campanhas' });
    }
};

// Buscar campanha por ID
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;

        const [campanhas] = await db.query(`
      SELECT 
        c.*,
        COUNT(DISTINCT lc.lead_id) as total_leads,
        COUNT(DISTINCT gc.grupo_id) as total_grupos
      FROM campanhas c
      LEFT JOIN leads_campanhas lc ON c.id = lc.campanha_id
      LEFT JOIN grupos_campanhas gc ON c.id = gc.campanha_id
      WHERE c.id = ?
      GROUP BY c.id
    `, [id]);

        if (campanhas.length === 0) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        res.json(campanhas[0]);
    } catch (error) {
        console.error('Erro ao buscar campanha:', error);
        res.status(500).json({ error: 'Erro ao buscar campanha' });
    }
};

// Criar nova campanha
exports.create = async (req, res) => {
    try {
        const { nome, descricao, dataInicio, dataFim, status } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const validStatuses = ['planejamento', 'ativa', 'pausada', 'concluida', 'cancelada'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        const [result] = await db.query(
            'INSERT INTO campanhas (nome, descricao, data_inicio, data_fim, status) VALUES (?, ?, ?, ?, ?)',
            [nome, descricao || null, dataInicio || null, dataFim || null, status || 'planejamento']
        );

        const [novaCampanha] = await db.query(
            'SELECT * FROM campanhas WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json(novaCampanha[0]);
    } catch (error) {
        console.error('Erro ao criar campanha:', error);
        res.status(500).json({ error: 'Erro ao criar campanha' });
    }
};

// Atualizar campanha
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, dataInicio, dataFim, status } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const validStatuses = ['planejamento', 'ativa', 'pausada', 'concluida', 'cancelada'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        const [result] = await db.query(
            'UPDATE campanhas SET nome = ?, descricao = ?, data_inicio = ?, data_fim = ?, status = ? WHERE id = ?',
            [nome, descricao || null, dataInicio || null, dataFim || null, status || 'planejamento', id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        const [campanhaAtualizada] = await db.query(
            'SELECT * FROM campanhas WHERE id = ?',
            [id]
        );

        res.json(campanhaAtualizada[0]);
    } catch (error) {
        console.error('Erro ao atualizar campanha:', error);
        res.status(500).json({ error: 'Erro ao atualizar campanha' });
    }
};

// Deletar campanha
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            'DELETE FROM campanhas WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        res.json({ message: 'Campanha deletada com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar campanha:', error);
        res.status(500).json({ error: 'Erro ao deletar campanha' });
    }
};

// Listar grupos associados à campanha
exports.getGrupos = async (req, res) => {
    try {
        const { id } = req.params;

        const [grupos] = await db.query(`
      SELECT 
        g.*,
        COUNT(DISTINCT l.id) as total_leads
      FROM grupos_leads g
      INNER JOIN grupos_campanhas gc ON g.id = gc.grupo_id
      LEFT JOIN leads l ON g.id = l.grupo_id
      WHERE gc.campanha_id = ?
      GROUP BY g.id
      ORDER BY g.nome
    `, [id]);

        res.json(grupos);
    } catch (error) {
        console.error('Erro ao buscar grupos da campanha:', error);
        res.status(500).json({ error: 'Erro ao buscar grupos' });
    }
};

// Associar grupo à campanha
exports.associarGrupo = async (req, res) => {
    try {
        const { id } = req.params;
        const { grupoId } = req.body;

        if (!grupoId) {
            return res.status(400).json({ error: 'grupoId é obrigatório' });
        }

        await db.query(
            'INSERT INTO grupos_campanhas (grupo_id, campanha_id) VALUES (?, ?)',
            [grupoId, id]
        );

        res.status(201).json({ message: 'Grupo associado à campanha com sucesso' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Grupo já está associado a esta campanha' });
        }
        console.error('Erro ao associar grupo:', error);
        res.status(500).json({ error: 'Erro ao associar grupo' });
    }
};

// Desassociar grupo da campanha
exports.desassociarGrupo = async (req, res) => {
    try {
        const { id, grupoId } = req.params;

        const [result] = await db.query(
            'DELETE FROM grupos_campanhas WHERE grupo_id = ? AND campanha_id = ?',
            [grupoId, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Associação não encontrada' });
        }

        res.json({ message: 'Grupo desassociado da campanha com sucesso' });
    } catch (error) {
        console.error('Erro ao desassociar grupo:', error);
        res.status(500).json({ error: 'Erro ao desassociar grupo' });
    }
};

// Listar leads da campanha
exports.getLeads = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.query;

        let query = `
      SELECT 
        l.*,
        g.nome as grupo_nome,
        lc.status as status_campanha,
        lc.observacoes as observacoes_campanha,
        lc.data_associacao
      FROM leads l
      INNER JOIN leads_campanhas lc ON l.id = lc.lead_id
      LEFT JOIN grupos_leads g ON l.grupo_id = g.id
      WHERE lc.campanha_id = ?
    `;

        const params = [id];

        if (status) {
            query += ' AND lc.status = ?';
            params.push(status);
        }

        query += ' ORDER BY l.nome';

        const [leads] = await db.query(query, params);

        res.json(leads);
    } catch (error) {
        console.error('Erro ao buscar leads da campanha:', error);
        res.status(500).json({ error: 'Erro ao buscar leads' });
    }
};

// Estatísticas da campanha
exports.getEstatisticas = async (req, res) => {
    try {
        const { id } = req.params;

        const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_leads,
        SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as pendentes,
        SUM(CASE WHEN status = 'contatado' THEN 1 ELSE 0 END) as contatados,
        SUM(CASE WHEN status = 'respondeu' THEN 1 ELSE 0 END) as responderam,
        SUM(CASE WHEN status = 'converteu' THEN 1 ELSE 0 END) as convertidos,
        SUM(CASE WHEN status = 'rejeitou' THEN 1 ELSE 0 END) as rejeitados
      FROM leads_campanhas
      WHERE campanha_id = ?
    `, [id]);

        res.json(stats[0]);
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
};
