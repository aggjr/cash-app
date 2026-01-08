import { getApiBaseUrl } from '../utils/apiConfig.js';

export const IvaService = {
    decideOperation: async (text, context) => {
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = getApiBaseUrl();

            // Extract screen context for contextual Q&A
            let screenContext = null;
            try {
                const { ScreenContextExtractor } = await import('./ScreenContextExtractor.js');
                screenContext = ScreenContextExtractor.extractFullContext();
                console.log('[ivaService] Screen context extracted:', screenContext);
            } catch (err) {
                console.warn('[ivaService] Could not extract screen context:', err);
            }

            console.log('[ivaService] Sending request to /IVA/operate:', {
                message: text,
                currentScreen: context.currentScreen?.id || 'none',
                screensCount: (context.availableScreens ? Object.values(context.availableScreens) : []).length,
                hasScreenContext: !!screenContext
            });

            // Get user settings from localStorage
            const user = JSON.parse(localStorage.getItem('user') || '{}');

            // Try multiple sources for projectId
            const projectId = user?.default_project_id ||
                user?.defaultProjectId ||
                localStorage.getItem('selectedProjectId') ||
                localStorage.getItem('projectId');

            console.log('[ivaService] ProjectId resolution:', {
                fromUser_default_project_id: user?.default_project_id,
                fromUser_defaultProjectId: user?.defaultProjectId,
                fromLocalStorage_selectedProjectId: localStorage.getItem('selectedProjectId'),
                fromLocalStorage_projectId: localStorage.getItem('projectId'),
                finalProjectId: projectId
            });

            // Build context object matching backend expectations
            const requestContext = {
                projectId: projectId ? parseInt(projectId) : null,
                screenContext: screenContext, // Nested under context as backend expects
                currentScreenData: context.currentScreenData
            };

            console.log('[ivaService] Sending request with context:', {
                hasProjectId: !!requestContext.projectId,
                hasScreenContext: !!requestContext.screenContext,
                screenId: requestContext.screenContext?.screenId || 'none',
                currentScreenId: context.currentScreen?.id || 'none'
            });

            const response = await fetch(`${API_BASE_URL}/IVA/operate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: text,
                    context: requestContext, // CRITICAL: Nest under 'context' as backend expects
                    currentScreen: context.currentScreen,
                    availableScreens: context.availableScreens || [],
                    menuStructure: context.menuStructure, // NEW: Complete menu for navigation
                    menuNavigationState: context.menuNavigationState, // NEW: Track search position
                    screenContext, // Legacy/Fallback extraction (keep for backward compat)
                    activeScreenContext: context.currentScreenData, // NEW: Semantic Data (The Eyes)
                    userName: user?.name || '', // Full registered name for gender inference
                    preferredName: user?.preferred_name || '', // User's preferred form of address
                    userSettings: { // Voice configuration
                        ivaVoiceRate: user?.iva_voice_rate || 70,
                        ivaVoiceMale: user?.iva_voice_male || 0,
                        ivaVoiceEnabled: user?.iva_voice_enabled !== 0
                    }
                })
            });

            console.log('[ivaService] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[ivaService] Error response:', errorText);
                // Fallback action
                return { action: 'REPLY', message: 'Desculpe, tive um problema de conex├úo com meu c├⌐rebro.' };
            }

            const decision = await response.json();
            console.log('[ivaService] Decision received:', decision);
            return decision;

        } catch (error) {
            console.error('ivaService Exception:', error);
            return { action: 'REPLY', message: 'Erro ao processar sua solicita├º├úo.' };
        }
    }
};



