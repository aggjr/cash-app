export const CompanyModal = {
    show({ company = null, onSave, onCancel }) {
        return new Promise((resolve) => {
            const container = document.getElementById('custom-dialog-container');
            if (!container) {
                console.error('Dialog container not found');
                resolve(null);
                return;
            }

            const isEdit = company !== null;
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';

            // CNPJ mask function
            const maskCNPJ = (value) => {
                value = value.replace(/\D/g, '');
                value = value.replace(/^(\d{2})(\d)/, '$1.$2');
                value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
                value = value.replace(/(\d{4})(\d)/, '$1-$2');
                return value;
            };

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 2rem;">
                    <h3 style="margin: 0 0 1.5rem 0; color: var(--color-primary); font-size: 1.3rem;">${isEdit ? 'Editar Empresa' : 'Nova Empresa'}</h3>
                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label for="company-name">Nome da Empresa <span class="required">*</span></label>
                            <input 
                                type="text" 
                                id="company-name" 
                                class="form-input" 
                                placeholder="Ex: Gestão de Foco"
                                value="${company?.name || ''}"
                                required
                            />
                        </div>

                        <div class="form-group full-width">
                            <label for="company-cnpj">CNPJ <span class="required">*</span></label>
                            <input 
                                type="text" 
                                id="company-cnpj" 
                                class="form-input" 
                                placeholder="00.000.000/0000-00"
                                value="${company?.cnpj || ''}"
                                maxlength="18"
                                required
                            />
                            <small style="color: var(--color-text-muted); font-size: 0.85rem;">Formato: 00.000.000/0000-00</small>
                        </div>

                        <div class="form-group full-width">
                            <label for="company-description">Descrição</label>
                            <textarea 
                                id="company-description" 
                                class="form-input" 
                                rows="3"
                                placeholder="Descrição opcional da empresa"
                            >${company?.description || ''}</textarea>
                        </div>

                        ${isEdit ? `
                            <div class="form-group full-width">
                                <label class="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        id="company-active"
                                        ${company?.active ? 'checked' : ''}
                                    />
                                    <span>Empresa Ativa</span>
                                </label>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="account-modal-footer">
                    <button class="btn-secondary" id="modal-cancel">Cancelar</button>
                    <button class="btn-primary" id="modal-save">
                        ${isEdit ? 'Salvar Alterações' : 'Criar Empresa'}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            // Elements
            const nameInput = modal.querySelector('#company-name');
            const cnpjInput = modal.querySelector('#company-cnpj');
            const descriptionInput = modal.querySelector('#company-description');
            const activeCheckbox = modal.querySelector('#company-active');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');

            // Apply CNPJ mask
            cnpjInput.addEventListener('input', (e) => {
                e.target.value = maskCNPJ(e.target.value);
            });

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

                const cnpj = cnpjInput.value.replace(/\D/g, '');
                if (cnpj.length !== 14) {
                    cnpjInput.classList.add('input-error');
                    isValid = false;
                } else {
                    cnpjInput.classList.remove('input-error');
                }

                return isValid;
            };

            nameInput.addEventListener('input', validate);
            cnpjInput.addEventListener('input', validate);

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
                    cnpj: cnpjInput.value,
                    description: descriptionInput.value.trim()
                };

                if (isEdit) {
                    data.id = company.id;
                    data.active = activeCheckbox ? activeCheckbox.checked : company.active;
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
