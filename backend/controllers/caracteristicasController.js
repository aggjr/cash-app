const db = require('../config/database');

// Listar todas as características
exports.getAll = async (req, res) => {
    try {
        const [caracteristicas] = await db.execute(`
      SELECT 
        c.*,
        COUNT(DISTINCT gc.grupo_id) as total_grupos
      FROM caracteristicas c
      LEFT JOIN grupos_caracteristicas gc ON c.id = gc.caracteristica_id
      GROUP BY c.id
      ORDER BY c.nome
    `);

        res.json(caracteristicas);
    } catch (error) {
        console.error('Erro ao buscar características:', error);
        res.status(500).json({ error: 'Erro ao buscar características' });
    }
};

// Buscar característica por ID
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;

        const [caracteristicas] = await db.execute(
            'SELECT * FROM caracteristicas WHERE id = ?',
            [id]
        );

        if (caracteristicas.length === 0) {
            return res.status(404).json({ error: 'Característica não encontrada' });
        }

        res.json(caracteristicas[0]);
    } catch (error) {
        console.error('Erro ao buscar característica:', error);
        res.status(500).json({ error: 'Erro ao buscar característica' });
    }
};

// Criar nova característica
exports.create = async (req, res) => {
    try {
        const { nome, descricao } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const [result] = await db.execute(
            'INSERT INTO caracteristicas (nome, descricao) VALUES (?, ?)',
            [nome, descricao || null]
        );

        const [novaCaracteristica] = await db.execute(
            'SELECT * FROM caracteristicas WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json(novaCaracteristica[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Já existe uma característica com este nome' });
        }
        console.error('Erro ao criar característica:', error);
        res.status(500).json({ error: 'Erro ao criar característica' });
    }
};

// Atualizar característica
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const [result] = await db.execute(
            'UPDATE caracteristicas SET nome = ?, descricao = ? WHERE id = ?',
            [nome, descricao || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Característica não encontrada' });
        }

        const [caracteristicaAtualizada] = await db.execute(
            'SELECT * FROM caracteristicas WHERE id = ?',
            [id]
        );

        res.json(caracteristicaAtualizada[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Já existe uma característica com este nome' });
        }
        console.error('Erro ao atualizar característica:', error);
        res.status(500).json({ error: 'Erro ao atualizar característica' });
    }
};

// Deletar característica
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se está em uso
        const [grupos] = await db.execute(
            'SELECT COUNT(*) as total FROM grupos_caracteristicas WHERE caracteristica_id = ?',
            [id]
        );

        if (grupos[0].total > 0) {
            return res.status(409).json({
                error: `Esta característica está sendo usada por ${grupos[0].total} grupo(s). Remova-a dos grupos antes de deletar.`
            });
        }

        const [result] = await db.execute(
            'DELETE FROM caracteristicas WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Característica não encontrada' });
        }

        res.json({ message: 'Característica deletada com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar característica:', error);
        res.status(500).json({ error: 'Erro ao deletar característica' });
    }
};

// Buscar grupos que usam esta característica
exports.getGrupos = async (req, res) => {
    try {
        const { id } = req.params;

        const [grupos] = await db.execute(`
      SELECT g.*
      FROM grupos_leads g
      INNER JOIN grupos_caracteristicas gc ON g.id = gc.grupo_id
      WHERE gc.caracteristica_id = ?
      ORDER BY g.nome
    `, [id]);

        res.json(grupos);
    } catch (error) {
        console.error('Erro ao buscar grupos da característica:', error);
        res.status(500).json({ error: 'Erro ao buscar grupos' });
    }
};
