import { Dialogs } from './Dialogs.js';
import { ChangePasswordModal } from './ChangePasswordModal.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const Login = (onLoginSuccess) => {
    const container = document.createElement('div');
    container.className = 'auth-container';
    const API_BASE_URL = getApiBaseUrl();

    let availableProjects = [];
    let isCreatingNewProject = false;

    container.innerHTML = `
        <div class="auth-box">
            <div class="auth-header-title">
                <h1 class="text-gradient notranslate" translate="no" style="font-size: 2rem; margin-bottom: 0.25rem;">CASH</h1>
            </div>
            
            <h2>Login</h2>
            <form id="login-form">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email" required />
                </div>
                
                <div class="form-group">
                    <label>Projeto</label>
                    <select id="project" required disabled size="1">
                        <option value="">Digite o e-mail primeiro</option>
                    </select>
                    <small id="project-status" style="color: #666; font-size: 0.85rem;"></small>
                </div>
                
                <div class="form-group" id="new-project-name-group" style="display: none;">
                    <label>Nome do Novo Projeto</label>
                    <input type="text" id="new-project-name" placeholder="Ex: Minha Empresa" />
                </div>
                
                <div class="form-group">
                    <label>Senha</label>
                    <input type="password" id="password" required />
                </div>
                
                <div class="form-group" id="confirm-password-group" style="display: none;">
                    <label>Confirmar Senha</label>
                    <input type="password" id="confirm-password" />
                    <small id="password-match" style="font-size: 0.85rem;"></small>
                </div>
                
                <button type="submit" class="btn-primary full-width">Entrar</button>
            </form>
            <p class="auth-link" style="margin-top: 0.75rem;">Não tem conta? <a href="#" id="go-to-register">Cadastre-se</a></p>
            
            <div class="auth-footer-logo" style="margin-top: 1rem;">
                <img src="/logo.png" alt="Logo" class="auth-logo-bottom logo-light" />
                <img src="/logo-dark.png" alt="Logo" class="auth-logo-bottom logo-dark" />
            </div>
        </div>
    `;

    const emailInput = container.querySelector('#email');
    const projectSelect = container.querySelector('#project');
    const passwordInput = container.querySelector('#password');
    const confirmPasswordInput = container.querySelector('#confirm-password');
    const newProjectNameInput = container.querySelector('#new-project-name');
    const projectStatus = container.querySelector('#project-status');
    const loginForm = container.querySelector('#login-form');
    const newProjectNameGroup = container.querySelector('#new-project-name-group');
    const confirmPasswordGroup = container.querySelector('#confirm-password-group');
    const passwordMatch = container.querySelector('#password-match');

    // Validate password match
    const validatePasswordMatch = () => {
        if (!isCreatingNewProject) return true;

        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (confirmPassword.length === 0) {
            passwordMatch.textContent = '';
            return true;
        }

        if (password === confirmPassword) {
            passwordMatch.textContent = '✓ Senhas coincidem';
            passwordMatch.style.color = '#10B981';
            return true;
        } else {
            passwordMatch.textContent = '✗ Senhas não coincidem';
            passwordMatch.style.color = '#EF4444';
            return false;
        }
    };

    passwordInput.addEventListener('input', validatePasswordMatch);
    confirmPasswordInput.addEventListener('input', validatePasswordMatch);

    // Handle project selection change
    projectSelect.addEventListener('change', () => {
        const selectedValue = projectSelect.value;
        isCreatingNewProject = selectedValue === 'NEW_PROJECT';

        if (isCreatingNewProject) {
            newProjectNameGroup.style.display = 'block';
            confirmPasswordGroup.style.display = 'block';
            newProjectNameInput.required = true;
            confirmPasswordInput.required = true;
        } else {
            newProjectNameGroup.style.display = 'none';
            confirmPasswordGroup.style.display = 'none';
            newProjectNameInput.required = false;
            confirmPasswordInput.required = false;
        }
    });

    // Fetch projects when email changes (on blur)
    emailInput.addEventListener('blur', async () => {
        const email = emailInput.value.trim();

        if (!email || !email.includes('@')) {
            return;
        }

        projectStatus.textContent = '⏳ Buscando projetos...';
        projectStatus.style.color = '#666';
        projectSelect.disabled = true;
        projectSelect.innerHTML = '<option value="">Carregando...</option>';

        try {
            const response = await fetch(`${API_BASE_URL}/auth/projects-by-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                availableProjects = data.projects;

                // Always add "Create New Project" option
                let options = availableProjects.map(p =>
                    `<option value="${p.id}">${p.name} ${p.role === 'master' ? '(👑 Master)' : '(👤 Usuário)'}</option>`
                ).join('');

                options += '<option value="NEW_PROJECT">➕ Criar Novo Projeto</option>';

                projectSelect.innerHTML = options;
                projectStatus.textContent = `✓ ${availableProjects.length} projeto(s) encontrado(s)`;
                projectStatus.style.color = '#10B981';
                projectSelect.disabled = false;

                // Auto-focus password if only one project
                if (availableProjects.length === 1) {
                    setTimeout(() => passwordInput.focus(), 100);
                }
            } else {
                projectSelect.innerHTML = '<option value="">Erro ao buscar</option>';
                const errorMessage = data.error?.message || data.error || 'Erro ao buscar projetos';
                projectStatus.textContent = '❌ ' + errorMessage;
                projectStatus.style.color = '#EF4444';
                projectSelect.disabled = true;
            }
        } catch (error) {
            console.error('Error:', error);
            projectSelect.innerHTML = '<option value="NEW_PROJECT">➕ Criar Novo Projeto</option>';
            projectStatus.textContent = '⚠️ Erro de conexão. Você pode criar um novo projeto.';
            projectStatus.style.color = '#F59E0B';
            projectSelect.disabled = false;
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const projectId = projectSelect.value;
        const password = passwordInput.value;

        if (!projectId) {
            Dialogs.alert('Por favor, selecione um projeto.', 'Aviso');
            return;
        }

        // Handle new project creation
        if (isCreatingNewProject) {
            const projectName = newProjectNameInput.value.trim();
            const confirmPassword = confirmPasswordInput.value;

            if (!projectName) {
                Dialogs.alert('Por favor, digite o nome do novo projeto.', 'Aviso');
                return;
            }

            if (password !== confirmPassword) {
                Dialogs.alert('As senhas não coincidem.', 'Aviso');
                return;
            }

            if (password.length < 8) {
                Dialogs.alert('A senha deve ter no mínimo 8 caracteres.', 'Aviso');
                return;
            }

            // Create new project and user
            try {
                const response = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: email.split('@')[0], // Use email prefix as name
                        email,
                        password,
                        projectName
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    Dialogs.alert('Projeto criado com sucesso! Faça login agora.', 'Sucesso');
                    // Reload to show new project
                    window.location.reload();
                } else {
                    const errorMessage = data.error?.message || data.error || 'Erro ao criar projeto';
                    Dialogs.alert(errorMessage, 'Erro');
                }
            } catch (error) {
                console.error('Error:', error);
                Dialogs.alert('Erro de conexão. Verifique se o backend está rodando.', 'Erro');
            }
            return;
        }

        // Normal login flow
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, projectId, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('currentProject', JSON.stringify(data.project));
                localStorage.setItem('projects', JSON.stringify([data.project]));

                // Check if password reset is required
                if (data.user.password_reset_required) {
                    Dialogs.alert('Bem-vindo! Por segurança, você deve trocar sua senha no primeiro acesso.', 'Troca de Senha Obrigatória');
                    const changed = await ChangePasswordModal.show();
                    if (changed) {
                        const updatedUser = { ...data.user, password_reset_required: false };
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        onLoginSuccess();
                    } else {
                        localStorage.clear();
                        Dialogs.alert('Você precisa trocar a senha para continuar.', 'Aviso');
                    }
                } else {
                    onLoginSuccess();
                }
            } else {
                const errorMessage = data.error?.message || data.error || 'Falha no login';
                Dialogs.alert(errorMessage, 'Erro');
            }
        } catch (error) {
            console.error('Error:', error);
            Dialogs.alert('Erro de conexão. Verifique se o backend está rodando.', 'Erro');
        }
    });

    container.querySelector('#go-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'register' }));
    });

    return container;
};
