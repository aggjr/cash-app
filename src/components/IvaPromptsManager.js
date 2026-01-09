import api from '../services/api';
import '../styles/IvaPromptsManager.css';

export const IvaPromptsManager = () => {
    // Create container
    const container = document.createElement('div');
    container.className = 'iva-prompts-manager';

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

        const availableTabs = Object.keys(state.prompts);
        const hasChanges = state.editedContent !== (state.prompts[state.activeTab] || '');

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
                        ${tab === 'system' ? '📋 System' : '💬 ' + tab}
                    </button>
                `).join('')}
            </div>

            <div class="prompts-editor-container">
                <div class="editor-toolbar">
                    <span class="editor-label">
                        Editando: <strong>${state.activeTab}.txt</strong>
                    </span>
                    <div class="editor-stats">
                        ${state.editedContent.length} caracteres | ${state.editedContent.split('\n').length} linhas
                        ${hasChanges ? '<span class="unsaved-indicator"> ● Não salvo</span>' : ''}
                    </div>
                </div>

                <textarea
                    class="prompts-editor"
                    placeholder="Conteúdo do prompt..."
                    spellcheck="false"
                    id="prompts-textarea"
                >${state.editedContent}</textarea>

                <div class="editor-actions">
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
                    state.editedContent = state.prompts[newTab] || '';
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

            const response = await api.get('/iva-prompts');
            state.prompts = response.data.prompts || {};

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

            await api.put(`/iva-prompts/${state.activeTab}`, {
                content: state.editedContent
            });

            state.prompts[state.activeTab] = state.editedContent;

            state.message = {
                type: 'success',
                text: 'Prompt salvo com sucesso! A IVA está usando o novo comportamento.'
            };

        } catch (error) {
            console.error('Error saving prompt:', error);
            state.message = {
                type: 'error',
                text: error.response?.data?.error || 'Erro ao salvar prompt'
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

    return container;
};
