const db = require('../config/database');
const emailService = require('../services/emailService');
const evolutionService = require('../services/evolutionService');

// Listar todas as campanhas
// Listar todas as campanhas
exports.getAll = async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
      SELECT 
        c.*,
        COUNT(DISTINCT lc.lead_id) as total_leads,
        COUNT(CASE WHEN lc.status_email IS NOT NULL AND lc.status_email != 'pendente' THEN 1 END) + 
        COUNT(CASE WHEN lc.status_whatsapp IS NOT NULL AND lc.status_whatsapp != 'pendente' THEN 1 END) as leads_processados,
        COUNT(CASE WHEN lc.status_email = 'sucesso' THEN 1 END) as email_sucesso,
        COUNT(CASE WHEN lc.status_whatsapp = 'sucesso' THEN 1 END) as whatsapp_sucesso,
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
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        const { nome, descricao, dataInicio, dataFim, status, leadsIds, message } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const validStatuses = ['planejamento', 'ativa', 'pausada', 'concluida', 'cancelada'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        const emailSubject = message?.emailSubject || null;
        const emailBody = message?.emailBody || null;
        const whatsappText = message?.whatsappText || null;
        const mediaUrl = message?.mediaUrl || null;

        const [result] = await connection.query(
            'INSERT INTO campanhas (nome, descricao, data_inicio, data_fim, status, email_subject, email_body, whatsapp_text, media_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nome, descricao || null, dataInicio || null, dataFim || null, status || 'planejamento', emailSubject, emailBody, whatsappText, mediaUrl]
        );


        const campanhaId = result.insertId;

        // Associate Leads if provided
        if (Array.isArray(leadsIds) && leadsIds.length > 0) {
            const values = leadsIds.map(leadId => [leadId, campanhaId, 'pendente', null]);
            await connection.query(
                'INSERT INTO leads_campanhas (lead_id, campanha_id, status, observacoes) VALUES ?',
                [values]
            );
        }

        await connection.commit();
        connection.release();

        // Fetch created campaign
        const [novaCampanha] = await db.query(
            'SELECT * FROM campanhas WHERE id = ?',
            [campanhaId]
        );

        res.status(201).json(novaCampanha[0]);
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (e) { }
            try { connection.release(); } catch (e) { }
        }
        console.error('Erro ao criar campanha:', error);
        res.status(500).json({ error: 'Erro ao criar campanha: ' + error.message });
    }
};

// Atualizar campanha
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, dataInicio, dataFim, status, message } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const validStatuses = ['planejamento', 'ativa', 'pausada', 'concluida', 'cancelada'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        const emailSubject = message?.emailSubject || null;
        const emailBody = message?.emailBody || null;
        const whatsappText = message?.whatsappText || null;
        const mediaUrl = message?.mediaUrl || null;

        const [result] = await db.query(
            'UPDATE campanhas SET nome = ?, descricao = ?, data_inicio = ?, data_fim = ?, status = ?, email_subject = ?, email_body = ?, whatsapp_text = ?, media_url = ? WHERE id = ?',
            [nome, descricao || null, dataInicio || null, dataFim || null, status || 'planejamento', emailSubject, emailBody, whatsappText, mediaUrl, id]
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
        res.status(500).json({ error: 'Erro ao atualizar campanha: ' + error.message });
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

// Enviar campanha para um único lead
exports.sendSingle = async (req, res) => {
    try {
        const { id } = req.params; // Campaign IDs
        const { leadId, channel } = req.body;

        // 1. Fetch Campaign and Message
        const [campanhas] = await db.query('SELECT * FROM campanhas WHERE id = ?', [id]);
        if (campanhas.length === 0) return res.status(404).json({ error: 'Campanha não encontrada' });
        const campanha = campanhas[0];

        // 2. Fetch Lead
        const [leads] = await db.query('SELECT * FROM leads WHERE id = ?', [leadId]);
        if (leads.length === 0) return res.status(404).json({ error: 'Lead não encontrado' });
        const lead = leads[0];

        // 3. Process Dispatch
        const replaceVariables = (text) => {
            if (!text) return '';
            return text
                .replace(/{{nome}}/g, lead.nome)
                .replace(/{{empresa}}/g, lead.empresa || '')
                .replace(/{{email}}/g, lead.email || '')
                .replace(/{{telefone}}/g, lead.telefone || '');
        };

        let success = false;
        let responseData = null;

        if (channel === 'email') {
            if (!campanha.email_subject || !campanha.email_body) {
                return res.status(400).json({ error: 'Conteúdo de e-mail não configurado' });
            }
            if (!lead.email) {
                return res.status(400).json({ error: 'Lead sem e-mail cadastrado' });
            }

            const subject = replaceVariables(campanha.email_subject);
            const html = replaceVariables(campanha.email_body); // Assuming body is HTML or text

            // Simple text-to-html conversion if needed, or assume text/html
            // For now assuming the editor saves HTML or raw text displayed in HTML
            // Replacing newlines with <br> if it looks like plain text
            let finalHtml = html.includes('<') ? html : html.replace(/\n/g, '<br>');

            // Embed Media if exists
            // REMOVED: Media is now embedded directly in email_body by the user.
            // if (campanha.media_url) { ... }

            await emailService.sendGenericEmail(lead.email, subject, finalHtml);
            success = true;
        } else if (channel === 'whatsapp') {
            if (!campanha.whatsapp_text) {
                return res.status(400).json({ error: 'Mensagem de WhatsApp não configurada' });
            }
            if (!lead.telefone) {
                return res.status(400).json({ error: 'Lead sem telefone cadastrado' });
            }


            const convertHtmlToWhatsapp = (html) => {
                if (!html) return '';
                let text = html;

                // Replace breaks/paragraphs with newlines
                text = text.replace(/<br\s*\/?>/gi, '\n');
                text = text.replace(/<\/p>/gi, '\n\n');
                text = text.replace(/<\/div>/gi, '\n');

                // Bold
                text = text.replace(/<(b|strong)>(.*?)<\/\1>/gi, '*$2*');

                // Italic
                text = text.replace(/<(i|em)>(.*?)<\/\1>/gi, '_$2_');

                // Strip all other tags
                text = text.replace(/<[^>]+>/g, '');

                // Decode entities (basic)
                text = text.replace(/&nbsp;/g, ' ');
                text = text.replace(/&amp;/g, '&');
                text = text.replace(/&lt;/g, '<');
                text = text.replace(/&gt;/g, '>');

                return text.trim();
            };

            // 1. Check for Embedded Media in Raw Text first (from new Unified Input)
            const imgMatch = campanha.whatsapp_text.match(/<img[^>]+src="([^">]+)"/);
            let fullMediaUrl = null;
            let mediatype = 'image';
            let rawText = campanha.whatsapp_text;

            if (imgMatch) {
                fullMediaUrl = imgMatch[1];
                // Remove the image tag from the text to be converted
                rawText = rawText.replace(/<img[^>]+>/g, '').trim();
            } else if (campanha.media_url) {
                // Fallback to legacy field
                const baseUrl = process.env.API_BASE_URL || 'https://cash.gutoapps.site';
                fullMediaUrl = campanha.media_url.startsWith('http') ? campanha.media_url : `${baseUrl}${campanha.media_url}`;
            }

            // 2. Convert Variables & HTML to WhatsApp Text
            const variablesReplaced = replaceVariables(rawText);
            const text = convertHtmlToWhatsapp(variablesReplaced); // This uses the helper above to strip tags

            // 3. Send
            // 3. Send
            let sentMedia = false;
            if (fullMediaUrl) {
                // Validate if it is really a URL
                try {
                    new URL(fullMediaUrl); // Throws if invalid

                    const isVideo = fullMediaUrl.match(/\.(mp4|mov|avi|wmv)$/i);
                    mediatype = isVideo ? 'video' : 'image';
                    console.log(`Sending WhatsApp Media: ${fullMediaUrl} (${mediatype})`);

                    await evolutionService.sendMedia(lead.telefone, fullMediaUrl, mediatype, text);
                    sentMedia = true;
                } catch (e) {
                    console.warn(`Invalid Media URL detected: ${fullMediaUrl}. Falling back to text message.`);
                    // Fallback to text
                }
            }

            if (!sentMedia) {
                await evolutionService.sendMessage(lead.telefone, text);
            }

            success = true;
        } else {
            return res.status(400).json({ error: 'Canal inválido' });
        }

        // 4. Update Status in leads_campanhas per channel
        if (success) {
            if (channel === 'email') {
                await db.query(
                    `INSERT INTO leads_campanhas (lead_id, campanha_id, status_email, data_contato) 
                     VALUES (?, ?, 'sucesso', NOW()) 
                     ON DUPLICATE KEY UPDATE status_email = 'sucesso', data_contato = NOW()`,
                    [leadId, id]
                );
            } else if (channel === 'whatsapp') {
                await db.query(
                    `INSERT INTO leads_campanhas (lead_id, campanha_id, status_whatsapp, data_contato) 
                     VALUES (?, ?, 'sucesso', NOW()) 
                     ON DUPLICATE KEY UPDATE status_whatsapp = 'sucesso', data_contato = NOW()`,
                    [leadId, id]
                );
            }
        }

        res.json({ success: true, channel });
    } catch (error) {
        console.error('Erro no disparo:', error);

        // Record failure in DB per channel
        try {
            if (channel === 'email') {
                await db.query(
                    `INSERT INTO leads_campanhas (lead_id, campanha_id, status_email, data_contato) 
                     VALUES (?, ?, 'falha', NOW()) 
                     ON DUPLICATE KEY UPDATE status_email = 'falha', data_contato = NOW()`,
                    [leadId, id]
                );
            } else if (channel === 'whatsapp') {
                await db.query(
                    `INSERT INTO leads_campanhas (lead_id, campanha_id, status_whatsapp, data_contato) 
                     VALUES (?, ?, 'falha', NOW()) 
                     ON DUPLICATE KEY UPDATE status_whatsapp = 'falha', data_contato = NOW()`,
                    [leadId, id]
                );
            }
        } catch (dbError) {
            console.error('Erro ao registrar falha:', dbError);
        }

        res.status(500).json({ error: 'Erro no disparo: ' + error.message });
    }
};

// Fix Database Columns (Temporary)
exports.runDatabaseFix = async (req, res) => {
    try {
        console.log('Starting Manual Database Fix...');

        const queries = [
            `ALTER TABLE leads_campanhas ADD COLUMN status_email VARCHAR(50) DEFAULT 'pendente' AFTER status`,
            `ALTER TABLE leads_campanhas ADD COLUMN status_whatsapp VARCHAR(50) DEFAULT 'pendente' AFTER status_email`
        ];

        for (const query of queries) {
            try {
                await db.query(query);
                console.log('Executed:', query);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log('Column already exists, skipping.');
                } else {
                    console.warn('Error executing query:', query, e.message);
                }
            }
        }

        res.json({ success: true, message: 'Verificação e Correção do Banco Concluída.' });
    } catch (error) {
        console.error('Database Fix Failed:', error);
        res.status(500).json({ error: 'Erro ao corrigir banco: ' + error.message });
    }
};
