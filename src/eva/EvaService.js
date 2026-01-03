import { getApiBaseUrl } from '../utils/apiConfig.js';

export const EvaService = {
    decideOperation: async (text, context) => {
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = getApiBaseUrl();

            // Extract screen context for contextual Q&A
            let screenContext = null;
            try {
                const { ScreenContextExtractor } = await import('./ScreenContextExtractor.js');
                screenContext = ScreenContextExtractor.extractFullContext();
                console.log('[EvaService] Screen context extracted:', screenContext);
            } catch (err) {
                console.warn('[EvaService] Could not extract screen context:', err);
            }

            console.log('[EvaService] Sending request to /eva/operate:', {
                message: text,
                currentScreen: context.currentScreen?.id || 'none',
                screensCount: (context.availableScreens ? Object.values(context.availableScreens) : []).length,
                hasScreenContext: !!screenContext
            });

            // Get user settings from localStorage
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const projectId = user?.default_project_id || localStorage.getItem('selectedProjectId');

            // Build context object matching backend expectations
            const requestContext = {
                projectId: projectId ? parseInt(projectId) : null,
                screenContext: screenContext, // Nested under context as backend expects
                currentScreenData: context.currentScreenData
            };

            console.log('[EvaService] Sending request with context:', {
                hasProjectId: !!requestContext.projectId,
                hasScreenContext: !!requestContext.screenContext,
                screenId: requestContext.screenContext?.screenId || 'none',
                currentScreenId: context.currentScreen?.id || 'none'
            });

            const response = await fetch(`${API_BASE_URL}/eva/operate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: text,
                    context: requestContext, // CRITICAL: Nest under 'context' as backend expects
                    currentScreen: context.currentScreen,
                    availableScreens: context.availableScreens ? Object.values(context.availableScreens) : [],
                    screenContext, // Legacy/Fallback extraction (keep for backward compat)
                    activeScreenContext: context.currentScreenData, // NEW: Semantic Data (The Eyes)
                    userName: user?.name || '', // Full registered name for gender inference
                    preferredName: user?.preferred_name || '', // User's preferred form of address
                    userSettings: { // Voice configuration
                        evaVoiceRate: user?.eva_voice_rate || 70,
                        evaVoiceMale: user?.eva_voice_male || 0,
                        evaVoiceEnabled: user?.eva_voice_enabled !== 0
                    }
                })
            });

            console.log('[EvaService] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[EvaService] Error response:', errorText);
                // Fallback action
                return { action: 'REPLY', message: 'Desculpe, tive um problema de conexão com meu cérebro.' };
            }

            const decision = await response.json();
            console.log('[EvaService] Decision received:', decision);
            return decision;

        } catch (error) {
            console.error('EvaService Exception:', error);
            return { action: 'REPLY', message: 'Erro ao processar sua solicitação.' };
        }
    }
};
