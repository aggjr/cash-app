export const FornecedorModal = {
    show({ fornecedor = null, onSave, onCancel }) {
        return new Promise((resolve) => {
            const container = document.getElementById('custom-dialog-container');
            if (!container) {
                console.error('Dialog container not found');
                resolve(null);
                return;
            }

            const isEdit = fornecedor !== null;
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';

            const maskCNPJ = (value) => {
                value = value.replace(/\D/g, '');
                value = value.replace(/^(\d{2})(\d)/, '$1.$2');
                value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
                value = value.replace(/(\d{4})(\d)/, '$1-$2');
                return value;
            };

            const escape = (value) => String(value ?? '').replace(/"/g, '&quot;');

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 1.5rem;">
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--color-primary); font-size: 1.3rem;">${isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
                    <p style="margin: 0 0 1.25rem 0; font-style: italic; color: #9CA3AF; font-size: 0.9rem;">Quem fornece os produtos. Você define o fornecedor principal e os secundários de cada produto no Tipo de Compras.</p>
                    <div class="form-grid">
                        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group" style="flex: 1;">
                                <label for="fornecedor-name">Nome <span class="required">*</span></label>
                                <input type="text" id="fornecedor-name" class="form-input"
                                    placeholder="Ex: Distribuidora Alfa"
                                    value="${escape(fornecedor?.name)}" required />
                            </div>

                            <div class="form-group" style="flex: 1;">
                                <label for="fornecedor-cnpj">CNPJ</label>
                                <input type="text" id="fornecedor-cnpj" class="form-input"
                                    placeholder="00.000.000/0000-00"
                                    value="${escape(fornecedor?.cnpj)}" maxlength="18" />
                            </div>
                        </div>

                        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group" style="flex: 1;">
                                <label for="fornecedor-contato">Contato</label>
                                <input type="text" id="fornecedor-contato" class="form-input"
                                    placeholder="Ex: Maria Silva"
                                    value="${escape(fornecedor?.contato)}" />
                            </div>

                            <div class="form-group" style="flex: 1;">
                                <label for="fornecedor-telefone">Telefone</label>
                                <input type="text" id="fornecedor-telefone" class="form-input"
                                    placeholder="(00) 00000-0000"
                                    value="${escape(fornecedor?.telefone)}" />
                            </div>

                            <div class="form-group" style="flex: 1;">
                                <label for="fornecedor-email">E-mail</label>
                                <input type="email" id="fornecedor-email" class="form-input"
                                    placeholder="contato@fornecedor.com"
                                    value="${escape(fornecedor?.email)}" />
                            </div>
                        </div>

                        <div class="form-group full-width">
                            <label for="fornecedor-observacoes">Observações</label>
                            <textarea id="fornecedor-observacoes" class="form-input" rows="2"
                                placeholder="Ex: prazo de entrega, condições de pagamento">${fornecedor?.observacoes || ''}</textarea>
                        </div>

                        ${isEdit ? `
                            <div class="form-group full-width">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="fornecedor-active" ${fornecedor?.active ? 'checked' : ''} />
                                    <span>Fornecedor Ativo</span>
                                </label>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="account-modal-footer">
                    <button class="btn-secondary" id="modal-cancel">Cancelar</button>
                    <button class="btn-primary" id="modal-save">
                        ${isEdit ? 'Salvar Alterações' : 'Criar Fornecedor'}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            const nameInput = modal.querySelector('#fornecedor-name');
            const cnpjInput = modal.querySelector('#fornecedor-cnpj');
            const contatoInput = modal.querySelector('#fornecedor-contato');
            const telefoneInput = modal.querySelector('#fornecedor-telefone');
            const emailInput = modal.querySelector('#fornecedor-email');
            const observacoesInput = modal.querySelector('#fornecedor-observacoes');
            const activeCheckbox = modal.querySelector('#fornecedor-active');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');

            cnpjInput.addEventListener('input', (e) => {
                e.target.value = maskCNPJ(e.target.value);
            });

            setTimeout(() => {
                nameInput.focus();
                nameInput.select();
            }, 100);

            // Only the name is required: suppliers are often registered with partial data.
            const validate = () => {
                const name = nameInput.value.trim();
                if (!name) {
                    nameInput.classList.add('input-error');
                    return false;
                }
                nameInput.classList.remove('input-error');

                const cnpj = cnpjInput.value.replace(/\D/g, '');
                if (cnpj.length > 0 && cnpj.length !== 14) {
                    cnpjInput.classList.add('input-error');
                    return false;
                }
                cnpjInput.classList.remove('input-error');

                return true;
            };

            nameInput.addEventListener('input', validate);
            cnpjInput.addEventListener('input', validate);

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

            saveBtn.addEventListener('click', () => {
                if (!validate()) return;

                const data = {
                    name: nameInput.value.trim(),
                    cnpj: cnpjInput.value.trim() || null,
                    contato: contatoInput.value.trim() || null,
                    telefone: telefoneInput.value.trim() || null,
                    email: emailInput.value.trim() || null,
                    observacoes: observacoesInput.value.trim() || null
                };

                if (isEdit) {
                    data.id = fornecedor.id;
                    data.active = activeCheckbox ? activeCheckbox.checked : fornecedor.active;
                }

                close(data);
                if (onSave) onSave(data);
            });

            cancelBtn.addEventListener('click', () => {
                close(null);
                if (onCancel) onCancel();
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    close(null);
                    if (onCancel) onCancel();
                }
            });
        });
    }
};
