const OpenAI = require('openai');
const db = require('../config/database');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * IVA Controller - Clean & Simple LLM-First Architecture
 * No hardcoded logic, no classifiers, just LLM + execution
 */

const chat = async (req, res) => {
    try {
        const { message, conversationHistory = [], context = {} } = req.body;
        const user = req.user;

        if (!user || !user.id) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        // 1. Get user data
        const [userData] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [user.id]
        );

        // 2. Get project data
        let projectData = null;
        if (context.projectId) {
            const [projects] = await db.query(
                'SELECT * FROM projects WHERE id = ?',
                [context.projectId]
            );
            projectData = projects[0];
        }

        // 3. Build prompt
        const UnifiedPrompt = require('../config/iva-unified-prompt');
        const systemPrompt = await UnifiedPrompt.getUnifiedPrompt(
            userData[0],
            projectData,
            context
        );

        // 4. Prepare messages
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-10).map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            })),
            { role: 'user', content: message }
        ];

        // 5. Call LLM
        const ivaFunctions = require('../config/iva-functions');
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 500,
            functions: ivaFunctions,
            function_call: 'auto'
        });

        // 6. Handle function calls
        const functionCall = completion.choices[0].message.function_call;
        if (functionCall) {
            console.log(`[IVA] 🔧 LLM called function: ${functionCall.name}`, JSON.parse(functionCall.arguments));
            await executeFunction(functionCall, user, context);
        } else {
            console.log(`[IVA] 💬 LLM did not call any function, just responded with text`);
        }

        // 7. Update last access timestamp
        const IvaUserPreferences = require('../services/IvaUserPreferences');
        await IvaUserPreferences.updateLastAccess(user.id, context.projectId);

        // 8. Return response
        const responseContent = completion.choices[0].message.content;
        res.json({
            message: responseContent,
            functionCalled: functionCall?.name || null
        });

    } catch (error) {
        console.error('[IVA Chat Error]', error);
        res.status(500).json({
            error: 'Erro ao processar mensagem',
            details: error.message
        });
    }
};

const operate = async (req, res) => {
    try {
        const { message, context = {}, screenContext } = req.body;
        const user = req.user;

        if (!user || !user.id) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        // 1. Get user data
        const [userData] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [user.id]
        );

        // 2. Get project data
        let projectData = null;
        if (context.projectId) {
            const [projects] = await db.query(
                'SELECT * FROM projects WHERE id = ?',
                [context.projectId]
            );
            projectData = projects[0];
        }

        // 3. Build prompt with screen context
        const UnifiedPrompt = require('../config/iva-unified-prompt');
        const systemPrompt = await UnifiedPrompt.getUnifiedPrompt(
            userData[0],
            projectData,
            {
                ...context,
                activeScreenContext: screenContext
            }
        );

        // 4. Call LLM
        const ivaFunctions = require('../config/iva-functions');
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            temperature: 0.3,
            // REMOVED: response_format - allow natural text responses
            functions: ivaFunctions,
            function_call: 'auto'
        });

        // 5. Handle function calls
        const functionCall = completion.choices[0].message.function_call;
        let functionCallInfo = null;

        if (functionCall) {
            await executeFunction(functionCall, user, context);
            functionCallInfo = {
                name: functionCall.name,
                arguments: JSON.parse(functionCall.arguments)
            };
        }

        // 6. Parse and return action
        const responseContent = completion.choices[0].message.content;

        console.log('[IVA Operate] LLM Response:', {
            hasContent: !!responseContent,
            contentLength: responseContent?.length,
            contentPreview: responseContent?.substring(0, 200),
            hasFunctionCall: !!functionCallInfo
        });

        let action;

        // Handle case where function is called but no content returned
        if (!responseContent && functionCallInfo) {
            console.log('[IVA Operate] Function called without content');
            action = {
                action: 'REPLY',
                message: getFunctionDefaultMessage(functionCallInfo)
            };
        } else if (responseContent) {
            try {
                // Extract JSON from markdown code blocks if present
                let cleanedContent = responseContent.trim();

                // Check if response is wrapped in ```json ... ```
                const jsonBlockMatch = cleanedContent.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonBlockMatch) {
                    cleanedContent = jsonBlockMatch[1].trim();
                    console.log('[IVA Operate] Extracted JSON from code block');
                }

                // Try to parse as JSON
                action = JSON.parse(cleanedContent);
                console.log('[IVA Operate] Parsed JSON action:', action);
            } catch (parseError) {
                console.log('[IVA Operate] Not JSON, treating as text response');
                action = {
                    action: 'REPLY',
                    message: responseContent
                };
            }
        } else {
            action = {
                action: 'REPLY',
                message: 'Desculpe, não consegui processar sua solicitação.'
            };
        }

        // Include function call info for frontend (only if action is valid)
        if (action && functionCallInfo) {
            action.functionCall = functionCallInfo;
        }

        console.log('[IVA Operate] Final action:', action);
        res.json(action || { action: 'REPLY', message: 'Erro ao processar resposta' });

    } catch (error) {
        console.error('[IVA Operate Error]', error);
        res.status(500).json({
            error: 'Erro ao processar comando',
            details: error.message
        });
    }
};

/**
 * Get default confirmation message for function calls
 */
const getFunctionDefaultMessage = (functionCallInfo) => {
    const { name, arguments: args } = functionCallInfo;

    switch (name) {
        case 'save_preferred_name':
            return `Perfeito! Vou te chamar de ${args.name}.`;

        case 'save_voice_settings':
            if (args.enabled === false) {
                return 'Ok! Desabilitei as respostas por voz.';
            }
            return `Configurações de voz atualizadas! Velocidade: ${args.rate}%.`;

        case 'save_user_preference':
            return `Preferência salva: ${args.preference_key}.`;

        case 'update_user_profile':
            const updates = [];
            if (args.job_title) updates.push(`cargo: ${args.job_title}`);
            if (args.department) updates.push(`departamento: ${args.department}`);
            if (args.gender) updates.push(`gênero: ${args.gender}`);
            return `Perfil atualizado (${updates.join(', ')}).`;

        case 'contribute_knowledge':
            return 'Conhecimento registrado com sucesso!';

        case 'navigate':
            return `Navegando para: ${args.target}`;

        case 'highlight_element':
            return 'Elemento destacado!';

        default:
            return 'Ação executada com sucesso!';
    }
};

/**
 * Execute function called by LLM
 */
const executeFunction = async (functionCall, user, context) => {
    const { name, arguments: argsStr } = functionCall;
    const args = JSON.parse(argsStr);

    console.log(`[IVA Function] Executing: ${name}`, args);

    switch (name) {
        case 'save_preferred_name':
            const IvaUserPreferences = require('../services/IvaUserPreferences');
            console.log(`[IVA Function] 🏷️ Saving preferred name: "${args.name}" for user ${user.id}, project ${context.projectId || 'N/A'}`);
            await IvaUserPreferences.setPreferredName(user.id, args.name, context.projectId);
            console.log(`[IVA Function] ✅ Preferred name saved successfully`);
            break;

        case 'save_voice_settings':
            const IvaUserPrefs = require('../services/IvaUserPreferences');
            await IvaUserPrefs.setVoiceSettings(user.id, args, context.projectId);
            break;

        case 'update_user_profile': {
            const updates = {};

            if (args.job_title) updates.job_title = args.job_title;
            if (args.department) updates.department = args.department;
            if (args.gender) updates.gender = args.gender;

            if (Object.keys(updates).length > 0) {
                await db.query(
                    'UPDATE users SET ? WHERE id = ?',
                    [updates, user.id]
                );
                console.log(`[IVA] Updated user profile for user ${user.id}:`, updates);
            }
            break;
        }

        case 'save_user_preference':
            const IvaUserPrefs2 = require('../services/IvaUserPreferences');
            await IvaUserPrefs2.setUserPreference(
                user.id,
                args.preference_key,
                args.preference_value,
                args.description || '',
                context.projectId
            );
            break;

        case 'contribute_knowledge':
            const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');
            await IvaGlobalKnowledge.contribute(
                args.type,
                args.data,
                {
                    userId: user.id,
                    projectId: context.projectId,
                    scope: args.scope || 'USER'
                }
            );
            break;

        case 'navigate':
            // Frontend handles navigation
            console.log(`[IVA Function] Navigate to: ${args.target}`);
            break;

        case 'highlight_element':
            // Frontend handles highlighting via IvaHighlight.js
            // Just log for debugging
            console.log(`[IVA Function] Highlight element: ${args.selector}`);
            break;

        case 'close_chat':
            // Frontend handles this
            break;

        default:
            console.warn(`[IVA Function] Unknown function: ${name}`);
    }
};

/**
 * Get pending knowledge for audit
 */
const getPendingKnowledge = async (req, res) => {
    try {
        const { scope } = req.query;
        const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');

        // Delegate to service to get full payload data including proposed_prompt and layer
        const pending = await IvaGlobalKnowledge.getPendingKnowledge(scope);
        res.json(pending);
    } catch (error) {
        console.error('[IVA Audit] Error getting pending:', error);
        res.status(500).json({ error: 'Erro ao buscar conhecimentos pendentes' });
    }
};

/**
 * Approve pending knowledge
 */
const approveKnowledge = async (req, res) => {
    try {
        const { id } = req.params;
        const { refinedText } = req.body;
        const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');

        await IvaGlobalKnowledge.approveKnowledge(id, refinedText);
        res.json({ success: true, message: 'Conhecimento aprovado' });
    } catch (error) {
        console.error('[IVA Audit] Error approving:', error);
        res.status(500).json({ error: 'Erro ao aprovar conhecimento' });
    }
};

/**
 * Reject pending knowledge
 */
const rejectKnowledge = async (req, res) => {
    try {
        const { id } = req.params;
        const IvaGlobalKnowledge = require('../services/IvaGlobalKnowledge');

        await IvaGlobalKnowledge.rejectKnowledge(id);
        res.json({ success: true, message: 'Conhecimento rejeitado' });
    } catch (error) {
        console.error('[IVA Audit] Error rejecting:', error);
        res.status(500).json({ error: 'Erro ao rejeitar conhecimento' });
    }
};

/**
 * Debug: Get full unified prompt context
 */
const getDebugContext = async (req, res) => {
    try {
        const user = req.user;
        const { projectId } = req.query;

        // 1. Get user data
        const [userData] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [user.id]
        );

        // 2. Get project data
        let projectData = null;
        if (projectId) {
            const [projects] = await db.query(
                'SELECT * FROM projects WHERE id = ?',
                [projectId]
            );
            projectData = projects[0];
        }

        // 3. Build prompt
        const UnifiedPrompt = require('../config/iva-unified-prompt');
        const systemPrompt = await UnifiedPrompt.getUnifiedPrompt(
            userData[0],
            projectData,
            { debug: true }
        );

        res.json({ context: systemPrompt });

    } catch (error) {
        console.error('[IVA Debug] Error getting context:', error);
        res.status(500).json({ error: 'Erro ao gerar contexto de debug' });
    }
};

module.exports = {
    chat,
    operate,
    getPendingKnowledge,
    approveKnowledge,
    rejectKnowledge,
    getDebugContext
};
