const db = require('../config/database');

// Função auxiliar para buscar características de um grupo (incluindo herdadas)
async function getCaracteristicasComHeranca(grupoId, visitados = new Set()) {
    if (visitados.has(grupoId)) return [];
    visitados.add(grupoId);

    const caracteristicas = new Map();

    // Características diretas do grupo
    const [diretas] = await db.query(`
    SELECT c.*, 'direto' as origem
    FROM caracteristicas c
    INNER JOIN grupos_caracteristicas gc ON c.id = gc.caracteristica_id
    WHERE gc.grupo_id = ?
  `, [grupoId]);

    diretas.forEach(c => caracteristicas.set(c.id, c));

    // Características herdadas dos grupos-pai (recursivo)
    const [pais] = await db.query(`
    SELECT grupo_pai_id
    FROM grupos_composicao
    WHERE grupo_filho_id = ?
  `, [grupoId]);

    for (const pai of pais) {
        const herdadas = await getCaracteristicasComHeranca(pai.grupo_pai_id, visitados);
        herdadas.forEach(c => {
            if (!caracteristicas.has(c.id)) {
                caracteristicas.set(c.id, { ...c, origem: 'herdado' });
            }
        });
    }

    return Array.from(caracteristicas.values());
}

// Função auxiliar para expandir árvore de grupos e obter todos os leads
async function expandirGrupoRecursivo(grupoId, visitados = new Set()) {
    if (visitados.has(grupoId)) return { leads: [], subgrupos: [] };
    visitados.add(grupoId);

    const resultado = {
        leads: [],
        subgrupos: []
    };

    // Leads diretos
    const [leadsDiretos] = await db.query(
        'SELECT * FROM leads WHERE grupo_id = ?',
        [grupoId]
    );
    resultado.leads.push(...leadsDiretos);

    // Subgrupos
    const [subgrupos] = await db.query(`
    SELECT g.*
    FROM grupos_leads g
    INNER JOIN grupos_composicao gc ON g.id = gc.grupo_filho_id
    WHERE gc.grupo_pai_id = ?
  `, [grupoId]);

    resultado.subgrupos.push(...subgrupos);

    // Expandir recursivamente cada subgrupo
    for (const subgrupo of subgrupos) {
        const subResultado = await expandirGrupoRecursivo(subgrupo.id, visitados);
        resultado.leads.push(...subResultado.leads);
        resultado.subgrupos.push(...subResultado.subgrupos);
    }

    return resultado;
}

// Listar todos os grupos
exports.getAll = async (req, res) => {
    try {
        const { treeView } = req.query;

        const [grupos] = await db.query(`
      SELECT 
        g.*,
        COUNT(DISTINCT l.id) as total_leads_diretos,
        COUNT(DISTINCT gc.caracteristica_id) as total_caracteristicas,
        COUNT(DISTINCT gf.grupo_filho_id) as total_subgrupos
      FROM grupos_leads g
      LEFT JOIN leads l ON g.id = l.grupo_id
      LEFT JOIN grupos_caracteristicas gc ON g.id = gc.grupo_id
      LEFT JOIN grupos_composicao gf ON g.id = gf.grupo_pai_id
      GROUP BY g.id
      ORDER BY g.nome
    `);

        // Se tree view, organizar em hierarquia
        if (treeView === 'true') {
            // Buscar grupos raiz (que não são filhos de ninguém)
            const [raizes] = await db.query(`
        SELECT DISTINCT g.id
        FROM grupos_leads g
        LEFT JOIN grupos_composicao gc ON g.id = gc.grupo_filho_id
        WHERE gc.id IS NULL
      `);

            const raizIds = raizes.map(r => r.id);
            const arvore = grupos.filter(g => raizIds.includes(g.id));

            // Adicionar subgrupos recursivamente
            for (const grupo of arvore) {
                grupo.subgrupos = await getSubgruposRecursivo(grupo.id);
            }

            return res.json(arvore);
        }

        res.json(grupos);
    } catch (error) {
        console.error('Erro ao buscar grupos:', error);
        res.status(500).json({ error: 'Erro ao buscar grupos' });
    }
};

async function getSubgruposRecursivo(grupoId) {
    const [subgrupos] = await db.query(`
    SELECT 
      g.*,
      COUNT(DISTINCT l.id) as total_leads_diretos,
      COUNT(DISTINCT gc.caracteristica_id) as total_caracteristicas
    FROM grupos_leads g
    INNER JOIN grupos_composicao gcomp ON g.id = gcomp.grupo_filho_id
    LEFT JOIN leads l ON g.id = l.grupo_id
    LEFT JOIN grupos_caracteristicas gc ON g.id = gc.grupo_id
    WHERE gcomp.grupo_pai_id = ?
    GROUP BY g.id
    ORDER BY g.nome
  `, [grupoId]);

    for (const subgrupo of subgrupos) {
        subgrupo.subgrupos = await getSubgruposRecursivo(subgrupo.id);
    }

    return subgrupos;
}

// Buscar grupo por ID
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;

        const [grupos] = await db.query(`
      SELECT 
        g.*,
        COUNT(DISTINCT l.id) as total_leads_diretos,
        COUNT(DISTINCT gc.caracteristica_id) as total_caracteristicas,
        COUNT(DISTINCT gf.grupo_filho_id) as total_subgrupos
      FROM grupos_leads g
      LEFT JOIN leads l ON g.id = l.grupo_id
      LEFT JOIN grupos_caracteristicas gc ON g.id = gc.grupo_id
      LEFT JOIN grupos_composicao gf ON g.id = gf.grupo_pai_id
      WHERE g.id = ?
      GROUP BY g.id
    `, [id]);

        if (grupos.length === 0) {
            return res.status(404).json({ error: 'Grupo não encontrado' });
        }

        res.json(grupos[0]);
    } catch (error) {
        console.error('Erro ao buscar grupo:', error);
        res.status(500).json({ error: 'Erro ao buscar grupo' });
    }
};

// Buscar grupos por características
exports.buscarPorCaracteristicas = async (req, res) => {
    try {
        const { caracteristicas } = req.query; // Array de IDs de características

        if (!caracteristicas || !Array.isArray(caracteristicas) || caracteristicas.length === 0) {
            return res.status(400).json({ error: 'Forneça ao menos uma característica' });
        }

        const placeholders = caracteristicas.map(() => '?').join(',');

        // Buscar grupos que têm TODAS as características especificadas
        const [grupos] = await db.query(`
      SELECT 
        g.*,
        COUNT(DISTINCT l.id) as total_leads_diretos,
        COUNT(DISTINCT gc.caracteristica_id) as total_caracteristicas_grupo
      FROM grupos_leads g
      INNER JOIN grupos_caracteristicas gc ON g.id = gc.grupo_id
      LEFT JOIN leads l ON g.id = l.grupo_id
      WHERE gc.caracteristica_id IN (${placeholders})
      GROUP BY g.id
      HAVING COUNT(DISTINCT gc.caracteristica_id) = ?
      ORDER BY g.nome
    `, [...caracteristicas, caracteristicas.length]);

        res.json(grupos);
    } catch (error) {
        console.error('Erro ao buscar grupos por características:', error);
        res.status(500).json({ error: 'Erro ao buscar grupos' });
    }
};

// Obter árvore completa do grupo
exports.getArvore = async (req, res) => {
    try {
        const { id } = req.params;

        const [grupo] = await db.query('SELECT * FROM grupos_leads WHERE id = ?', [id]);
        if (grupo.length === 0) {
            return res.status(404).json({ error: 'Grupo não encontrado' });
        }

        const arvore = await expandirGrupoRecursivo(parseInt(id));

        res.json({
            grupo: grupo[0],
            total_leads: arvore.leads.length,
            total_subgrupos: arvore.subgrupos.length,
            leads: arvore.leads,
            subgrupos: arvore.subgrupos
        });
    } catch (error) {
        console.error('Erro ao buscar árvore do grupo:', error);
        res.status(500).json({ error: 'Erro ao buscar árvore' });
    }
};

// Obter todos os leads expandidos (incluindo subgrupos)
exports.getLeadsExpandidos = async (req, res) => {
    try {
        const { id } = req.params;

        const arvore = await expandirGrupoRecursivo(parseInt(id));

        res.json({
            total: arvore.leads.length,
            leads: arvore.leads
        });
    } catch (error) {
        console.error('Erro ao buscar leads expandidos:', error);
        res.status(500).json({ error: 'Erro ao buscar leads' });
    }
};

// Criar novo grupo
exports.create = async (req, res) => {
    try {
        const { nome, descricao, caracteristicas } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const [result] = await db.query(
            'INSERT INTO grupos_leads (nome, descricao) VALUES (?, ?)',
            [nome, descricao || null]
        );

        const grupoId = result.insertId;

        // Adicionar características se fornecidas
        if (caracteristicas && Array.isArray(caracteristicas) && caracteristicas.length > 0) {
            const values = caracteristicas.map(cId => [grupoId, cId]);
            await db.query(
                'INSERT INTO grupos_caracteristicas (grupo_id, caracteristica_id) VALUES ?',
                [values]
            );
        }

        const [novoGrupo] = await db.query(
            'SELECT * FROM grupos_leads WHERE id = ?',
            [grupoId]
        );

        res.status(201).json(novoGrupo[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Já existe um grupo com este nome' });
        }
        console.error('Erro ao criar grupo:', error);
        res.status(500).json({ error: 'Erro ao criar grupo' });
    }
};

// Atualizar grupo
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, caracteristicas } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const [result] = await db.query(
            'UPDATE grupos_leads SET nome = ?, descricao = ? WHERE id = ?',
            [nome, descricao || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Grupo não encontrado' });
        }

        // Atualizar características se fornecidas
        if (caracteristicas && Array.isArray(caracteristicas)) {
            // Remover todas as características atuais
            await db.query('DELETE FROM grupos_caracteristicas WHERE grupo_id = ?', [id]);

            // Adicionar novas características
            if (caracteristicas.length > 0) {
                const values = caracteristicas.map(cId => [id, cId]);
                await db.query(
                    'INSERT INTO grupos_caracteristicas (grupo_id, caracteristica_id) VALUES ?',
                    [values]
                );
            }
        }

        const [grupoAtualizado] = await db.query(
            'SELECT * FROM grupos_leads WHERE id = ?',
            [id]
        );

        res.json(grupoAtualizado[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Já existe um grupo com este nome' });
        }
        console.error('Erro ao atualizar grupo:', error);
        res.status(500).json({ error: 'Erro ao atualizar grupo' });
    }
};

// Deletar grupo
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar se tem leads
        const [leads] = await db.query(
            'SELECT COUNT(*) as total FROM leads WHERE grupo_id = ?',
            [id]
        );

        if (leads[0].total > 0) {
            return res.status(409).json({
                error: `Este grupo contém ${leads[0].total} lead(s). Mova-os para outro grupo antes de deletar.`
            });
        }

        // Verificar se é pai de outros grupos
        const [subgrupos] = await db.query(
            'SELECT COUNT(*) as total FROM grupos_composicao WHERE grupo_pai_id = ?',
            [id]
        );

        if (subgrupos[0].total > 0) {
            return res.status(409).json({
                error: `Este grupo contém ${subgrupos[0].total} subgrupo(s). Remova-os antes de deletar.`
            });
        }

        const [result] = await db.query(
            'DELETE FROM grupos_leads WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Grupo não encontrado' });
        }

        res.json({ message: 'Grupo deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar grupo:', error);
        res.status(500).json({ error: 'Erro ao deletar grupo' });
    }
};

// Gerenciar características do grupo
exports.getCaracteristicas = async (req, res) => {
    try {
        const { id } = req.params;

        const caracteristicas = await getCaracteristicasComHeranca(parseInt(id));

        res.json(caracteristicas);
    } catch (error) {
        console.error('Erro ao buscar características:', error);
        res.status(500).json({ error: 'Erro ao buscar características' });
    }
};

exports.addCaracteristica = async (req, res) => {
    try {
        const { id } = req.params;
        const { caracteristicaId } = req.body;

        if (!caracteristicaId) {
            return res.status(400).json({ error: 'caracteristicaId é obrigatório' });
        }

        await db.query(
            'INSERT INTO grupos_caracteristicas (grupo_id, caracteristica_id) VALUES (?, ?)',
            [id, caracteristicaId]
        );

        res.status(201).json({ message: 'Característica adicionada com sucesso' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Esta característica já está associada ao grupo' });
        }
        console.error('Erro ao adicionar característica:', error);
        res.status(500).json({ error: 'Erro ao adicionar característica' });
    }
};

exports.removeCaracteristica = async (req, res) => {
    try {
        const { id, caracteristicaId } = req.params;

        const [result] = await db.query(
            'DELETE FROM grupos_caracteristicas WHERE grupo_id = ? AND caracteristica_id = ?',
            [id, caracteristicaId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Associação não encontrada' });
        }

        res.json({ message: 'Característica removida com sucesso' });
    } catch (error) {
        console.error('Erro ao remover característica:', error);
        res.status(500).json({ error: 'Erro ao remover característica' });
    }
};

// Gerenciar subgrupos
exports.getSubgrupos = async (req, res) => {
    try {
        const { id } = req.params;

        const [subgrupos] = await db.query(`
      SELECT g.*
      FROM grupos_leads g
      INNER JOIN grupos_composicao gc ON g.id = gc.grupo_filho_id
      WHERE gc.grupo_pai_id = ?
      ORDER BY g.nome
    `, [id]);

        res.json(subgrupos);
    } catch (error) {
        console.error('Erro ao buscar subgrupos:', error);
        res.status(500).json({ error: 'Erro ao buscar subgrupos' });
    }
};

exports.addSubgrupo = async (req, res) => {
    try {
        const { id } = req.params;
        const { grupoFilhoId } = req.body;

        if (!grupoFilhoId) {
            return res.status(400).json({ error: 'grupoFilhoId é obrigatório' });
        }

        // Verificar se não cria ciclo
        if (parseInt(id) === parseInt(grupoFilhoId)) {
            return res.status(400).json({ error: 'Um grupo não pode ser subgrupo de si mesmo' });
        }

        // TODO: Implementar verificação de ciclos mais profunda

        await db.query(
            'INSERT INTO grupos_composicao (grupo_pai_id, grupo_filho_id) VALUES (?, ?)',
            [id, grupoFilhoId]
        );

        res.status(201).json({ message: 'Subgrupo adicionado com sucesso' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Este grupo já é subgrupo' });
        }
        console.error('Erro ao adicionar subgrupo:', error);
        res.status(500).json({ error: 'Erro ao adicionar subgrupo' });
    }
};

exports.removeSubgrupo = async (req, res) => {
    try {
        const { id, grupoFilhoId } = req.params;

        const [result] = await db.query(
            'DELETE FROM grupos_composicao WHERE grupo_pai_id = ? AND grupo_filho_id = ?',
            [id, grupoFilhoId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Relacionamento não encontrado' });
        }

        res.json({ message: 'Subgrupo removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover subgrupo:', error);
        res.status(500).json({ error: 'Erro ao remover subgrupo' });
    }
};
