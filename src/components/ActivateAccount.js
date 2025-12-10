import { getApiBaseUrl } from '../utils/apiConfig.js';

export const ActivateAccount = () => {
    const API_BASE_URL = getApiBaseUrl();
    const container = document.createElement('div');
    container.style.cssText = `
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #00425F 0%, #2F6C81 50%, #DAB177 100%);
        padding: 2rem;
    `;

    const getTokenFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('token');
    };

    const validateToken = async (token) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/validate-token/${token}`);
            if (response.ok) {
                const data = await response.json();
                return { valid: true, user: data.user };
            }
            return { valid: false, error: 'Token inválido ou expirado' };
        } catch (error) {
            return { valid: false, error: 'Erro de conexão' };
        }
    };

    const activateAccount = async (token, newPassword) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });

            if (response.ok) {
                return { success: true };
            } else {
                const error = await response.json();
                return { success: false, error: error.error || 'Erro ao ativar conta' };
            }
        } catch (error) {
            return { success: false, error: 'Erro de conexão' };
        }
    };

    const render = async () => {
        const token = getTokenFromURL();

        if (!token) {
            container.innerHTML = `
                <div class="glass-panel" style="max-width: 500px; width: 100%; padding: 3rem; text-align: center;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">❌</div>
                    <h2 style="color: var(--color-primary); margin-bottom: 1rem;">Link Inválido</h2>
                    <p style="color: #666; margin-bottom: 2rem;">
                        O link de ativação está incompleto ou inválido.
                    </p>
                    <button id="btn-go-login" class="btn-primary">Ir para Login</button>
                </div>
            `;
            container.querySelector('#btn-go-login').addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('navigate', { detail: 'login' }));
            });
            return;
        }

        // Show loading
        container.innerHTML = `
            <div class="glass-panel" style="max-width: 500px; width: 100%; padding: 3rem; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
                <p>Validando link de ativação...</p>
            </div>
        `;

        const validation = await validateToken(token);

        if (!validation.valid) {
            container.innerHTML = `
                <div class="glass-panel" style="max-width: 500px; width: 100%; padding: 3rem; text-align: center;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
                    <h2 style="color: var(--color-primary); margin-bottom: 1rem;">Link Expirado</h2>
                    <p style="color: #666; margin-bottom: 2rem;">
                        ${validation.error}<br><br>
                        Entre em contato com o administrador do projeto para receber um novo convite.
                    </p>
                    <button id="btn-go-login" class="btn-primary">Ir para Login</button>
                </div>
            `;
            container.querySelector('#btn-go-login').addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('navigate', { detail: 'login' }));
            });
            return;
        }

        // Show activation form
        container.innerHTML = `
            <div class="glass-panel" style="max-width: 500px; width: 100%; padding: 3rem;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
                    <h2 style="color: var(--color-primary); margin-bottom: 0.5rem;">Ativar Conta</h2>
                    <p style="color: #666;">Bem-vindo, <strong>${validation.user.name}</strong>!</p>
                </div>

                <div style="background: #FEF3C7; padding: 1rem; border-radius: 6px; border-left: 4px solid #F59E0B; margin-bottom: 2rem;">
                    <p style="margin: 0; font-size: 0.9rem; color: #92400E;">
                        <strong>⚠️ Importante:</strong> Por segurança, você deve criar uma nova senha para acessar o sistema.
                    </p>
                </div>

                <form id="activate-form">
                    <div class="form-group" style="margin-bottom: 1.5rem;">
                        <label for="new-password" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            Nova Senha <span style="color: #EF4444;">*</span>
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
                            Confirmar Senha <span style="color: #EF4444;">*</span>
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
                        ✓ Ativar Minha Conta
                    </button>
                </form>

                <div style="text-align: center; margin-top: 2rem;">
                    <a href="#" id="link-login" style="color: var(--color-primary); text-decoration: none; font-size: 0.9rem;">
                        ← Voltar para Login
                    </a>
                </div>
            </div>
        `;

        const form = container.querySelector('#activate-form');
        const newPasswordInput = container.querySelector('#new-password');
        const confirmPasswordInput = container.querySelector('#confirm-password');
        const matchMsg = container.querySelector('#password-match-msg');

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

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (newPassword.length < 8) {
                alert('A senha deve ter no mínimo 8 caracteres');
                return;
            }

            if (newPassword !== confirmPassword) {
                alert('As senhas não coincidem');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Ativando...';

            const result = await activateAccount(token, newPassword);

            if (result.success) {
                container.innerHTML = `
                    <div class="glass-panel" style="max-width: 500px; width: 100%; padding: 3rem; text-align: center;">
                        <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
                        <h2 style="color: #10B981; margin-bottom: 1rem;">Conta Ativada!</h2>
                        <p style="color: #666; margin-bottom: 2rem;">
                            Sua conta foi ativada com sucesso.<br>
                            Você já pode fazer login no sistema.
                        </p>
                        <button id="btn-go-login" class="btn-primary">Ir para Login</button>
                    </div>
                `;
                container.querySelector('#btn-go-login').addEventListener('click', () => {
                    window.location.href = '/';
                });
            } else {
                alert('❌ ' + result.error);
                submitBtn.disabled = false;
                submitBtn.textContent = '✓ Ativar Minha Conta';
            }
        });

        container.querySelector('#link-login').addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/';
        });
    };

    render();
    return container;
};
