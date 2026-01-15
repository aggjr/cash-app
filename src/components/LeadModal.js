import { getApiBaseUrl } from '../utils/apiConfig.js';
import { showToast } from '../utils/toast.js';

export const LeadModal = {
    show({ lead = null, onSave }) {
        return new Promise(async (resolve) => {
            try {
                const API_BASE_URL = getApiBaseUrl();
                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                const isEdit = lead !== null;
                let groups = [];
                const token = localStorage.getItem('token');

                // Fetch Groups
                try {
                    const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        groups = await response.json();
                    }
                } catch (error) {
                    console.error('Error loading groups:', error);
                    showToast('Erro ao carregar grupos de leads', 'error');
                }

                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';
                overlay.style.zIndex = '1000';

                const modal = document.createElement('div');
                modal.className = 'account-modal animate-float-in';
                modal.style.maxWidth = '600px';
                modal.style.width = '95%';

                modal.innerHTML = `
                    <div class="account-modal-body" style="padding: 1.5rem;">
                        <h3 style="margin: 0 0 1.5rem 0; color: var(--color-primary); font-size: 1.25rem;">
                            ${isEdit ? '✏️ Editar Lead' : '✨ Novo Lead'}
                        </h3>
                        
                        <div class="form-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                            
                            <div class="form-group">
                                <label for="lead-nome">Nome <span class="required">*</span></label>
                                <input type="text" id="lead-nome" class="form-input" 
                                    value="${lead?.nome || ''}" placeholder="Nome completo do lead" required />
                            </div>

                            <div class="form-group">
                                <label for="lead-email">E-mail</label>
                                <input type="email" id="lead-email" class="form-input" 
                                    value="${lead?.email || ''}" placeholder="email@exemplo.com" />
                            </div>

                            <div class="form-group">
                                <label for="lead-telefone">Telefone</label>
                                <input type="text" id="lead-telefone" class="form-input" 
                                    value="${lead?.telefone || ''}" placeholder="(00) 00000-0000" />
                            </div>

                            <div class="form-group">
                                <label for="lead-grupo">Grupo</label>
                                <select id="lead-grupo" class="form-input">
                                    <option value="">Selecione um grupo...</option>
                                    ${groups.map(g => `
                                        <option value="${g.id}" ${lead?.grupo_id === g.id ? 'selected' : ''}>${g.nome}</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="lead-observacoes">Observações</label>
                                <textarea id="lead-observacoes" class="form-input" rows="3" 
                                    placeholder="Informações adicionais...">${lead?.observacoes || ''}</textarea>
                            </div>

                        </div>
                    </div>
                    
                    <div class="account-modal-footer" style="padding: 1rem; border-top: 1px solid var(--color-border-light);">
                        <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                        <button class="btn-primary" id="modal-save" type="button">
                            ${isEdit ? 'Salvar Alterações' : 'Criar Lead'}
                        </button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // Elements
                const nomeInput = modal.querySelector('#lead-nome');
                const emailInput = modal.querySelector('#lead-email');
                const telefoneInput = modal.querySelector('#lead-telefone');
                const grupoSelect = modal.querySelector('#lead-grupo');
                const observacoesInput = modal.querySelector('#lead-observacoes');
                const saveBtn = modal.querySelector('#modal-save');
                const cancelBtn = modal.querySelector('#modal-cancel');

                // Validation
                const validate = () => {
                    let isValid = true;

                    if (!nomeInput.value.trim()) {
                        nomeInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        nomeInput.classList.remove('input-error');
                    }

                    if (emailInput.value && !isValidEmail(emailInput.value)) {
                        emailInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        emailInput.classList.remove('input-error');
                    }

                    return isValid;
                };

                const isValidEmail = (email) => {
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                };

                // Focus first field
                setTimeout(() => nomeInput.focus(), 100);

                // Event Listeners
                cancelBtn.onclick = () => {
                    container.removeChild(overlay);
                    resolve(null);
                };

                // Close on overlay click
                overlay.onclick = (e) => {
                    if (e.target === overlay) {
                        container.removeChild(overlay);
                        resolve(null);
                    }
                };

                saveBtn.onclick = async () => {
                    if (!validate()) {
                        showToast('Verifique os campos obrigatórios', 'warning');
                        return;
                    }

                    const leadData = {
                        nome: nomeInput.value.trim(),
                        email: emailInput.value.trim() || null,
                        telefone: telefoneInput.value.trim() || null,
                        grupoId: grupoSelect.value ? parseInt(grupoSelect.value) : null,
                        observacoes: observacoesInput.value.trim() || null
                    };

                    // Show saving state
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Salvando...';

                    try {
                        await onSave(leadData);
                        container.removeChild(overlay);
                        resolve(true);
                    } catch (error) {
                        console.error(error);
                        saveBtn.disabled = false;
                        saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Lead';
                    }
                };

            } catch (error) {
                console.error('Error in LeadModal:', error);
                resolve(null);
            }
        });
    }
};
