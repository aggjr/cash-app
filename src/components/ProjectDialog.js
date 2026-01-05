export const ProjectDialog = {
    show() {
        return new Promise((resolve) => {
            const container = document.getElementById('custom-dialog-container');

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'dialog-box animate-float-in';
            dialog.style.maxWidth = '500px';

            dialog.innerHTML = `
                <div class="dialog-header">
                    <h3>Criar Novo Projeto</h3>
                </div>
                <div class="dialog-body">
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--color-text);">
                            Nome do Projeto <span style="color: #EF4444;">*</span>
                        </label>
                        <input type="text" id="project-name" class="dialog-input" placeholder="Ex: Minha Empresa Ltda" required />
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--color-text);">
                            Nome da Empresa <span style="color: #EF4444;">*</span>
                        </label>
                        <input type="text" id="company-name" class="dialog-input" placeholder="Ex: Empresa Principal" required />
                        <small style="color: var(--color-text-muted); font-size: 0.85rem;">Esta empresa será criada automaticamente no projeto</small>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--color-text);">
                                Senha <span style="color: #EF4444;">*</span>
                            </label>
                            <input type="password" id="password" class="dialog-input" placeholder="Mínimo 8 caracteres" required />
                        </div>
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--color-text);">
                                Confirmar Senha <span style="color: #EF4444;">*</span>
                            </label>
                            <input type="password" id="confirm-password" class="dialog-input" placeholder="Repita a senha" required />
                        </div>
                    </div>
                    <small style="color: var(--color-text-muted); font-size: 0.85rem; display: block; margin-bottom: 1rem;">A senha deve ter no mínimo 8 caracteres</small>
                    
                    <div id="error-message" style="display: none; padding: 0.75rem; background: #FEE2E2; border: 1px solid #EF4444; border-radius: 6px; color: #991B1B; font-size: 0.9rem; margin-top: 1rem;"></div>
                </div>
                <div class="dialog-footer">
                    <button class="btn-secondary dialog-cancel-btn">Cancelar</button>
                    <button class="btn-primary dialog-confirm-btn">Criar Projeto</button>
                </div>
            `;

            overlay.appendChild(dialog);
            container.appendChild(overlay);

            const projectNameInput = dialog.querySelector('#project-name');
            const companyNameInput = dialog.querySelector('#company-name');
            const passwordInput = dialog.querySelector('#password');
            const confirmPasswordInput = dialog.querySelector('#confirm-password');
            const errorMessage = dialog.querySelector('#error-message');
            const confirmBtn = dialog.querySelector('.dialog-confirm-btn');
            const cancelBtn = dialog.querySelector('.dialog-cancel-btn');

            // Focus first input
            setTimeout(() => {
                projectNameInput.focus();
            }, 50);

            const showError = (message) => {
                errorMessage.textContent = message;
                errorMessage.style.display = 'block';
            };

            const hideError = () => {
                errorMessage.style.display = 'none';
            };

            const validate = () => {
                hideError();

                const projectName = projectNameInput.value.trim();
                const companyName = companyNameInput.value.trim();
                const password = passwordInput.value;
                const confirmPassword = confirmPasswordInput.value;

                if (!projectName) {
                    showError('Por favor, informe o nome do projeto');
                    projectNameInput.focus();
                    return false;
                }

                if (!companyName) {
                    showError('Por favor, informe o nome da empresa');
                    companyNameInput.focus();
                    return false;
                }

                if (!password) {
                    showError('Por favor, informe a senha');
                    passwordInput.focus();
                    return false;
                }

                if (password.length < 8) {
                    showError('A senha deve ter no mínimo 8 caracteres');
                    passwordInput.focus();
                    return false;
                }

                if (password !== confirmPassword) {
                    showError('As senhas não coincidem');
                    confirmPasswordInput.focus();
                    return false;
                }

                return true;
            };

            const close = (result) => {
                document.removeEventListener('keydown', handleKeydown);
                dialog.classList.add('animate-float-out');
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    if (container.contains(overlay)) {
                        container.removeChild(overlay);
                    }
                    resolve(result);
                }, 200);
            };

            const handleKeydown = (e) => {
                if (!document.body.contains(dialog)) return;

                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    close(null);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    confirmBtn.click();
                }
            };

            document.addEventListener('keydown', handleKeydown);

            confirmBtn.addEventListener('click', () => {
                if (validate()) {
                    close({
                        projectName: projectNameInput.value.trim(),
                        companyName: companyNameInput.value.trim(),
                        password: passwordInput.value
                    });
                }
            });

            cancelBtn.addEventListener('click', () => {
                close(null);
            });

            // Clear error on input
            [projectNameInput, companyNameInput, passwordInput, confirmPasswordInput].forEach(input => {
                input.addEventListener('input', hideError);
            });
        });
    }
};
