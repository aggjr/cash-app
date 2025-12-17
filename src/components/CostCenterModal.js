import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const CostCenterModal = {
    show({ costCenter = null, onSave, onCancel }) {
        return new Promise((resolve) => {
            const container = document.getElementById('custom-dialog-container');
            if (!container) {
                console.error('Dialog container not found');
                resolve(null);
                return;
            }

            const isEdit = costCenter !== null;

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 2rem;">
                    <h3 style="margin: 0 0 1.5rem 0; color: var(--color-primary); font-size: 1.3rem;">${isEdit ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}</h3>
                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label for="cost-center-name">Nome <span class="required">*</span></label>
                            <input 
                                type="text" 
                                id="cost-center-name" 
                                class="form-input" 
                                placeholder="Ex: Administrativo"
                                value="${costCenter?.name || ''}"
                                required
                            />
                        </div>

                        <div class="form-group full-width">
                            <label for="cost-center-description">Descrição</label>
                            <textarea 
                                id="cost-center-description" 
                                class="form-input" 
                                rows="3"
                                placeholder="Descrição opcional"
                            >${costCenter?.description || ''}</textarea>
                        </div>

                        ${isEdit ? `
                            <div class="form-group full-width">
                                <label class="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        id="cost-center-active"
                                        ${costCenter?.active ? 'checked' : ''}
                                    />
                                    <span>Ativo</span>
                                </label>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="account-modal-footer">
                    <button class="btn-secondary" id="modal-cancel">Cancelar</button>
                    <button class="btn-primary" id="modal-save">
                        ${isEdit ? 'Salvar Alterações' : 'Criar'}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            // Elements
            const nameInput = modal.querySelector('#cost-center-name');
            const descriptionInput = modal.querySelector('#cost-center-description');
            const activeCheckbox = modal.querySelector('#cost-center-active');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');

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
                return isValid;
            };

            nameInput.addEventListener('input', validate);

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
                    showToast('Preencha os campos obrigatórios', 'error');
                    return;
                }

                const data = {
                    name: nameInput.value.trim(),
                    description: descriptionInput.value.trim()
                };

                if (isEdit) {
                    data.id = costCenter.id;
                    data.active = activeCheckbox ? activeCheckbox.checked : costCenter.active;
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
