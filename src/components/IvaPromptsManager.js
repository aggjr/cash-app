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
        mode: 'prompts', // 'prompts' | 'audit'

        // Prompts State
        prompts: {},
        activeTab: 'system',
        editedContent: '',
        saving: false,

        // Audit State
        auditLoading: false,
        pendingKnowledge: [],
        scopeFilter: '',

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

            <div id="mode-content">
                ${state.mode === 'prompts' ? renderPromptsUI() : renderAuditUI()}
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

    // --- AUDIT UI GEN ---
    const renderAuditUI = () => {
        if (state.auditLoading) {
            return '<div class="loading">Carregando auditoria...</div>';
        }

        const filtered = state.pendingKnowledge.filter(item =>
            !state.scopeFilter || item.layer === state.scopeFilter
        );

        return `
            <div class="audit-container">
                <div class="audit-toolbar">
                    <div class="audit-filters">
                        <select id="audit-scope-filter">
                            <option value="">Todos os Escopos</option>
                            <option value="GLOBAL" ${state.scopeFilter === 'GLOBAL' ? 'selected' : ''}>Global</option>
                            <option value="DEPARTMENT" ${state.scopeFilter === 'DEPARTMENT' ? 'selected' : ''}>Departamento</option>
                            <option value="ROLE" ${state.scopeFilter === 'ROLE' ? 'selected' : ''}>Cargo</option>
                        </select>
                    </div>
                    <div>
                        <strong>${filtered.length}</strong> itens pendentes
                    </div>
                </div>

                <div class="audit-table-wrapper">
                    ${filtered.length === 0 ? `
                        <div style="text-align:center; padding: 3rem; color: #666;">
                            🎉 Nenhum item pendente para este filtro!
                        </div>
                    ` : `
                        <table class="audit-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Tipo</th>
                                    <th>Escopo</th>
                                    <th style="width: 50%;">Conhecimento</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.map(item => renderAuditRow(item)).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
    };

    const renderAuditRow = (item) => {
        const isNew = item.audit_action === 'CREATE';
        const date = new Date(item.created_at).toLocaleDateString('pt-BR');

        let contentHtml = '';
        if (isNew) {
            contentHtml = `<div class="audit-desc">${escapeHtml(item.description || item.text || '')}</div>`;
        } else {
            // Updated item - Show Diff
            contentHtml = `
                <div class="audit-desc">
                    <span class="diff-old">Antigo: ${escapeHtml(item.previous_description || '(Sem histórico)')}</span>
                    <span class="diff-new">Novo: ${escapeHtml(item.description || item.text || '')}</span>
                </div>
            `;
        }

        const badgeType = isNew ? '<span class="badge badge-new">Novo</span>' : '<span class="badge badge-update">Alteração</span>';
        const badgeScope = `<span class="badge badge-scope-${item.layer?.toLowerCase() || 'global'}">${item.layer}</span>`;

        return `
            <tr>
                <td style="white-space:nowrap; color:#666;">${date}</td>
                <td>${badgeType}</td>
                <td>${badgeScope}</td>
                <td>${contentHtml}</td>
                <td style="white-space:nowrap;">
                    <button class="action-btn btn-approve" data-id="${item.id}" title="Aprovar">✅</button>
                    <button class="action-btn btn-edit" data-id="${item.id}" title="Editar">✏️</button>
                    <button class="action-btn btn-reject" data-id="${item.id}" title="Rejeitar/Excluir">❌</button>
                </td>
            </tr>
        `;
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
        else attachAuditListeners();
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
        if (revertBtn) revertBtn.addEventListener('click', () => {
            if (confirm('Descartar alterações?')) {
                state.editedContent = state.prompts[state.activeTab] || '';
                render();
            }
        });

        const refreshCtxBtn = container.querySelector('#btn-refresh-context');
        if (refreshCtxBtn) refreshCtxBtn.addEventListener('click', loadDebugContext);
    };

    const attachAuditListeners = () => {
        // Filter
        const filter = container.querySelector('#audit-scope-filter');
        if (filter) {
            filter.addEventListener('change', (e) => {
                state.scopeFilter = e.target.value;
                render();
            });
        }

        // Actions
        container.querySelectorAll('.btn-approve').forEach(btn => {
            btn.addEventListener('click', () => handleApprove(btn.dataset.id));
        });
        container.querySelectorAll('.btn-reject').forEach(btn => {
            btn.addEventListener('click', () => handleReject(btn.dataset.id));
        });
        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => handleEdit(btn.dataset.id));
        });
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
            // Only render if in prompt mode to avoid switching user context
            if (state.mode === 'prompts') render();
        } catch (error) {
            console.error(error);
            state.loading = false;
        }
    };

    const handleSavePrompt = async () => {
        if (!confirm(`Salvar prompt "${state.activeTab}"?`)) return;
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

    const loadDebugContext = async () => { /* ... existing ... */ };

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

    const handleApprove = async (id) => {
        if (!confirm('Aprovar este conhecimento?')) return;
        try {
            const response = await fetch(`${API_BASE_URL}/iva/knowledge/approve`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ id })
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
        if (!confirm('Rejeitar e EXCLUIR este conhecimento?')) return;
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

        const currentText = item.description || item.text || '';
        const newText = prompt('Refinar o conhecimento:', currentText);

        if (newText !== null && newText !== currentText) {
            // Approve with refinement
            // Or update "pending" state? User objective: "Edit: Allow refinement of knowledge description before approval."
            // Action usually implies "Edit then Approve" or "Save as Pending"? 
            // Logic in backend 'approveKnowledge' accepts refinedText.
            // So here we can just Approve with the new text immediately.

            if (confirm('Aprovar com o novo texto editado?')) {
                try {
                    const response = await fetch(`${API_BASE_URL}/iva/knowledge/approve`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ id, refinedText: newText })
                    });
                    if (!response.ok) throw new Error('Erro ao aprovar edição');

                    state.pendingKnowledge = state.pendingKnowledge.filter(i => i.id !== id);
                    state.message = { type: 'success', text: 'Conhecimento editado e aprovado!' };
                    render();
                } catch (e) {
                    alert(e.message);
                }
            }
        }
    };

    // Initialize
    loadPrompts();

    return container;
};
