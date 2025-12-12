import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const Register = (onRegisterSuccess) => {
    const container = document.createElement('div');
    container.className = 'auth-container';
    const API_BASE_URL = getApiBaseUrl();
    container.innerHTML = `
        <div class="auth-box">
            <div class="auth-header-title">
                <h1 class="text-gradient" style="font-size: 3rem; margin-bottom: 1rem;">CASH</h1>
            </div>

            <h2>Cadastro</h2>
            <form id="register-form">
                <div class="form-group">
                    <label>Nome</label>
                    <input type="text" id="name" required />
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email" required />
                </div>
                <div class="form-group">
                    <label>Senha</label>
                    <div class="password-wrapper">
                        <input type="password" id="password" required />
                        <button type="button" class="toggle-password" tabindex="-1">🙈</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Confirmar Senha</label>
                    <div class="password-wrapper">
                        <input type="password" id="confirm-password" required />
                        <button type="button" class="toggle-password" tabindex="-1">🙈</button>
                    </div>
                </div>
                <button type="submit" class="btn-primary full-width">Cadastrar</button>
            </form>
            <p class="auth-link">Já tem conta? <a href="#" id="go-to-login">Faça Login</a></p>

            <div class="auth-footer-logo">
                <img src="/logo.png" alt="Logo" class="auth-logo-bottom logo-light" />
                <img src="/logo-dark.png" alt="Logo" class="auth-logo-bottom logo-dark" />
            </div>
        </div>
    `;

    // Toggle Password Visibility
    container.querySelectorAll('.toggle-password').forEach(button => {
        // Set initial icon to See-No-Evil Monkey (Closed Eyes) because input is hidden by default
        button.textContent = '🙈';

        button.addEventListener('click', () => {
            const input = button.previousElementSibling;
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            // If type is now password (hidden), show See-No-Evil Monkey (Closed Eyes). 
            // If type is now text (visible), show Monkey Face (Open Eyes).
            button.textContent = type === 'password' ? '🙈' : '🐵';
        });
    });

    // Real-time Password Validation
    const validatePasswords = () => {
        const password = container.querySelector('#password').value;
        const confirmPassword = container.querySelector('#confirm-password').value;
        const confirmInput = container.querySelector('#confirm-password');

        // Only validate if confirm password has value
        if (confirmPassword.length > 0) {
            if (password === confirmPassword) {
                confirmInput.classList.add('input-success');
                confirmInput.classList.remove('input-error');
            } else {
                confirmInput.classList.add('input-error');
                confirmInput.classList.remove('input-success');
            }
        } else {
            confirmInput.classList.remove('input-success', 'input-error');
        }
    };

    container.querySelector('#password').addEventListener('input', validatePasswords);
    container.querySelector('#confirm-password').addEventListener('input', validatePasswords);

    container.querySelector('#register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = container.querySelector('#name').value.trim();
        const email = container.querySelector('#email').value.trim();
        const password = container.querySelector('#password').value;
        const confirmPassword = container.querySelector('#confirm-password').value;

        if (password !== confirmPassword) {
            Dialogs.alert('As senhas não coincidem!', 'Erro');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();
            if (response.ok) {
                Dialogs.alert('Cadastro realizado com sucesso! Faça login.', 'Sucesso')
                    .then(() => onRegisterSuccess());
            } else {
                // Handle error response properly
                let errorMessage = 'Falha no cadastro';

                if (data.error) {
                    if (typeof data.error === 'string') {
                        errorMessage = data.error;
                    } else if (data.error.message) {
                        errorMessage = data.error.message;
                        if (data.error.code) {
                            errorMessage = `[${data.error.code}] ${errorMessage}`;
                        }
                    }
                } else if (data.message) {
                    errorMessage = data.message;
                }

                Dialogs.alert(errorMessage, 'Erro');
            }
        } catch (error) {
            console.error('Registration error:', error);
            Dialogs.alert('Erro de conexão com o servidor', 'Erro');
        }
    });

    container.querySelector('#go-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'login' }));
    });

    return container;
};
