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
            await executeFunction(functionCall, user, context);
        }

        // 7. Return response
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
            response_format: { type: 'json_object' },
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
        let action;
        try {
            action = JSON.parse(responseContent);
        } catch {
            action = {
                action: 'REPLY',
                message: responseContent
            };
        }

        // Include function call info for frontend
        if (functionCallInfo) {
            action.functionCall = functionCallInfo;
        }

        res.json(action);

    } catch (error) {
        console.error('[IVA Operate Error]', error);
        res.status(500).json({
            error: 'Erro ao processar comando',
            details: error.message
        });
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
            await IvaUserPreferences.setPreferredName(user.id, args.name);
            break;

        case 'save_voice_settings':
            const IvaUserPrefs = require('../services/IvaUserPreferences');
            await IvaUserPrefs.setVoiceSettings(user.id, args);
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

module.exports = {
    chat,
    operate
};
