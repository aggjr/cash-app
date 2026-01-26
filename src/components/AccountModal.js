import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { attachCurrencyMask, parseCurrency, formatCurrency } from '../utils/currencyMask.js';

export const AccountModal = {
    show({ account = null, onSave, onCancel }) {
        return new Promise(async (resolve) => {
            const container = document.getElementById('custom-dialog-container');
            const API_BASE_URL = getApiBaseUrl();
            if (!container) {
                console.error('Dialog container not found');
                resolve(null);
                return;
            }

            const isEdit = account !== null;

            // Fetch companies
            const token = localStorage.getItem('token');
            const currentProject = JSON.parse(localStorage.getItem('currentProject'));
            let companies = [];

            try {
                const response = await fetch(`${API_BASE_URL}/companies?projectId=${currentProject.id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                companies = await response.json();
            } catch (error) {
                console.error('Error loading companies:', error);
            }

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';


            modal.innerHTML = `

                <div class="account-modal-body" style="padding: 1.5rem; max-height: 85vh;">
                    <h3 style="margin: 0 0 1rem 0; color: var(--color-primary); font-size: 1.3rem;">${isEdit ? 'Editar Conta' : 'Nova Conta'}</h3>
                    <div class="form-grid" style="gap: 0.5rem;">
                        
                        <!-- Row 1: Name, Company, Balance -->
                        <div style="display: grid; grid-template-columns: 1.5fr 1.5fr 1fr; gap: 1rem; align-items: start;">
                            <div class="form-group">
                                <label for="account-name">Nome da Conta <span class="required">*</span></label>
                                <input 
                                    type="text" 
                                    id="account-name" 
                                    class="form-input" 
                                    placeholder="Ex: Caixa Principal"
                                    value="${account?.name || ''}"
                                    required
                                />
                            </div>

                            <div class="form-group">
                                <label for="account-company">Empresa <span class="required">*</span></label>
                                <select 
                                    id="account-company" 
                                    class="form-input"
                                    required
                                >
                                    <option value="">Selecione uma empresa</option>
                                    ${companies.map(company => `
                                        <option value="${company.id}" ${account?.company_id == company.id ? 'selected' : ''}>
                                            ${company.name} - ${company.cnpj}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="account-initial-balance">Saldo Inicial <span class="required">*</span></label>
                                <input 
                                    type="text" 
                                    id="account-initial-balance" 
                                    class="form-input" 
                                    placeholder="R$ 0,00"
                                    style="text-align: right;"
                                    value="${account?.initial_balance ? formatCurrency(account.initial_balance) : '0,00'}"
                                    required
                                />
                            </div>
                        </div>

                        ${companies.length === 0 ? '<div class="form-group full-width"><small style="color: #EF4444;">⚠️ Nenhuma empresa cadastrada. Cadastre uma empresa primeiro na tela "Empresa".</small></div>' : ''}

                        <div class="form-group full-width" style="margin-top: 5px;">
                            <small class="text-muted" style="display: block; margin-top: -5px; margin-bottom: 5px;">Saldo de abertura (banco) antes de qualquer movimentação no sistema.</small>
                        </div>
                        
                        <div class="form-group full-width">
                            <label for="account-description">Descrição</label>
                            <textarea 
                                id="account-description" 
                                class="form-input" 
                                rows="3"
                                placeholder="Descrição opcional da conta"
                            >${account?.description || ''}</textarea>
                        </div>

                        ${isEdit ? `
                            <div class="form-group full-width">
                                <label class="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        id="account-active"
                                        ${account?.active ? 'checked' : ''}
                                    />
                                    <span>Conta Ativa</span>
                                </label>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="account-modal-footer">
                    <button class="btn-secondary" id="modal-cancel">Cancelar</button>
                    <button class="btn-primary" id="modal-save" ${companies.length === 0 ? 'disabled' : ''}>
                        ${isEdit ? 'Salvar Alterações' : 'Criar Conta'}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            // Elements
            const nameInput = modal.querySelector('#account-name');
            const companySelect = modal.querySelector('#account-company');
            const descriptionInput = modal.querySelector('#account-description');
            const initialBalanceInput = modal.querySelector('#account-initial-balance');
            const activeCheckbox = modal.querySelector('#account-active');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');

            // Attach Currency Mask
            attachCurrencyMask(initialBalanceInput);


            // Focus on name input
            setTimeout(() => {
                nameInput.focus();
                nameInput.select();
            }, 100);

            // Validation
            const validate = () => {
                let isValid = true;

                const name = nameInput.value.trim();
                if (!name) {
                    nameInput.classList.add('input-error');
                    isValid = false;
                } else {
                    nameInput.classList.remove('input-error');
                }

                const companyId = companySelect.value;
                if (!companyId) {
                    companySelect.classList.add('input-error');
                    isValid = false;
                } else {
                    companySelect.classList.remove('input-error');
                }

                const initialBalance = initialBalanceInput.value.trim();
                if (!initialBalance) {
                    initialBalanceInput.classList.add('input-error');
                    isValid = false;
                } else {
                    initialBalanceInput.classList.remove('input-error');
                }

                return isValid;
            };

            nameInput.addEventListener('input', validate);
            companySelect.addEventListener('change', validate);
            initialBalanceInput.addEventListener('input', validate);

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
                    showToast({ error: { code: 'VAL-002', message: 'Campos obrigatórios ausentes.' } });
                    return;
                }

                const data = {
                    name: nameInput.value.trim(),
                    description: descriptionInput.value.trim(),
                    initialBalance: parseCurrency(initialBalanceInput.value),
                    companyId: parseInt(companySelect.value)
                };

                if (isEdit) {
                    data.id = account.id;
                    data.active = activeCheckbox ? activeCheckbox.checked : account.active;
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
