import { getApiBaseUrl } from '../utils/apiConfig.js';
import { SharedTable } from './SharedTable.js';
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
        mode: 'prompts', // 'prompts' | 'audit'

        // Prompts State
        prompts: {},
        activeTab: 'system',
        editedContent: '',
        saving: false,

        // Audit State
        auditLoading: false,
        pendingKnowledge: [],
        auditTableInstance: null, // SharedTable instance

        message: { type: '', text: '' },
        loading: true
    };

    // Render Function
    const render = () => {
        // Main Container Structure
        container.innerHTML = `
            <div class="prompts-header">
                <div class="mode-switcher">
                    <button class="mode-btn ${state.mode === 'prompts' ? 'active' : ''}" id="mode-prompts">
                        📝 Editor de Prompts
                    </button>
                    <button class="mode-btn ${state.mode === 'audit' ? 'active' : ''}" id="mode-audit">
                        🎓 Gestão do Aprendizado
                    </button>
                </div>
                
                ${state.mode === 'prompts' ? `
                    <h3>⚙️ Gerenciamento de Prompts IVA</h3>
                    <p class="prompts-warning">
                        ⚠️ <strong>Atenção:</strong> Alterações nos prompts afetam imediatamente o comportamento da IVA.
                    </p>
                ` : `
                    <h3>🎓 Auditoria de Conhecimento</h3>
                    <p class="prompts-warning" style="background: #e8f5e9; border-color: #28a745; color: #155724;">
                        ✅ <strong>Aprovação Necessária:</strong> Estes itens foram aprendidos pela IVA e aguardam validação para entrar em vigor.
                    </p>
                `}
            </div>

            ${state.message.text ? `
                <div class="message message-${state.message.type}">
                    ${state.message.text}
                </div>
            ` : ''}

            <div id="mode-content" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 400px;">
                ${state.mode === 'prompts' ? renderPromptsUI() : '<div id="audit-table-container" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;"></div>'}
            </div>
            
            <div class="prompts-footer">
                <small>
                    ${state.mode === 'prompts' ?
                '<strong>Dica:</strong> Use ctrl+F para buscar no texto. Mudanças são aplicadas imediatamente após salvar.' :
                '<strong>Nota:</strong> Itens aprovados tornam-se parte permanente do conhecimento da IVA (Camada Global/Dept/Cargo).'}
                </small>
            </div>
        `;

        attachListeners();

        // If in Audit mode, init/render table
        if (state.mode === 'audit') {
            initAuditTable();
        }
    };

    // --- PROMPTS UI GEN ---
    const renderPromptsUI = () => {
        if (state.loading && !state.prompts.system) { // Initial load check
            return '<div class="loading">Carregando prompts...</div>';
        }

        const availableTabsKey = [...Object.keys(state.prompts), 'consolidated'];
        const allowedTabs = ['system', 'module', 'company', 'department', 'role', 'user', 'consolidated'];
        const filteredTabs = availableTabsKey.filter(key => allowedTabs.includes(key));
        const availableTabs = filteredTabs.sort((a, b) => allowedTabs.indexOf(a) - allowedTabs.indexOf(b));
        const hasChanges = state.editedContent !== (state.prompts[state.activeTab] || '');

        const getTabLabel = (key) => {
            const map = {
                'system': '🌐 Sistema (ERP)',
                'module': '📦 Módulo (CASH)',
                'company': '🏢 Empresa',
                'department': '📂 Departamento',
                'role': '💼 Cargo',
                'user': '👤 Usuário',
                'consolidated': '🧠 Contexto Real (Debug)'
            };
            return map[key] || ('💬 ' + key);
        };

        return `
            <div class="prompts-tabs">
                ${availableTabs.map(tab => `
                    <button class="tab-button ${state.activeTab === tab ? 'active' : ''}" data-tab="${tab}">
                        ${getTabLabel(tab)}
                    </button>
                `).join('')}
            </div>

            <div class="prompts-editor-container">
                <div class="editor-toolbar">
                    <span class="editor-label">Editando: <strong>${state.activeTab}</strong></span>
                    <div class="editor-stats">
                        ${state.editedContent.length} caracteres | ${state.editedContent.split('\n').length} linhas
                        ${state.activeTab === 'consolidated' ? '<span class="readonly-indicator"> ● Somente Leitura</span>' : (hasChanges ? '<span class="unsaved-indicator"> ● Não salvo</span>' : '')}
                    </div>
                </div>

                <textarea class="prompts-editor" id="prompts-textarea" spellcheck="false"
                    ${state.activeTab === 'consolidated' ? 'readonly style="background:#f8fafc; color:#334155;"' : ''}
                >${state.editedContent}</textarea>

                <div class="editor-actions">
                    ${state.activeTab === 'consolidated' ? `
                        <button class="btn-revert" id="btn-refresh-context" style="background:#0ea5e9; color:white;">🔄 Recarregar Contexto</button>
                    ` : `
                        <button class="btn-revert" id="btn-revert" ${(!hasChanges || state.saving) ? 'disabled' : ''}>↺ Reverter</button>
                        <button class="btn-save" id="btn-save" ${(!hasChanges || state.saving) ? 'disabled' : ''}>
                            ${state.saving ? '💾 Salvando...' : '💾 Salvar Prompt'}
                        </button>
                    `}
                </div>
            </div>
        `;
    };

    // --- AUDIT TABLE LOGIC ---
    const initAuditTable = () => {
        const tableContainer = container.querySelector('#audit-table-container');
        if (!tableContainer) return;

        if (state.auditLoading) {
            tableContainer.innerHTML = '<div class="loading">Carregando auditoria...</div>';
            return;
        }

        // Define Columns
        const columns = [
            {
                key: 'created_at', label: 'Data', type: 'date', width: '100px', align: 'left', sortable: true,
                render: (item) => {
                    if (!item.created_at) return '-';
                    return new Date(item.created_at).toLocaleDateString('pt-BR');
                }
            },
            {
                key: 'user_name', label: 'Usuário', type: 'text', width: '120px', align: 'left', sortable: true,
                render: (item) => {
                    // Fallback to user_id or 'Sistema' if name is missing (legacy)
                    return escapeHtml(item.user_name || item.user_id || 'Sistema');
                }
            },
            {
                key: 'audit_action', label: 'Tipo', width: '100px', align: 'center', sortable: true,
                render: (item) => {
                    const isNew = item.audit_action === 'CREATE';
                    return isNew
                        ? '<span class="badge badge-new" style="background:#e3f2fd; color:#1565c0; padding:4px 8px; border-radius:4px; font-size:0.8em;">Novo</span>'
                        : '<span class="badge badge-update" style="background:#fff3e0; color:#ef6c00; padding:4px 8px; border-radius:4px; font-size:0.8em;">Alteração</span>';
                }
            },
            {
                key: 'layer', label: 'Escopo', width: '120px', align: 'center', sortable: true,
                render: (item) => {
                    const colors = {
                        'GLOBAL': '#616161',
                        'department': '#7b1fa2',
                        'role': '#0288d1',
                        'user': '#388e3c'
                    };
                    const color = colors[item.layer] || colors[item.layer?.toLowerCase()] || '#616161';
                    return `<span class="badge" style="background:${color}15; color:${color}; padding:4px 8px; border-radius:4px; font-size:0.8em; font-weight:600;">${item.layer}</span>`;
                }
            },
            {
                key: 'description', label: 'Conhecimento (Fato)', type: 'text', align: 'left',
                render: (item) => {
                    const isNew = item.audit_action === 'CREATE';
                    if (isNew) {
                        return `<div style="white-space:pre-wrap; font-size:0.9em; max-height:100px; overflow-y:auto;">${escapeHtml(item.description || item.text || '')}</div>`;
                    } else {
                        return `
                            <div style="font-size:0.9em;">
                                <div style="color:#d32f2f; margin-bottom:4px; font-size:0.85em;"><strong>Antigo:</strong> ${escapeHtml(item.previous_description || '(Sem histórico)')}</div>
                                <div style="color:#2e7d32;"><strong>Novo:</strong> ${escapeHtml(item.description || item.text || '')}</div>
                            </div>
                        `;
                    }
                }
            },
            {
                key: 'proposed_prompt', label: 'Prompt Proposto', type: 'text', align: 'left',
                render: (item) => {
                    // If backend didn't provide proposed_prompt (legacy), try to fallback or show placeholder
                    const prompt = item.proposed_prompt || '(Será gerado ao aprovar)';
                    const isGenerated = !item.proposed_prompt;
                    return `<div style="white-space:pre-wrap; font-size:0.9em; font-family:monospace; color:${isGenerated ? '#999' : '#333'}; max-height:100px; overflow-y:auto;">${escapeHtml(prompt)}</div>`;
                }
            },
            {
                key: 'actions', label: 'Ações', width: '140px', align: 'center', noFilter: true,
                render: (item) => {
                    const div = document.createElement('div');
                    div.style.display = 'flex';
                    div.style.gap = '8px';
                    div.style.justifyContent = 'center';

                    const btnApprove = document.createElement('button');
                    btnApprove.innerHTML = '✅';
                    btnApprove.title = 'Aprovar';
                    btnApprove.className = 'action-btn';
                    btnApprove.style.border = 'none'; btnApprove.style.background = 'transparent'; btnApprove.style.cursor = 'pointer'; btnApprove.style.fontSize = '1.2em';
                    btnApprove.onclick = () => handleApprove(item.id);

                    const btnEdit = document.createElement('button');
                    btnEdit.innerHTML = '✏️';
                    btnEdit.title = 'Editar';
                    btnEdit.className = 'action-btn';
                    btnEdit.style.border = 'none'; btnEdit.style.background = 'transparent'; btnEdit.style.cursor = 'pointer'; btnEdit.style.fontSize = '1.2em';
                    btnEdit.onclick = () => handleEdit(item.id);

                    const btnReject = document.createElement('button');
                    btnReject.innerHTML = '❌';
                    btnReject.title = 'Rejeitar';
                    btnReject.className = 'action-btn';
                    btnReject.style.border = 'none'; btnReject.style.background = 'transparent'; btnReject.style.cursor = 'pointer'; btnReject.style.fontSize = '1.2em';
                    btnReject.onclick = () => handleReject(item.id);

                    div.appendChild(btnApprove);
                    div.appendChild(btnEdit);
                    div.appendChild(btnReject);
                    return div;
                }
            }
        ];

        // Instantiate SharedTable
        state.auditTableInstance = new SharedTable({
            container: tableContainer,
            columns: columns,
            projectId: null,
            endpointPrefix: null, // Client-side mode
            enableSelection: false // No massive selection needed for now
        });

        // Render Data
        state.auditTableInstance.render(state.pendingKnowledge);
    };

    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // Event Listeners
    const attachListeners = () => {
        // Mode Switching
        const modePrompts = container.querySelector('#mode-prompts');
        const modeAudit = container.querySelector('#mode-audit');

        if (modePrompts) modePrompts.onclick = () => { state.mode = 'prompts'; render(); };
        if (modeAudit) modeAudit.onclick = () => {
            state.mode = 'audit';
            loadPendingKnowledge(); // Trigger load
            render();
        };

        if (state.mode === 'prompts') attachPromptsListeners();
        // Audit listeners handled inside table render usually, but top level ones here
    };

    const attachPromptsListeners = () => {
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
                    state.message = { type: '', text: '' };
                    render();
                }
            });
        });

        const textarea = container.querySelector('#prompts-textarea');
        if (textarea) textarea.addEventListener('input', (e) => {
            state.editedContent = e.target.value;
            // Only update UI parts to avoid focus loss
            const hasChanges = state.editedContent !== (state.prompts[state.activeTab] || '');
            const stats = container.querySelector('.editor-stats');
            const saveBtn = container.querySelector('#btn-save');
            const revertBtn = container.querySelector('#btn-revert');

            if (stats) stats.innerHTML = `${state.editedContent.length} chars | ${state.editedContent.split('\n').length} lines ${hasChanges ? '<span class="unsaved-indicator">● Não salvo</span>' : ''}`;
            if (saveBtn) saveBtn.disabled = !hasChanges || state.saving;
            if (revertBtn) revertBtn.disabled = !hasChanges || state.saving;
        });

        const saveBtn = container.querySelector('#btn-save');
        if (saveBtn) saveBtn.addEventListener('click', handleSavePrompt);

        const revertBtn = container.querySelector('#btn-revert');
        if (revertBtn) revertBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmationModal(
                'Reverter Alterações',
                'Tem certeza que deseja descartar todas as alterações não salvas?'
            );
            if (confirmed) {
                state.editedContent = state.prompts[state.activeTab] || '';
                render();
            }
        });

        const refreshCtxBtn = container.querySelector('#btn-refresh-context');
        if (refreshCtxBtn) refreshCtxBtn.addEventListener('click', loadDebugContext);
    };

    // --- LOGIC: PROMPTS ---
    const loadPrompts = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/iva-prompts`, { headers: getHeaders() });
            if (!response.ok) throw new Error('Failed to load prompts');
            const data = await response.json();
            state.prompts = data.prompts || {};

            if (!state.prompts[state.activeTab]) {
                const keys = Object.keys(state.prompts);
                if (keys.length > 0) {
                    state.activeTab = keys[0];
                    state.editedContent = state.prompts[keys[0]];
                }
            } else {
                state.editedContent = state.prompts[state.activeTab];
            }
            state.loading = false;
            // Only render if in prompt mode
            if (state.mode === 'prompts') render();
        } catch (error) {
            console.error(error);
            state.loading = false;
        }
    };

    const handleSavePrompt = async () => {
        const confirmed = await showConfirmationModal(
            'Salvar Prompt',
            `Deseja realmente salvar as alterações no prompt "<strong>${state.activeTab}</strong>"?<br><br>As mudanças entram em vigor imediatamente.`
        );
        if (!confirmed) return;

        try {
            state.saving = true;
            render();
            const response = await fetch(`${API_BASE_URL}/iva-prompts/${state.activeTab}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ content: state.editedContent })
            });
            if (!response.ok) throw new Error('Erro ao salvar');

            state.prompts[state.activeTab] = state.editedContent;
            state.message = { type: 'success', text: 'Prompt salvo!' };
        } catch (e) {
            state.message = { type: 'error', text: e.message };
        } finally {
            state.saving = false;
            render();
        }
    };

    const loadDebugContext = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/iva/debug-context`, { headers: getHeaders() });
            if (!response.ok) throw new Error('Failed to load context');
            const data = await response.text();
            state.editedContent = data; // It returns Markdown usually
            const textarea = container.querySelector('#prompts-textarea');
            if (textarea) textarea.value = data;
        } catch (e) {
            state.editedContent = 'Erro ao carregar contexto: ' + e.message;
            render();
        }
    };

    // --- LOGIC: AUDIT ---
    const loadPendingKnowledge = async () => {
        try {
            state.auditLoading = true;
            render();
            const response = await fetch(`${API_BASE_URL}/iva/knowledge/pending`, { headers: getHeaders() });
            if (!response.ok) throw new Error('Falha ao carregar auditoria');
            state.pendingKnowledge = await response.json();
            state.auditLoading = false;
            render();
        } catch (e) {
            state.message = { type: 'error', text: 'Erro ao carregar dados de auditoria.' };
            state.auditLoading = false;
            render();
        }
    };

    const handleApprove = async (id, refinedText = null) => {
        if (!refinedText) {
            const confirmed = await showConfirmationModal('Aprovar Conhecimento', 'Tem certeza que deseja aprovar e incorporar este conhecimento à base da IVA?');
            if (!confirmed) return;
        }

        try {
            const body = { id };
            if (refinedText) body.refinedText = refinedText;

            const response = await fetch(`${API_BASE_URL}/iva/knowledge/approve`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error('Erro ao aprovar');

            // Remove from list
            state.pendingKnowledge = state.pendingKnowledge.filter(i => i.id !== id);
            state.message = { type: 'success', text: 'Conhecimento aprovado!' };
            render();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleReject = async (id) => {
        const confirmed = await showConfirmationModal(
            'Rejeitar Conhecimento',
            'Tem certeza que deseja <strong>rejeitar e excluir</strong> permanentemente este item?',
            'Rejeitar e Excluir'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/iva/knowledge/reject`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ id })
            });
            if (!response.ok) throw new Error('Erro ao rejeitar');

            state.pendingKnowledge = state.pendingKnowledge.filter(i => i.id !== id);
            state.message = { type: 'info', text: 'Conhecimento rejeitado e removido.' };
            render();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleEdit = async (id) => {
        const item = state.pendingKnowledge.find(i => i.id === id);
        if (!item) return;

        // Edit the PROPOSED PROMPT if available, otherwise description
        const currentText = item.proposed_prompt || item.description || item.text || '';

        // Use custom input modal
        const newText = await showInputModal('Editar Prompt Final', currentText);

        if (newText !== null && newText !== currentText) {
            // User confirmed inside the Input Modal, so just proceed to Approve
            // No double confirmation needed as the input modal action is "Salvar e Aprovar"
            handleApprove(id, newText);
        }
    };

    // --- UI HELPERS ---
    const showConfirmationModal = async (title, message, confirmText = 'Confirmar', cancelText = 'Cancelar') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '100000'; // High Z-Index

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';
            modal.style.maxWidth = '400px';
            modal.style.padding = '0';
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';

            modal.innerHTML = `
                <div class="account-modal-header" style="background: white; border-bottom: 1px solid #e5e7eb; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 10px; border-radius: 8px 8px 0 0;">
                     <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600;">${title}</h3>
                </div>
                <div class="account-modal-body" style="padding: 1.5rem; color: #4B5563; font-size: 1rem; line-height: 1.5;">
                    ${message}
                </div>
                <div class="account-modal-footer" style="background: #F9FAFB; border-top: 1px solid #e5e7eb; padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem; border-radius: 0 0 8px 8px;">
                    <button class="btn-secondary" id="modal-cancel">
                        ${cancelText}
                    </button>
                    <button class="btn-primary" id="modal-confirm">
                         ${confirmText}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const close = (result) => {
                document.body.removeChild(overlay);
                resolve(result);
            };

            modal.querySelector('#modal-cancel').onclick = () => close(false);
            modal.querySelector('#modal-confirm').onclick = () => close(true);
        });
    };

    const showInputModal = async (title, initialValue = '', confirmText = 'Salvar e Aprovar', cancelText = 'Cancelar') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '100000'; // High Z-Index

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';
            modal.style.maxWidth = '500px';
            modal.style.width = '90%';
            modal.style.padding = '0';
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';

            modal.innerHTML = `
                <div class="account-modal-header" style="background: white; border-bottom: 1px solid #e5e7eb; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 10px; border-radius: 8px 8px 0 0;">
                     <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600;">${title}</h3>
                </div>
                <div class="account-modal-body" style="padding: 1.5rem; color: #4B5563; font-size: 1rem; line-height: 1.5;">
                    <label style="display:block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Prompt Final para o Qdrant:</label>
                    <textarea id="modal-input" style="width: 100%; min-height: 120px; padding: 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-family: monospace; font-size: 0.9em; resize: vertical; box-sizing: border-box;">${escapeHtml(initialValue)}</textarea>
                    <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #6B7280;">Este texto será gravado como a "verdade" no cérebro da IVA. Use com cuidado.</p>
                </div>
                <div class="account-modal-footer" style="background: #F9FAFB; border-top: 1px solid #e5e7eb; padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem; border-radius: 0 0 8px 8px;">
                    <button class="btn-secondary" id="modal-cancel">
                        ${cancelText}
                    </button>
                    <button class="btn-primary" id="modal-confirm">
                         ${confirmText}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const textarea = modal.querySelector('#modal-input');
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);

            const close = (result) => {
                document.body.removeChild(overlay);
                resolve(result);
            };

            modal.querySelector('#modal-cancel').onclick = () => close(null);
            modal.querySelector('#modal-confirm').onclick = () => close(textarea.value);
        });
    };


    // Initialize
    loadPrompts();

    return container;
};
