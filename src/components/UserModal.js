import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const UserModal = {
    async show({ user = null, onSave, onCancel }) {
        // Fetch companies first
        const token = localStorage.getItem('token');
        const currentProject = JSON.parse(localStorage.getItem('currentProject'));
        const API_BASE_URL = getApiBaseUrl();
        let companies = [];

        try {
            const response = await fetch(`${API_BASE_URL}/companies?projectId=${currentProject.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                companies = await response.json();
            }
        } catch (error) {
            console.error('Error loading companies:', error);
        }

        return new Promise((resolve) => {
            const container = document.getElementById('custom-dialog-container');
            if (!container) {
                console.error('Dialog container not found');
                resolve(null);
                return;
            }

            const isEdit = user !== null;

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 1.5rem; max-height: 85vh;">
                    <h3 style="margin: 0 0 1rem 0; color: var(--color-primary); font-size: 1.3rem;">${isEdit ? 'Editar Usuário' : 'Convidar Usuário'}</h3>
                    <div class="form-grid" style="gap: 0.5rem;">
                        <!-- First Line: Name + Email side by side -->
                        <div style="display: flex; gap: 1rem; margin-top: 5px;">
                            <div class="form-group" style="flex: 1;">
                                <label for="user-name">Nome <span class="required">*</span></label>
                                <input 
                                    type="text" 
                                    id="user-name" 
                                    class="form-input" 
                                    placeholder="Nome completo do usuário"
                                    value="${user?.name || ''}"
                                    required
                                    ${isEdit ? 'disabled' : ''}
                                />
                            </div>

                            <div class="form-group" style="flex: 1;">
                                <label for="user-email">E-mail <span class="required">*</span></label>
                                <input 
                                    type="email" 
                                    id="user-email" 
                                    class="form-input" 
                                    placeholder="email@exemplo.com"
                                    value="${user?.email || ''}"
                                    required
                                    ${isEdit ? 'disabled' : ''}
                                />
                            </div>
                        </div>

                        <!-- Second Line: Empresa + Departamento side by side -->
                        <div style="display: flex; gap: 1rem; margin-top: 5px;">
                            <div class="form-group" style="flex: 1;">
                                <label for="user-company">Empresa <span class="required">*</span></label>
                                <select 
                                    id="user-company" 
                                    class="form-input"
                                    required
                                    ${isEdit ? 'disabled' : ''} 
                                >
                                    <option value="">Selecione uma empresa</option>
                                    ${companies.map(company => `
                                        <option value="${company.id}" ${user?.company_id == company.id ? 'selected' : ''}>
                                            ${company.name} - ${company.cnpj}
                                        </option>
                                    `).join('')}
                                </select>
                                ${companies.length === 0 ? '<small style="color: #EF4444;">⚠️ Nenhuma empresa cadastrada. Cadastre uma empresa primeiro.</small>' : ''}
                            </div>

                            <div class="form-group" style="flex: 1;">
                                <label for="user-department">Departamento (Opcional)</label>
                                <input 
                                    type="text" 
                                    id="user-department" 
                                    class="form-input" 
                                    placeholder="Ex: Financeiro"
                                    value="${user?.department || ''}"
                                />
                            </div>
                        </div>

                        <!-- Third Line: Cargo full width -->
                        <div class="form-group full-width" style="margin-top: 5px;">
                            <label for="user-job-title">Cargo / Função (Opcional)</label>
                            <input 
                                type="text" 
                                id="user-job-title" 
                                class="form-input" 
                                placeholder="Ex: Gerente Financeiro"
                                value="${user?.job_title || ''}"
                            />
                        </div>

                        <!-- Fourth Line: Tipo de Usuário + Senha (only for new users) or just Tipo de Usuário (for edit) -->
                        ${!isEdit ? `
                            <div style="display: flex; gap: 1rem; margin-top: 5px;">
                                <div class="form-group" style="flex: 1;">
                                    <label for="user-role">Tipo de Usuário <span class="required">*</span></label>
                                    <select 
                                        id="user-role" 
                                        class="form-input"
                                        required
                                    >
                                        <option value="user" ${user?.role === 'user' ? 'selected' : ''}>Usuário</option>
                                        <option value="master" ${user?.role === 'master' ? 'selected' : ''}>Master</option>
                                    </select>
                                    <small style="color: var(--color-text-muted);">Master pode convidar e remover usuários</small>
                                </div>

                                <div class="form-group" style="flex: 1;">
                                    <label for="user-password">Senha Inicial <span class="required">*</span></label>
                                    <input 
                                        type="password" 
                                        id="user-password" 
                                        class="form-input" 
                                        placeholder="Mínimo 8 caracteres"
                                        required
                                    />
                                    <small style="color: var(--color-text-muted);">O usuário será obrigado a trocar a senha no primeiro login</small>
                                </div>
                            </div>
                        ` : `
                            <div class="form-group full-width" style="margin-top: 5px;">
                                <label for="user-role">Tipo de Usuário <span class="required">*</span></label>
                                <select 
                                    id="user-role" 
                                    class="form-input"
                                    required
                                >
                                    <option value="user" ${user?.role === 'user' ? 'selected' : ''}>Usuário</option>
                                    <option value="master" ${user?.role === 'master' ? 'selected' : ''}>Master</option>
                                </select>
                                <small style="color: var(--color-text-muted);">Master pode convidar e remover usuários</small>
                            </div>
                        `}
                    </div>
                </div>
                <div class="account-modal-footer">
                    <button class="btn-secondary" id="modal-cancel">Cancelar</button>
                    <button class="btn-primary" id="modal-save" ${companies.length === 0 ? 'disabled' : ''}>
                        ${isEdit ? 'Salvar Alterações' : 'Convidar Usuário'}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            // Elements
            const nameInput = modal.querySelector('#user-name');
            const emailInput = modal.querySelector('#user-email');
            const passwordInput = modal.querySelector('#user-password');
            const companySelect = modal.querySelector('#user-company');
            const roleSelect = modal.querySelector('#user-role');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');

            // Validation
            const validate = () => {
                let isValid = true;

                if (!companySelect.value) {
                    companySelect.classList.add('input-error');
                    isValid = false;
                } else {
                    companySelect.classList.remove('input-error');
                }

                if (!isEdit) {
                    const name = nameInput.value.trim();
                    if (!name) {
                        nameInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        nameInput.classList.remove('input-error');
                    }

                    const email = emailInput.value.trim();
                    if (!email || !email.includes('@')) {
                        emailInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        emailInput.classList.remove('input-error');
                    }

                    const password = passwordInput.value;
                    if (!password || password.length < 8) {
                        passwordInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        passwordInput.classList.remove('input-error');
                    }
                }

                return isValid;
            };

            if (!isEdit) {
                nameInput.addEventListener('input', validate);
                emailInput.addEventListener('input', validate);
                passwordInput.addEventListener('input', validate);
            }

            // Close modal
            const close = (result) => {
                document.removeEventListener('keydown', handleKeydown);
                modal.classList.add('animate-float-out');
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    if (container.contains(overlay)) {
                        container.removeChild(overlay);
                    }
                    resolve(result);
                }, 200);
            };

            // Keyboard handling
            const handleKeydown = (e) => {
                if (!document.body.contains(modal)) return;

                if (e.key === 'Escape') {
                    e.preventDefault();
                    close(null);
                } else if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    saveBtn.click();
                }
            };

            document.addEventListener('keydown', handleKeydown);

            // Save button
            saveBtn.addEventListener('click', () => {
                if (!validate()) {
                    return;
                }

                const data = {
                    name: nameInput.value.trim(),
                    email: emailInput.value.trim(),
                    role: roleSelect.value,
                    companyId: parseInt(companySelect.value),
                    job_title: document.getElementById('user-job-title').value.trim(),
                    department: document.getElementById('user-department').value.trim()
                };

                if (!isEdit) {
                    data.initialPassword = passwordInput.value;
                }

                if (isEdit) {
                    data.id = user.id;
                }

                close(data);
                if (onSave) onSave(data);
            });

            // Cancel button
            cancelBtn.addEventListener('click', () => {
                close(null);
                if (onCancel) onCancel();
            });

            // Click outside to close
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    close(null);
                    if (onCancel) onCancel();
                }
            });
        });
    }
};
