import { getApiBaseUrl } from '../utils/apiConfig.js';

export const ChangePasswordModal = {
    show() {
        return new Promise((resolve) => {
            const API_BASE_URL = getApiBaseUrl();
            let container = document.getElementById('custom-dialog-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'custom-dialog-container';
                document.body.appendChild(container);
            }

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '10000';

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';
            modal.style.maxWidth = '500px';

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 2rem;">
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">🔐</div>
                        <h3 style="color: var(--color-primary); margin-bottom: 0.5rem;">Troca de Senha Obrigatória</h3>
                        <p style="color: #666;">Por segurança, você deve criar uma nova senha para continuar.</p>
                    </div>

                    <form id="change-password-form">
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label for="current-password" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                                Senha Atual <span class="required">*</span>
                            </label>
                            <input 
                                type="password" 
                                id="current-password" 
                                class="form-input" 
                                placeholder="Senha fornecida pelo administrador"
                                required
                                style="width: 100%;"
                            />
                        </div>

                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label for="new-password" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                                Nova Senha <span class="required">*</span>
                            </label>
                            <input 
                                type="password" 
                                id="new-password" 
                                class="form-input" 
                                placeholder="Mínimo 8 caracteres"
                                required
                                minlength="8"
                                style="width: 100%;"
                            />
                            <small style="color: #666; font-size: 0.85rem;">Mínimo de 8 caracteres</small>
                        </div>

                        <div class="form-group" style="margin-bottom: 2rem;">
                            <label for="confirm-password" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                                Confirmar Nova Senha <span class="required">*</span>
                            </label>
                            <input 
                                type="password" 
                                id="confirm-password" 
                                class="form-input" 
                                placeholder="Digite a senha novamente"
                                required
                                minlength="8"
                                style="width: 100%;"
                            />
                            <small id="password-match-msg" style="font-size: 0.85rem;"></small>
                        </div>

                        <button type="submit" class="btn-primary" style="width: 100%; padding: 1rem; font-size: 1rem;">
                            ✓ Alterar Senha
                        </button>
                    </form>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            const form = modal.querySelector('#change-password-form');
            const currentPasswordInput = modal.querySelector('#current-password');
            const newPasswordInput = modal.querySelector('#new-password');
            const confirmPasswordInput = modal.querySelector('#confirm-password');
            const matchMsg = modal.querySelector('#password-match-msg');

            const validatePasswords = () => {
                const newPass = newPasswordInput.value;
                const confirmPass = confirmPasswordInput.value;

                if (confirmPass.length === 0) {
                    matchMsg.textContent = '';
                    matchMsg.style.color = '';
                    return true;
                }

                if (newPass === confirmPass) {
                    matchMsg.textContent = '✓ As senhas coincidem';
                    matchMsg.style.color = '#10B981';
                    return true;
                } else {
                    matchMsg.textContent = '✗ As senhas não coincidem';
                    matchMsg.style.color = '#EF4444';
                    return false;
                }
            };

            newPasswordInput.addEventListener('input', validatePasswords);
            confirmPasswordInput.addEventListener('input', validatePasswords);

            const close = (result) => {
                modal.classList.add('animate-float-out');
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    if (container.contains(overlay)) container.removeChild(overlay);
                    resolve(result);
                }, 200);
            };

            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const currentPassword = currentPasswordInput.value;
                const newPassword = newPasswordInput.value;
                const confirmPassword = confirmPasswordInput.value;

                if (newPassword.length < 8) {
                    alert('A nova senha deve ter no mínimo 8 caracteres');
                    return;
                }

                if (newPassword !== confirmPassword) {
                    alert('As senhas não coincidem');
                    return;
                }

                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Alterando...';

                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ currentPassword, newPassword })
                    });

                    if (response.ok) {
                        alert('✅ Senha alterada com sucesso!\n\nVocê pode continuar usando o sistema.');
                        close(true);
                    } else {
                        const error = await response.json();
                        alert('❌ ' + (error.error || 'Erro ao alterar senha'));
                        submitBtn.disabled = false;
                        submitBtn.textContent = '✓ Alterar Senha';
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('❌ Erro de conexão');
                    submitBtn.disabled = false;
                    submitBtn.textContent = '✓ Alterar Senha';
                }
            });

            setTimeout(() => currentPasswordInput.focus(), 100);
        });
    }
};
