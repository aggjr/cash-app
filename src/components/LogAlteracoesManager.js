import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const LogAlteracoesManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '2rem';
    container.style.margin = '2rem';

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const render = () => {
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>📜 Log de Alterações</h2>
            </div>

            <div style="background: var(--color-surface); padding: 2rem; border-radius: 12px; border: 1px solid var(--color-border-light);">
                <div style="text-align: center; padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.3;">🚧</div>
                    <h3 style="color: var(--color-text-muted); margin-bottom: 0.5rem;">Em Desenvolvimento</h3>
                    <p style="color: var(--color-text-muted); font-size: 0.95rem;">
                        Esta funcionalidade registrará todas as alterações realizadas no sistema.
                    </p>
                    <p style="color: var(--color-text-muted); font-size: 0.85rem; margin-top: 1rem;">
                        Em breve você poderá visualizar:
                    </p>
                    <ul style="list-style: none; padding: 0; margin-top: 1rem; color: var(--color-text-muted); font-size: 0.9rem;">
                        <li style="margin-bottom: 0.5rem;">✓ Histórico de criações, edições e exclusões</li>
                        <li style="margin-bottom: 0.5rem;">✓ Usuário responsável por cada alteração</li>
                        <li style="margin-bottom: 0.5rem;">✓ Data e hora das operações</li>
                        <li style="margin-bottom: 0.5rem;">✓ Filtros por data, usuário e tipo de operação</li>
                        <li>✓ Detalhes das modificações realizadas</li>
                    </ul>
                </div>
            </div>
        `;
    };

    render();
    return container;
};
