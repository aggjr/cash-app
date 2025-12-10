import { getApiBaseUrl } from '../utils/apiConfig.js';

export const InviteUserModal = {
    show({ projectId, onSuccess }) {
        return new Promise(async (resolve) => {
            try {
                const API_BASE_URL = getApiBaseUrl();
                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';

                const modal = document.createElement('div');
                modal.className = 'account-modal animate-float-in';

                modal.innerHTML = `
                    <div class="account-modal-body" style="padding: 1.5rem;">
                        <h3 style="margin: 0 0 1.5rem 0; color: var(--color-primary); font-size: 1.2rem;">👤 Cadastrar Novo Usuário</h3>
                        
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div class="form-group">
                                <label for="invite-name">Nome Completo <span class="required">*</span></label>
                                <input type="text" id="invite-name" class="form-input" placeholder="Ex: João Silva" required />
                            </div>

                            <div class="form-group">
                                <label for="invite-email">E-mail <span class="required">*</span></label>
                                <input type="email" id="invite-email" class="form-input" placeholder="usuario@email.com" required />
                            </div>

                            <div class="form-group">
                                <label for="invite-password">Senha Inicial <span class="required">*</span></label>
                                <input type="text" id="invite-password" class="form-input" placeholder="Mínimo 8 caracteres" required minlength="8" />
                                <small style="color: #666; font-size: 0.85rem;">Esta senha será usada no primeiro login. O usuário deverá trocá-la.</small>
                            </div>

                            <div class="form-group">
                                <label for="invite-role">Função no Projeto</label>
                                <select id="invite-role" class="form-input">
                                    <option value="user">Usuário</option>
                                    <option value="master">Master (Administrador)</option>
                                </select>
                                <small style="color: #666; font-size: 0.85rem;">⚠️ Apenas 1 master por projeto. Ao selecionar master, você perderá essa função.</small>
                            </div>

                            <div style="background: #FEF3C7; padding: 1rem; border-radius: 6px; border-left: 4px solid #F59E0B;">
                                <p style="margin: 0; font-size: 0.9rem; color: #92400E;">
                                    <strong>📋 Importante:</strong><br>
                                    • Anote o e-mail e senha para passar ao usuário<br>
                                    • O usuário deverá trocar a senha no primeiro login<br>
                                    • Nenhum e-mail será enviado automaticamente
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="account-modal-footer" style="padding: 1rem;">
                        <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                        <button class="btn-primary" id="modal-send" type="button">✓ Criar Usuário</button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                const nameInput = modal.querySelector('#invite-name');
                const emailInput = modal.querySelector('#invite-email');
                const passwordInput = modal.querySelector('#invite-password');
                const roleSelect = modal.querySelector('#invite-role');
                const sendBtn = modal.querySelector('#modal-send');
                const cancelBtn = modal.querySelector('#modal-cancel');

                const validate = () => {
                    let isValid = true;
                    if (!nameInput.value.trim()) {
                        nameInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        nameInput.classList.remove('input-error');
                    }

                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailInput.value.trim() || !emailRegex.test(emailInput.value)) {
                        emailInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        emailInput.classList.remove('input-error');
                    }

                    if (!passwordInput.value || passwordInput.value.length < 8) {
                        passwordInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        passwordInput.classList.remove('input-error');
                    }

                    return isValid;
                };

                const close = (result) => {
                    modal.classList.add('animate-float-out');
                    overlay.classList.add('fade-out');
                    setTimeout(() => {
                        if (container.contains(overlay)) container.removeChild(overlay);
                        resolve(result);
                    }, 200);
                };

                sendBtn.addEventListener('click', async () => {
                    if (!validate()) {
                        alert('Por favor, preencha todos os campos obrigatórios corretamente.');
                        return;
                    }

                    sendBtn.disabled = true;
                    sendBtn.textContent = '⏳ Criando...';

                    try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/invite`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                name: nameInput.value.trim(),
                                email: emailInput.value.trim(),
                                initialPassword: passwordInput.value,
                                role: roleSelect.value
                            })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            alert(`✅ Usuário criado com sucesso!\n\n📧 E-mail: ${emailInput.value}\n🔑 Senha: ${passwordInput.value}\n\n⚠️ IMPORTANTE: Anote estes dados e passe ao usuário.\nO usuário deverá trocar a senha no primeiro login.`);
                            close(true);
                            if (onSuccess) onSuccess();
                        } else {
                            const error = await response.json();
                            alert('❌ Erro: ' + (error.error || 'Não foi possível criar o usuário'));
                            sendBtn.disabled = false;
                            sendBtn.textContent = '✓ Criar Usuário';
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        alert('❌ Erro de conexão. Verifique se o backend está rodando.');
                        sendBtn.disabled = false;
                        sendBtn.textContent = '✓ Criar Usuário';
                    }
                });

                cancelBtn.addEventListener('click', () => close(false));
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) close(false);
                });

                setTimeout(() => nameInput.focus(), 100);

            } catch (error) {
                console.error('Modal error:', error);
                alert('Erro ao abrir modal: ' + error.message);
                resolve(null);
            }
        });
    }
};
