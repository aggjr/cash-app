const db = require('../config/database');

// Listar todas as características
exports.getAll = async (req, res) => {
    try {
        const [caracteristicas] = await db.query(`
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

        const [caracteristicas] = await db.query(
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
        const { nome, descricao, valores } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const [result] = await db.query(
            'INSERT INTO caracteristicas (nome, descricao) VALUES (?, ?)',
            [nome, descricao || null]
        );

        const newId = result.insertId;

        // Insert values if present
        if (valores && Array.isArray(valores) && valores.length > 0) {
            const valuesSql = 'INSERT INTO caracteristica_valores (caracteristica_id, valor) VALUES ?';
            const valuesData = valores.map(v => [newId, v.valor]); // v is {valor: 'x'} from frontend
            await db.query(valuesSql, [valuesData]);
        }

        const [novaCaracteristica] = await db.query(
            'SELECT * FROM caracteristicas WHERE id = ?',
            [newId]
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

        const [result] = await db.query(
            'UPDATE caracteristicas SET nome = ?, descricao = ? WHERE id = ?',
            [nome, descricao || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Característica não encontrada' });
        }

        const [caracteristicaAtualizada] = await db.query(
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
        const [grupos] = await db.query(
            'SELECT COUNT(*) as total FROM grupos_caracteristicas WHERE caracteristica_id = ?',
            [id]
        );

        if (grupos[0].total > 0) {
            return res.status(409).json({
                error: `Esta característica está sendo usada por ${grupos[0].total} grupo(s). Remova-a dos grupos antes de deletar.`
            });
        }

        const [result] = await db.query(
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

        const [grupos] = await db.query(`
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

// --- VALORES ---

// Listar valores de uma característica
exports.getValues = async (req, res) => {
    try {
        const { id } = req.params;
        const [valores] = await db.query(
            'SELECT * FROM caracteristica_valores WHERE caracteristica_id = ? ORDER BY ordem, valor',
            [id]
        );
        res.json(valores);
    } catch (error) {
        console.error('Erro ao buscar valores:', error);
        res.status(500).json({ error: 'Erro ao buscar valores' });
    }
};

// Adicionar valor
exports.addValue = async (req, res) => {
    try {
        const { id } = req.params;
        const { valor } = req.body;

        if (!valor) return res.status(400).json({ error: 'Valor é obrigatório' });

        const [result] = await db.query(
            'INSERT INTO caracteristica_valores (caracteristica_id, valor) VALUES (?, ?)',
            [id, valor]
        );

        res.status(201).json({ id: result.insertId, caracteristica_id: id, valor });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Este valor já existe para esta característica' });
        }
        console.error('Erro ao adicionar valor:', error);
        res.status(500).json({ error: 'Erro ao adicionar valor' });
    }
};

// Remover valor
exports.removeValue = async (req, res) => {
    try {
        const { id } = req.params; // ID do valor
        await db.query('DELETE FROM caracteristica_valores WHERE id = ?', [id]);
        res.json({ message: 'Valor removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover valor:', error);
        res.status(500).json({ error: 'Erro ao remover valor' });
    }
};
