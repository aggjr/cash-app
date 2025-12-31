import { getApiBaseUrl } from '../utils/apiConfig.js';

export const EvaService = {
    decideOperation: async (text, context) => {
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = getApiBaseUrl();

            console.log('[EvaService] Sending request to /eva/operate:', {
                message: text,
                currentScreen: context.currentScreen?.id || 'none',
                screensCount: (context.availableScreens ? Object.values(context.availableScreens) : []).length
            });

            const response = await fetch(`${API_BASE_URL}/eva/operate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: text,
                    currentScreen: context.currentScreen,
                    availableScreens: context.availableScreens ? Object.values(context.availableScreens) : []
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
