import { getApiBaseUrl } from '../utils/apiConfig.js';
import '../styles/IvaPromptsManager.css';

export const IvaPromptsManager = () => {
    // Create container
    const container = document.createElement('div');
    container.className = 'iva-prompts-manager';
    const API_BASE_URL = getApiBaseUrl();

    // Helper for headers
    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // State
    const state = {
        prompts: {},
        activeTab: 'system',
        editedContent: '',
        saving: false,
        message: { type: '', text: '' },
        loading: true
    };

    // Render Function
    const render = () => {
        // If loading
        if (state.loading) {
            container.innerHTML = '<div class="loading">Carregando prompts...</div>';
            return;
        }

        const availableTabsKey = [...Object.keys(state.prompts), 'consolidated'];

        // Custom ordering: system -> module -> company -> department -> role -> user
        // Custom ordering: system -> module -> company -> department -> role -> user
        const allowedTabs = ['system', 'module', 'company', 'department', 'role', 'user', 'consolidated'];

        // Filter out any unexpected tabs (like dynamic role_admin etc)
        const filteredTabs = availableTabsKey.filter(key => allowedTabs.includes(key));

        const availableTabs = filteredTabs.sort((a, b) => {
            return allowedTabs.indexOf(a) - allowedTabs.indexOf(b);
        });

        const hasChanges = state.editedContent !== (state.prompts[state.activeTab] || '');

        // Label mapping
        const getTabLabel = (key) => {
            const map = {
                'system': '🌐 Sistema (ERP)',
                'module': '📦 Módulo (CASH)',
                'company': '🏢 Empresa',
                'department': '📂 Departamento',
                'role': '💼 Cargo',
                'role': '💼 Cargo',
                'user': '👤 Usuário',
                'consolidated': '🧠 Contexto Real (Debug)'
            };
            return map[key] || ('💬 ' + key);
        };

        // Construct HTML
        container.innerHTML = `
            <div class="prompts-header">
                <h3>⚙️ Gerenciamento de Prompts IVA</h3>
                <p class="prompts-warning">
                    ⚠️ <strong>Atenção:</strong> Alterações nos prompts afetam imediatamente o comportamento da IVA.
                    Apenas administradores devem editar.
                </p>
            </div>

            ${state.message.text ? `
                <div class="message message-${state.message.type}">
                    ${state.message.text}
                </div>
            ` : ''}

            <div class="prompts-tabs">
                ${availableTabs.map(tab => `
                    <button
                        class="tab-button ${state.activeTab === tab ? 'active' : ''}"
                        data-tab="${tab}"
                    >
                        ${getTabLabel(tab)}
                    </button>
                `).join('')}
            </div>

            <div class="prompts-editor-container">
                <div class="editor-toolbar">
                    <span class="editor-label">
                        Editando: <strong>${state.activeTab}</strong>
                    </span>
                    <div class="editor-stats">
                        ${state.editedContent.length} caracteres | ${state.editedContent.split('\n').length} linhas
                        ${state.activeTab === 'consolidated' ? '<span class="readonly-indicator"> ● Somente Leitura</span>' : (hasChanges ? '<span class="unsaved-indicator"> ● Não salvo</span>' : '')}
                    </div>
                </div>

                <textarea
                    class="prompts-editor"
                    placeholder="Conteúdo do prompt..."
                    spellcheck="false"
                    id="prompts-textarea"
                    ${state.activeTab === 'consolidated' ? 'readonly style="background:#f8fafc; color:#334155;"' : ''}
                >${state.editedContent}</textarea>

                <div class="editor-actions">
                    ${state.activeTab === 'consolidated' ? `
                        <button class="btn-revert" id="btn-refresh-context" style="background:#0ea5e9; color:white;">
                            🔄 Recarregar Contexto
                        </button>
                    ` : `
                    <button
                        class="btn-revert"
                        id="btn-revert"
                        ${(!hasChanges || state.saving) ? 'disabled' : ''}
                    >
                        ↺ Reverter
                    </button>
                    <button
                        class="btn-save"
                        id="btn-save"
                        ${(!hasChanges || state.saving) ? 'disabled' : ''}
                    >
                        ${state.saving ? '💾 Salvando...' : '💾 Salvar Prompt'}
                    </button>
                    `}
                </div>
            </div>

            <div class="prompts-footer">
                <small>
                    <strong>Dica:</strong> Use ctrl+F para buscar no texto.
                    Mudanças são aplicadas imediatamente após salvar.
                </small>
            </div>
        `;

        attachListeners();
    };

    // Event Listeners
    const attachListeners = () => {
        // Tab switching
        const tabs = container.querySelectorAll('.tab-button');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const newTab = tab.dataset.tab;
                if (newTab !== state.activeTab) {
                    state.activeTab = newTab;
                    if (newTab === 'consolidated') {
                        state.editedContent = 'Carregando contexto em tempo real...';
                        loadDebugContext();
                    } else {
                        state.editedContent = state.prompts[newTab] || '';
                    }
                    state.message = { type: '', text: '' }; // Clear messages on tab switch
                    render();
                }
            });
        });

        // Textarea input
        const textarea = container.querySelector('#prompts-textarea');
        if (textarea) {
            textarea.addEventListener('input', (e) => {
                state.editedContent = e.target.value;
                // Re-render only parts if performance is issue, but full render is safer for sync
                // For smoother typing, we might strictly update DOM buttons, but let's try full render first.
                // Actually, full render on every keystroke loses focus. BAD IDEA.
                // We should only update the stats and buttons.
                updateUIState();
            });
        }

        // Save button
        const saveBtn = container.querySelector('#btn-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', handleSave);
        }

        // Revert button
        const revertBtn = container.querySelector('#btn-revert');
        if (revertBtn) {
            revertBtn.addEventListener('click', handleRevert);
        }

        // Refresh context button
        const refreshCtxBtn = container.querySelector('#btn-refresh-context');
        if (refreshCtxBtn) {
            refreshCtxBtn.addEventListener('click', loadDebugContext);
        }
    };

    // UI Partial Update (to avoid losing focus on textarea)
    const updateUIState = () => {
        const hasChanges = state.editedContent !== (state.prompts[state.activeTab] || '');

        // Update stats
        const statsEl = container.querySelector('.editor-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                ${state.editedContent.length} caracteres | ${state.editedContent.split('\n').length} linhas
                ${hasChanges ? '<span class="unsaved-indicator"> ● Não salvo</span>' : ''}
            `;
        }

        // Update buttons
        const saveBtn = container.querySelector('#btn-save');
        const revertBtn = container.querySelector('#btn-revert');

        if (saveBtn) saveBtn.disabled = !hasChanges || state.saving;
        if (revertBtn) revertBtn.disabled = !hasChanges || state.saving;
    };

    // Logic Functions
    const loadPrompts = async () => {
        try {
            state.loading = true;
            render();

            const response = await fetch(`${API_BASE_URL}/iva-prompts`, {
                headers: getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load prompts');

            const data = await response.json();
            state.prompts = data.prompts || {};

            // Set initial content if active tab exists
            if (state.prompts[state.activeTab]) {
                state.editedContent = state.prompts[state.activeTab];
            } else {
                // If system tab is missing, pick first available
                const keys = Object.keys(state.prompts);
                if (keys.length > 0) {
                    state.activeTab = keys[0];
                    state.editedContent = state.prompts[keys[0]];
                }
            }

            state.loading = false;
            render();
        } catch (error) {
            console.error('Error loading prompts:', error);
            state.message = { type: 'error', text: 'Erro ao carregar prompts' };
            state.loading = false;
            render();
        }
    };

    const loadDebugContext = async () => {
        try {
            state.editedContent = 'Carregando contexto real do usuário...';
            // Force update UI via DOM instead of full render to avoid flickering if possible, but render is safer
            const textarea = container.querySelector('#prompts-textarea');
            if (textarea) textarea.value = state.editedContent;

            const response = await fetch(`${API_BASE_URL}/iva-prompts/debug-context`, {
                headers: getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load debug context');

            const data = await response.json();
            state.editedContent = data.resolvedPrompt || '(Contexto vazio)';

            // If we are still on that tab, render
            if (state.activeTab === 'consolidated') render();

        } catch (error) {
            console.error('Error loading debug context:', error);
            state.editedContent = `Erro ao carregar contexto: ${error.message}`;
            if (state.activeTab === 'consolidated') render();
        }
    };

    const handleSave = async () => {
        if (state.saving) return;

        const confirmed = window.confirm(
            `Tem certeza que deseja salvar o prompt "${state.activeTab}"?\n\n` +
            'Isso afetará imediatamente o comportamento da IVA para todos os usuários.'
        );

        if (!confirmed) return;

        try {
            state.saving = true;
            state.message = { type: '', text: '' };
            render(); // disabled buttons

            const response = await fetch(`${API_BASE_URL}/iva-prompts/${state.activeTab}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ content: state.editedContent })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao salvar prompt');
            }

            state.prompts[state.activeTab] = state.editedContent;

            state.message = {
                type: 'success',
                text: 'Prompt salvo com sucesso! A IVA está usando o novo comportamento.'
            };

        } catch (error) {
            console.error('Error saving prompt:', error);
            state.message = {
                type: 'error',
                text: error.message || 'Erro ao salvar prompt'
            };
        } finally {
            state.saving = false;
            render();
        }
    };

    const handleRevert = () => {
        const confirmed = window.confirm(
            'Descartar todas as alterações não salvas?'
        );

        if (confirmed) {
            state.editedContent = state.prompts[state.activeTab] || '';
            state.message = { type: 'info', text: 'Alterações descartadas' };
            render();
        }
    };

    // Initialize
    loadPrompts();

    // Auto-refresh poll (every 5s)
    const pollInterval = setInterval(() => {
        // Self-cleanup: Stop polling if component is removed from DOM
        if (!container.isConnected) {
            clearInterval(pollInterval);
            return;
        }

        // Only refresh if no unsaved changes
        const hasChanges = state.editedContent !== (state.prompts[state.activeTab] || '');
        if (!hasChanges && !state.saving) {
            // Background load without showing full loading state
            fetch(`${API_BASE_URL}/iva-prompts`, { headers: getHeaders() })
                .then(res => res.json())
                .then(data => {
                    if (data.prompts) {
                        const currentRemote = data.prompts[state.activeTab];
                        const oldRemote = state.prompts[state.activeTab];

                        // Update state
                        state.prompts = data.prompts;

                        // If the currently viewed tab changed remotely, update editor
                        if (currentRemote && currentRemote !== oldRemote) {
                            state.editedContent = currentRemote;
                            state.message = {
                                type: 'info',
                                text: '🔄 O prompt foi atualizado externamente. Exibindo versão mais recente.'
                            };
                            render();
                        }
                    }
                })
                .catch(() => { }); // Silent fail on background poll
        }
    }, 5000);

    // Cleanup interval when component is unmounted (if applicable in this framework)
    // Note: Since this is Vanilla JS injected, we rely on page refresh or parent to cleanup.
    // Ideally store pollInterval on the container for external cleanup.
    container._pollInterval = pollInterval;

    return container;
};
