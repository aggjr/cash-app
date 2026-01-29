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
        COUNT(DISTINCT CASE 
          WHEN (lc.status_email IS NOT NULL AND lc.status_email != 'pendente') 
            OR (lc.status_whatsapp IS NOT NULL AND lc.status_whatsapp != 'pendente') 
          THEN lc.lead_id 
        END) as leads_processados,
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
        const { nome, descricao, dataInicio, dataFim, status, leadsIds, message, dispatchIntervalSeconds } = req.body;

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
        const intervalSeconds = dispatchIntervalSeconds || 120;

        const [result] = await connection.query(
            'INSERT INTO campanhas (nome, descricao, data_inicio, data_fim, status, dispatch_interval_seconds, email_subject, email_body, whatsapp_text, media_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nome, descricao || null, dataInicio || null, dataFim || null, status || 'planejamento', intervalSeconds, emailSubject, emailBody, whatsappText, mediaUrl]
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
        const { nome, descricao, dataInicio, dataFim, status, message, dispatchIntervalSeconds } = req.body;

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
        const intervalSeconds = dispatchIntervalSeconds !== undefined ? dispatchIntervalSeconds : null;

        const [result] = await db.query(
            'UPDATE campanhas SET nome = ?, descricao = ?, data_inicio = ?, data_fim = ?, status = ?, dispatch_interval_seconds = COALESCE(?, dispatch_interval_seconds), email_subject = ?, email_body = ?, whatsapp_text = ?, media_url = ? WHERE id = ?',
            [nome, descricao || null, dataInicio || null, dataFim || null, status || 'planejamento', intervalSeconds, emailSubject, emailBody, whatsappText, mediaUrl, id]
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

            // Log image detection for debugging
            const hasImage = /<img[^>]+>/i.test(finalHtml);
            console.log(`📧 Email: Sending to ${lead.email}, Has image: ${hasImage}`);
            console.log(`📧 Email: HTML content length: ${finalHtml.length} chars`);
            console.log(`📧 Email: HTML preview: ${finalHtml.substring(0, 200)}...`);
            if (hasImage) {
                const imgSrc = finalHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
                if (imgSrc) {
                    console.log(`📧 Email: Image URL found: ${imgSrc[1]}`);
                    console.log(`📧 Email: Full img tag: ${imgSrc[0]}`);
                }
            }

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
            // Improved regex to handle various img tag formats from Quill editor
            console.log(`📸 WhatsApp: Raw text length: ${campanha.whatsapp_text.length} chars`);
            console.log(`📸 WhatsApp: Raw text preview: ${campanha.whatsapp_text.substring(0, 200)}...`);

            const imgMatch = campanha.whatsapp_text.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
            let fullMediaUrl = null;
            let mediatype = 'image';
            let rawText = campanha.whatsapp_text;

            if (imgMatch) {
                fullMediaUrl = imgMatch[1];
                console.log(`📸 WhatsApp: Image found in HTML - URL: ${fullMediaUrl}`);
                console.log(`📸 WhatsApp: Full img tag: ${imgMatch[0]}`);
                // Remove the image tag from the text to be converted
                rawText = rawText.replace(/<img[^>]+>/gi, '').trim();
            } else if (campanha.media_url) {
                // Fallback to legacy field
                const baseUrl = process.env.API_BASE_URL || 'https://cash.gutoapps.site';
                fullMediaUrl = campanha.media_url.startsWith('http') ? campanha.media_url : `${baseUrl}${campanha.media_url}`;
                console.log(`📸 WhatsApp: Using legacy media_url - URL: ${fullMediaUrl}`);
            } else {
                console.log(`📸 WhatsApp: No image found in message`);
                console.log(`📸 WhatsApp: Checking if HTML contains img tag: ${/<img/i.test(campanha.whatsapp_text)}`);
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
        const results = [];

        // 1. Add status_email and status_whatsapp columns to leads_campanhas
        const queries = [
            `ALTER TABLE leads_campanhas ADD COLUMN status_email VARCHAR(50) DEFAULT 'pendente' AFTER status`,
            `ALTER TABLE leads_campanhas ADD COLUMN status_whatsapp VARCHAR(50) DEFAULT 'pendente' AFTER status_email`
        ];

        for (const query of queries) {
            try {
                await db.query(query);
                console.log('✅ Executed:', query);
                results.push(`✅ ${query.substring(0, 50)}...`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log('ℹ️ Column already exists, skipping.');
                    results.push(`ℹ️ Column already exists`);
                } else {
                    console.warn('⚠️ Error executing query:', query, e.message);
                    results.push(`⚠️ Error: ${e.message}`);
                }
            }
        }

        // 2. Fix status column ENUM to support new values
        try {
            console.log('🔧 Fixing status column ENUM...');

            // Check current status column definition
            const [columns] = await db.query(`
                SELECT COLUMN_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campanhas' AND COLUMN_NAME = 'status'
            `);

            if (columns.length > 0) {
                const columnType = columns[0].COLUMN_TYPE;
                console.log(`Current status type: ${columnType}`);

                // Check if it's an ENUM and needs updating
                if (columnType.includes('enum')) {
                    // Check if it already has the new values
                    if (!columnType.includes('enviando') || !columnType.includes('envio_finalizado') || !columnType.includes('erro')) {
                        console.log('Status is ENUM and needs updating. Adding missing values...');

                        await db.query(`
                            ALTER TABLE campanhas
                            MODIFY COLUMN status ENUM(
                                'planejamento',
                                'ativa',
                                'pausada',
                                'concluida',
                                'cancelada',
                                'enviando',
                                'envio_finalizado',
                                'erro'
                            ) DEFAULT 'planejamento'
                        `);
                        console.log('✅ Status column updated with new values.');
                        results.push('✅ Status ENUM updated: enviando, envio_finalizado, erro');
                    } else {
                        console.log('ℹ️ Status ENUM already has all required values.');
                        results.push('ℹ️ Status ENUM already correct');
                    }
                } else {
                    console.log('ℹ️ Status is not ENUM, no changes needed.');
                    results.push('ℹ️ Status column is not ENUM');
                }
            } else {
                console.log('⚠️ Status column not found!');
                results.push('⚠️ Status column not found');
            }
        } catch (error) {
            console.error('❌ Error fixing status column:', error);
            results.push(`❌ Status fix error: ${error.message}`);
        }

        res.json({
            success: true,
            message: 'Verificação e Correção do Banco Concluída.',
            results
        });
    } catch (error) {
        console.error('Database Fix Failed:', error);
        res.status(500).json({ error: 'Erro ao corrigir banco: ' + error.message });
    }
};

// Disparar campanha de forma assíncrona (não bloqueia a resposta)
exports.dispararAsync = async (req, res) => {
    try {
        const { id } = req.params;

        // Return immediately - processing will happen in background
        res.json({ success: true, message: 'Disparos iniciados em background' });

        // Process sends in background (don't await)
        processarDisparosBackground(id).catch(err => {
            console.error(`Erro ao processar disparos da campanha ${id}:`, err);
        });
    } catch (error) {
        console.error('Erro ao iniciar disparos:', error);
        res.status(500).json({ error: 'Erro ao iniciar disparos: ' + error.message });
    }
};

// Função auxiliar para processar disparos em background
async function processarDisparosBackground(campaignId) {
    try {
        console.log(`📤 Iniciando disparos em background para campanha ${campaignId}`);

        // Update campaign status to "enviando"
        await db.query(
            `UPDATE campanhas SET status = 'enviando' WHERE id = ?`,
            [campaignId]
        );

        // Get campaign details
        const [campanhas] = await db.query(
            `SELECT * FROM campanhas WHERE id = ?`,
            [campaignId]
        );

        if (campanhas.length === 0) {
            console.error(`Campanha ${campaignId} não encontrada`);
            return;
        }

        const campanha = campanhas[0];

        // Get all leads for this campaign
        const [leads] = await db.query(
            `SELECT l.* FROM leads l
             INNER JOIN leads_campanhas lc ON l.id = lc.lead_id
             WHERE lc.campanha_id = ?`,
            [campaignId]
        );

        console.log(`📤 Processando ${leads.length} leads para campanha ${campaignId}`);

        const intervalSeconds = campanha.dispatch_interval_seconds || 120;
        console.log(`⏱️  Intervalo entre disparos: ${intervalSeconds} segundos`);

        // Process each lead
        for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];
            console.log(`\n📨 ========== LEAD ${i + 1}/${leads.length} ==========`);
            console.log(`📨 Nome: ${lead.nome}`);
            console.log(`📨 E-mail: ${lead.email || 'N/A'}`);
            console.log(`📨 Telefone: ${lead.telefone || 'N/A'}`);

            // Send Email if configured
            if (campanha.email_subject && campanha.email_body && lead.email) {
                console.log(`\n📧 [STATUS] Iniciando envio de e-mail...`);
                try {
                    await enviarEmailParaLead(campanha, lead);
                    console.log(`📧 [STATUS] ✅ E-mail enviado! Atualizando status no BD...`);

                    const [result] = await db.query(
                        `UPDATE leads_campanhas SET status_email = 'sucesso' WHERE campanha_id = ? AND lead_id = ?`,
                        [campaignId, lead.id]
                    );
                    console.log(`📧 [STATUS] ✅ Status atualizado! Rows affected: ${result.affectedRows}`);
                } catch (error) {
                    console.error(`📧 [STATUS] ❌ ERRO ao enviar email para lead ${lead.id}:`);
                    console.error(`📧 [STATUS] Erro: ${error.message}`);
                    console.error(`📧 [STATUS] Stack: ${error.stack}`);
                    console.log(`📧 [STATUS] Marcando como 'falha' no BD...`);

                    const [result] = await db.query(
                        `UPDATE leads_campanhas SET status_email = 'falha' WHERE campanha_id = ? AND lead_id = ?`,
                        [campaignId, lead.id]
                    );
                    console.log(`📧 [STATUS] Status 'falha' registrado! Rows affected: ${result.affectedRows}`);
                }
            } else {
                console.log(`📧 [STATUS] ⏭️ Pulando e-mail (não configurado ou lead sem e-mail)`);
            }


            // Send WhatsApp if configured
            console.log(`\n💬 [DEBUG] Verificando condições para WhatsApp:`);
            console.log(`💬 [DEBUG]   - campanha.whatsapp_text existe: ${!!campanha.whatsapp_text}`);
            console.log(`💬 [DEBUG]   - campanha.whatsapp_text length: ${campanha.whatsapp_text?.length || 0}`);
            console.log(`💬 [DEBUG]   - lead.telefone existe: ${!!lead.telefone}`);
            console.log(`💬 [DEBUG]   - lead.telefone valor: ${lead.telefone || 'NULL'}`);

            if (campanha.whatsapp_text && lead.telefone) {
                console.log(`\n💬 [STATUS] Iniciando envio de WhatsApp...`);
                try {
                    await enviarWhatsAppParaLead(campanha, lead);
                    console.log(`💬 [STATUS] ✅ WhatsApp enviado! Atualizando status no BD...`);

                    const [result] = await db.query(
                        `UPDATE leads_campanhas SET status_whatsapp = 'sucesso' WHERE campanha_id = ? AND lead_id = ?`,
                        [campaignId, lead.id]
                    );
                    console.log(`💬 [STATUS] ✅ Status atualizado! Rows affected: ${result.affectedRows}`);
                } catch (error) {
                    console.error(`💬 [STATUS] ❌ ERRO ao enviar WhatsApp para lead ${lead.id}:`);
                    console.error(`💬 [STATUS] Erro: ${error.message}`);
                    console.error(`💬 [STATUS] Stack: ${error.stack}`);
                    console.log(`💬 [STATUS] Marcando como 'falha' no BD...`);

                    const [result] = await db.query(
                        `UPDATE leads_campanhas SET status_whatsapp = 'falha' WHERE campanha_id = ? AND lead_id = ?`,
                        [campaignId, lead.id]
                    );
                    console.log(`💬 [STATUS] Status 'falha' registrado! Rows affected: ${result.affectedRows}`);
                }
            } else {
                console.log(`💬 [STATUS] ⏭️ Pulando WhatsApp (não configurado ou lead sem telefone)`);
                console.log(`💬 [STATUS]   - Motivo: ${!campanha.whatsapp_text ? 'whatsapp_text vazio' : 'lead sem telefone'}`);
            }

            // Wait before processing next lead (except for the last one)
            if (i < leads.length - 1) {
                console.log(`⏳ Aguardando ${intervalSeconds} segundos antes do próximo lead...`);
                await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
            }
        }

        // Update campaign status to "envio_finalizado"
        await db.query(
            `UPDATE campanhas SET status = 'envio_finalizado' WHERE id = ?`,
            [campaignId]
        );

        console.log(`✅ Disparos concluídos para campanha ${campaignId}`);
    } catch (error) {
        console.error(`Erro ao processar disparos da campanha ${campaignId}:`, error);
        // Update campaign status to error
        await db.query(
            `UPDATE campanhas SET status = 'erro' WHERE id = ?`,
            [campaignId]
        ).catch(err => console.error('Erro ao atualizar status:', err));
    }
}

// Helper function to send email to a lead
async function enviarEmailParaLead(campanha, lead) {
    console.log(`\n========== 📧 ENVIANDO E-MAIL ==========`);
    console.log(`📧 [EMAIL] Lead: ${lead.nome} <${lead.email}>`);
    console.log(`📧 [EMAIL] Campanha ID: ${campanha.id}`);

    const replaceVariables = (text) => {
        if (!text) return text;
        return text
            .replace(/\{\{nome\}\}/gi, lead.nome || '')
            .replace(/\{\{email\}\}/gi, lead.email || '')
            .replace(/\{\{telefone\}\}/gi, lead.telefone || '');
    };

    console.log(`📧 [EMAIL] Subject original: "${campanha.email_subject}"`);
    console.log(`📧 [EMAIL] Body length: ${campanha.email_body?.length || 0} chars`);

    const emailBody = replaceVariables(campanha.email_body);
    const emailSubject = replaceVariables(campanha.email_subject);
    let finalHtml = emailBody.includes('<') ? emailBody : emailBody.replace(/\n/g, '<br>');

    console.log(`📧 [EMAIL] Subject após variáveis: "${emailSubject}"`);
    console.log(`📧 [EMAIL] HTML final length: ${finalHtml.length} chars`);

    // Log image detection
    const hasImage = /<img[^>]+>/i.test(finalHtml);
    console.log(`📧 [EMAIL] Contém imagem: ${hasImage}`);

    if (hasImage) {
        const imgSrc = finalHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (imgSrc) {
            console.log(`📧 [EMAIL] ✅ Imagem detectada!`);
            console.log(`📧 [EMAIL] URL da imagem: ${imgSrc[1]}`);
            console.log(`📧 [EMAIL] Tipo de URL: ${imgSrc[1].startsWith('http') ? 'Externa (HTTP)' : imgSrc[1].startsWith('data:') ? 'Base64 inline' : 'Relativa'}`);
        } else {
            console.log(`📧 [EMAIL] ⚠️ Tag <img> encontrada mas sem src válido`);
        }
    } else {
        console.log(`📧 [EMAIL] ℹ️ Nenhuma imagem no conteúdo`);
    }

    try {
        console.log(`📧 [EMAIL] 🚀 Chamando emailService.sendGenericEmail...`);
        const result = await emailService.sendGenericEmail(lead.email, emailSubject, finalHtml);
        console.log(`📧 [EMAIL] ✅ E-mail enviado com sucesso!`);
        console.log(`📧 [EMAIL] Message ID: ${result?.messageId || 'N/A'}`);
        console.log(`========== 📧 E-MAIL CONCLUÍDO ==========\n`);
        return result;
    } catch (error) {
        console.error(`📧 [EMAIL] ❌ ERRO ao enviar e-mail:`);
        console.error(`📧 [EMAIL] Erro: ${error.message}`);
        console.error(`📧 [EMAIL] Stack: ${error.stack}`);
        console.log(`========== 📧 E-MAIL FALHOU ==========\n`);
        throw error;
    }
}

// Helper function to send WhatsApp to a lead
async function enviarWhatsAppParaLead(campanha, lead) {
    console.log(`\n========== 💬 ENVIANDO WHATSAPP ==========`);
    console.log(`💬 [WHATSAPP] Lead: ${lead.nome}`);
    console.log(`💬 [WHATSAPP] Telefone: ${lead.telefone}`);
    console.log(`💬 [WHATSAPP] Campanha ID: ${campanha.id}`);

    const replaceVariables = (text) => {
        if (!text) return text;
        return text
            .replace(/\{\{nome\}\}/gi, lead.nome || '')
            .replace(/\{\{email\}\}/gi, lead.email || '')
            .replace(/\{\{telefone\}\}/gi, lead.telefone || '');
    };

    const convertHtmlToWhatsapp = (html) => {
        if (!html) return '';
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim();
    };

    console.log(`💬 [WHATSAPP] Texto original length: ${campanha.whatsapp_text?.length || 0} chars`);
    console.log(`💬 [WHATSAPP] Media URL (campo): ${campanha.media_url || 'NULL'}`);

    // Extract image or video from HTML
    const imgMatch = campanha.whatsapp_text.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    const videoMatch = campanha.whatsapp_text.match(/<video[^>]*>\s*<source[^>]+src=["']([^"']+)["'][^>]*>|<video[^>]+src=["']([^"']+)["'][^>]*>/i);
    let fullMediaUrl = null;
    let rawText = campanha.whatsapp_text;
    let mediaType = null;

    if (imgMatch) {
        fullMediaUrl = imgMatch[1];
        mediaType = 'image';
        console.log(`💬 [WHATSAPP] ✅ Imagem encontrada no HTML!`);
        console.log(`💬 [WHATSAPP] URL da imagem (do HTML): ${fullMediaUrl.substring(0, 100)}...`);
        console.log(`💬 [WHATSAPP] URL length: ${fullMediaUrl.length} chars`);

        // Check if it's Base64
        if (fullMediaUrl.startsWith('data:image/')) {
            const base64Match = fullMediaUrl.match(/data:image\/[^;]+;base64,(.+)/);
            if (base64Match) {
                const base64Data = base64Match[1];
                console.log(`💬 [WHATSAPP] 📊 Base64 detectado!`);
                console.log(`💬 [WHATSAPP] 📊 Base64 length: ${base64Data.length} chars`);
                console.log(`💬 [WHATSAPP] 📊 Base64 primeiros 50 chars: ${base64Data.substring(0, 50)}`);
                console.log(`💬 [WHATSAPP] 📊 Base64 últimos 50 chars: ${base64Data.substring(base64Data.length - 50)}`);

                // Check if truncated (Base64 should end with = or alphanumeric, not in the middle)
                const lastChar = base64Data.charAt(base64Data.length - 1);
                if (base64Data.length < 1000) {
                    console.log(`💬 [WHATSAPP] ⚠️ AVISO: Base64 muito pequeno (${base64Data.length} chars) - pode estar truncado!`);
                }
            }
        }

        rawText = rawText.replace(/<img[^>]+>/gi, '').trim();
        console.log(`💬 [WHATSAPP] Texto após remover <img>: "${rawText.substring(0, 50)}..."`);
    } else if (videoMatch) {
        fullMediaUrl = videoMatch[1] || videoMatch[2];
        mediaType = 'video';
        console.log(`💬 [WHATSAPP] ✅ Vídeo encontrado no HTML!`);
        console.log(`💬 [WHATSAPP] URL do vídeo (do HTML): ${fullMediaUrl.substring(0, 100)}...`);
        console.log(`💬 [WHATSAPP] URL length: ${fullMediaUrl.length} chars`);

        // Check if it's Base64
        if (fullMediaUrl.startsWith('data:video/')) {
            const base64Match = fullMediaUrl.match(/data:video\/[^;]+;base64,(.+)/);
            if (base64Match) {
                const base64Data = base64Match[1];
                console.log(`💬 [WHATSAPP] 📊 Base64 de vídeo detectado!`);
                console.log(`💬 [WHATSAPP] 📊 Base64 length: ${base64Data.length} chars`);
                console.log(`💬 [WHATSAPP] 📊 Base64 primeiros 50 chars: ${base64Data.substring(0, 50)}`);
                console.log(`💬 [WHATSAPP] 📊 Base64 últimos 50 chars: ${base64Data.substring(base64Data.length - 50)}`);
            }
        }

        rawText = rawText.replace(/<video[^>]*>.*?<\/video>/gi, '').trim();
        console.log(`💬 [WHATSAPP] Texto após remover <video>: "${rawText.substring(0, 50)}..."`);
    } else if (campanha.media_url) {
        const baseUrl = process.env.API_BASE_URL || 'https://cash.gutoapps.site';
        fullMediaUrl = campanha.media_url.startsWith('http') ? campanha.media_url : `${baseUrl}${campanha.media_url}`;
        console.log(`💬 [WHATSAPP] ✅ Usando media_url legado`);
        console.log(`💬 [WHATSAPP] URL da mídia (campo): ${fullMediaUrl}`);
    } else {
        console.log(`💬 [WHATSAPP] ℹ️ Nenhuma mídia configurada`);
    }

    const variablesReplaced = replaceVariables(rawText);
    const text = convertHtmlToWhatsapp(variablesReplaced);

    console.log(`💬 [WHATSAPP] Texto final (após conversão): "${text.substring(0, 100)}..."`);
    console.log(`💬 [WHATSAPP] Texto final length: ${text.length} chars`);

    try {
        // Send via Evolution API
        if (fullMediaUrl) {
            // Determine media type from detected tag or file extension
            let mediatype = mediaType || 'image';
            if (!mediaType) {
                const isVideo = fullMediaUrl.match(/\.(mp4|mov|avi|wmv)$/i) || fullMediaUrl.startsWith('data:video/');
                mediatype = isVideo ? 'video' : 'image';
            }
            console.log(`💬 [WHATSAPP] 🚀 Enviando MÍDIA (${mediatype})...`);
            console.log(`💬 [WHATSAPP] URL: ${fullMediaUrl}`);
            console.log(`💬 [WHATSAPP] Caption: "${text.substring(0, 50)}..."`);

            const result = await evolutionService.sendMedia(lead.telefone, fullMediaUrl, mediatype, text);
            console.log(`💬 [WHATSAPP] ✅ Mídia enviada com sucesso!`);
            console.log(`💬 [WHATSAPP] Resposta:`, JSON.stringify(result, null, 2));
        } else {
            console.log(`💬 [WHATSAPP] 🚀 Enviando TEXTO puro...`);
            console.log(`💬 [WHATSAPP] Mensagem: "${text.substring(0, 100)}..."`);

            const result = await evolutionService.sendMessage(lead.telefone, text);
            console.log(`💬 [WHATSAPP] ✅ Texto enviado com sucesso!`);
            console.log(`💬 [WHATSAPP] Resposta:`, JSON.stringify(result, null, 2));
        }
        console.log(`========== 💬 WHATSAPP CONCLUÍDO ==========\n`);
    } catch (error) {
        console.error(`💬 [WHATSAPP] ❌ ERRO ao enviar WhatsApp:`);
        console.error(`💬 [WHATSAPP] Erro: ${error.message}`);
        console.error(`💬 [WHATSAPP] Stack: ${error.stack}`);
        console.log(`========== 💬 WHATSAPP FALHOU ==========\n`);
        throw error;
    }
}


// Get dispatch details for a campaign (for real-time monitoring)
exports.getDispatchDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const [leads] = await db.query(`
            SELECT 
                l.id,
                l.nome,
                l.email,
                l.telefone,
                lc.status_email,
                lc.status_whatsapp
            FROM leads l
            INNER JOIN leads_campanhas lc ON l.id = lc.lead_id
            WHERE lc.campanha_id = ?
            ORDER BY l.nome
        `, [id]);

        res.json(leads);
    } catch (error) {
        console.error('Erro ao buscar detalhes de disparo:', error);
        res.status(500).json({ error: 'Erro ao buscar detalhes de disparo' });
    }
};

// Apply campaign redesign migration
exports.applyRedesignMigration = async (req, res) => {
    try {
        const { applyRedesignMigration } = require('../migrations/campaign_redesign_migration');
        console.log('🔧 Executando migração do redesign via endpoint...');
        const results = await applyRedesignMigration();

        if (results.success) {
            res.json({
                success: true,
                message: 'Migração aplicada com sucesso!',
                steps: results.steps,
                errors: results.errors
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Migração falhou',
                steps: results.steps,
                errors: results.errors
            });
        }
    } catch (error) {
        console.error('Erro ao executar migração:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao executar migração',
            error: error.message
        });
    }
};

// Fix status column to support new values (enviando, envio_finalizado, erro)
exports.fixStatusColumn = async (req, res) => {
    try {
        console.log('🔧 Fixing status column in campanhas table...');
        const steps = [];
        const errors = [];

        // Check current status column definition
        const [columns] = await db.query(`
            SELECT COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campanhas' AND COLUMN_NAME = 'status'
        `);

        if (columns.length > 0) {
            steps.push(`Current status column type: ${columns[0].COLUMN_TYPE}`);

            // Check if it's an ENUM
            if (columns[0].COLUMN_TYPE.includes('enum')) {
                steps.push('Status is ENUM. Modifying to include missing values...');

                try {
                    // Modify ENUM to include all necessary values
                    await db.query(`
                        ALTER TABLE campanhas
                        MODIFY COLUMN status ENUM(
                            'planejamento',
                            'ativa',
                            'pausada',
                            'concluida',
                            'cancelada',
                            'enviando',
                            'envio_finalizado',
                            'erro'
                        ) DEFAULT 'planejamento'
                    `);
                    steps.push('✅ Status column updated successfully with new values.');
                } catch (error) {
                    errors.push(`Error modifying ENUM: ${error.message}`);
                    throw error;
                }
            } else {
                steps.push('Status is not ENUM. Converting to VARCHAR for flexibility...');

                try {
                    // Convert to VARCHAR for more flexibility
                    await db.query(`
                        ALTER TABLE campanhas
                        MODIFY COLUMN status VARCHAR(50) DEFAULT 'planejamento'
                    `);
                    steps.push('✅ Status column converted to VARCHAR(50).');
                } catch (error) {
                    errors.push(`Error converting to VARCHAR: ${error.message}`);
                    throw error;
                }
            }
        } else {
            errors.push('❌ Status column not found!');
            throw new Error('Status column not found');
        }

        res.json({
            success: true,
            message: 'Status column fixed successfully!',
            steps,
            errors
        });
    } catch (error) {
        console.error('❌ Error fixing status column:', error);
        res.status(500).json({
            success: false,
            message: 'Error fixing status column',
            error: error.message
        });
    }
};

// Fix text columns to support large Base64 images
exports.fixTextColumns = async (req, res) => {
    try {
        console.log('🔧 Fixing text columns for Base64 support...');
        const steps = [];
        const errors = [];

        // Check current column types
        const [columns] = await db.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'campanhas'
            AND COLUMN_NAME IN ('whatsapp_text', 'email_body')
        `);

        steps.push('📊 Current columns:');
        columns.forEach(col => {
            steps.push(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (max: ${col.CHARACTER_MAXIMUM_LENGTH || 'N/A'})`);
        });

        // Fix whatsapp_text to LONGTEXT
        try {
            await db.query(`
                ALTER TABLE campanhas 
                MODIFY COLUMN whatsapp_text LONGTEXT
            `);
            steps.push('✅ whatsapp_text changed to LONGTEXT');
        } catch (error) {
            errors.push(`Error changing whatsapp_text: ${error.message}`);
        }

        // Fix email_body to LONGTEXT
        try {
            await db.query(`
                ALTER TABLE campanhas 
                MODIFY COLUMN email_body LONGTEXT
            `);
            steps.push('✅ email_body changed to LONGTEXT');
        } catch (error) {
            errors.push(`Error changing email_body: ${error.message}`);
        }

        // Verify changes
        const [newColumns] = await db.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'campanhas'
            AND COLUMN_NAME IN ('whatsapp_text', 'email_body')
        `);

        steps.push('✅ Columns after changes:');
        newColumns.forEach(col => {
            steps.push(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE}`);
        });

        res.json({
            success: true,
            message: 'Text columns fixed successfully!',
            steps,
            errors
        });
    } catch (error) {
        console.error('❌ Error fixing text columns:', error);
        res.status(500).json({
            success: false,
            message: 'Error fixing text columns',
            error: error.message
        });
    }
};

