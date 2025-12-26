import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const ParametrosGeraisManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.maxWidth = '800px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    let originalSettings = {};
    let currentSettings = {};

    const showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            background: ${type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#3B82F6'};
            color: white;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    const loadSettings = async () => {
        try {
            console.log('🔄 Loading settings from API...');
            console.log('API URL:', `${API_BASE_URL}/settings`);

            const response = await fetch(`${API_BASE_URL}/settings`, {
                headers: getHeaders()
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const settings = await response.json();
            console.log('✅ Settings loaded:', settings);

            originalSettings = {
                numero_dias: settings.numero_dias,
                tempo_minutos_liberacao: settings.tempo_minutos_liberacao
            };
            currentSettings = { ...originalSettings };

            console.log('Original settings:', originalSettings);
            console.log('Current settings:', currentSettings);

            renderSettings();
        } catch (error) {
            console.error('❌ Error loading settings:', error);
            showToast('Erro ao carregar configurações', 'error');
        }
    };

    const updateFieldState = (field) => {
        const input = container.querySelector(`#input-${field}`);
        const saveBtn = container.querySelector(`#save-${field}`);

        if (!input || !saveBtn) return;

        const currentValue = parseInt(input.value);
        const originalValue = originalSettings[field];
        const isDirty = currentValue !== originalValue;

        saveBtn.disabled = !isDirty;
        saveBtn.style.opacity = isDirty ? '1' : '0.4';
        saveBtn.style.cursor = isDirty ? 'pointer' : 'not-allowed';
    };

    const saveSetting = async (field) => {
        const input = container.querySelector(`#input-${field}`);
        const value = parseInt(input.value);

        if (isNaN(value) || value <= 0) {
            showToast('Valor deve ser um número positivo', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/settings/${field}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ value })
            });

            if (response.ok) {
                const updatedSettings = await response.json();
                originalSettings[field] = updatedSettings[field];
                currentSettings[field] = updatedSettings[field];
                updateFieldState(field);
                showToast('Configuração salva com sucesso!', 'success');
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao salvar configuração', 'error');
            }
        } catch (error) {
            console.error('Error saving setting:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    let unlockTimer = null;
    let unlockCountdownInterval = null;
    let unlockExpiresAt = null;

    const activateUnlock = async () => {
        // Se já está ativo, cancelar
        if (unlockTimer) {
            cancelUnlock();
            return;
        }

        const minutes = currentSettings.tempo_minutos_liberacao;
        const confirmed = await Dialogs.confirm(
            `Você está prestes a liberar edições em qualquer data do sistema por ${minutes} minutos. Deseja continuar?`,
            '⚠️ Atenção: Liberação Temporária'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/settings/unlock`, {
                method: 'POST',
                headers: getHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                unlockExpiresAt = new Date(result.expires_at);
                startCountdown();
                showToast(`✓ ${result.message}`, 'success');
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao ativar liberação', 'error');
            }
        } catch (error) {
            console.error('Error activating unlock:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    const cancelUnlock = () => {
        if (unlockCountdownInterval) {
            clearInterval(unlockCountdownInterval);
            unlockCountdownInterval = null;
        }
        if (unlockTimer) {
            clearTimeout(unlockTimer);
            unlockTimer = null;
        }
        unlockExpiresAt = null;
        updateUnlockButton(false, 0);
        showToast('Liberação temporária cancelada', 'info');
    };

    const startCountdown = () => {
        updateUnlockButton(true, getRemainingTime());

        unlockCountdownInterval = setInterval(() => {
            const remaining = getRemainingTime();
            if (remaining <= 0) {
                cancelUnlock();
                showToast('Liberação temporária expirada', 'info');
            } else {
                updateUnlockButton(true, remaining);
            }
        }, 1000);
    };

    const getRemainingTime = () => {
        if (!unlockExpiresAt) return 0;
        const now = new Date();
        const diff = unlockExpiresAt - now;
        return Math.max(0, Math.ceil(diff / 1000));
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const updateUnlockButton = (isActive, remainingSeconds) => {
        const button = container.querySelector('#btn-activate-unlock');
        const timerDisplay = container.querySelector('#unlock-timer-display');

        if (!button) return;

        if (isActive) {
            // Estado ATIVO (desbloqueado)
            button.innerHTML = `🔓 Cancelar Liberação`;
            button.style.background = 'linear-gradient(135deg, #DAB177 0%, #C9A366 100%)';
            button.style.color = '#1F2937';
            button.onmouseover = function () {
                this.style.background = 'linear-gradient(135deg, #C9A366 0%, #B89355 100%)';
            };
            button.onmouseout = function () {
                this.style.background = 'linear-gradient(135deg, #DAB177 0%, #C9A366 100%)';
            };

            if (timerDisplay) {
                timerDisplay.textContent = `Tempo restante: ${formatTime(remainingSeconds)}`;
                timerDisplay.style.display = 'block';
                timerDisplay.style.color = '#DAB177';
                timerDisplay.style.fontWeight = '600';
            }
        } else {
            // Estado PADRÃO (bloqueado)
            button.innerHTML = `<span style="color: #4B5563; font-size: 1.1rem;">🔒</span> Liberar Edições Temporariamente`;
            button.style.background = '#E5E7EB';
            button.style.color = '#1F2937';
            button.onmouseover = function () {
                this.style.background = '#D1D5DB';
            };
            button.onmouseout = function () {
                this.style.background = '#E5E7EB';
            };

            if (timerDisplay) {
                timerDisplay.style.display = 'none';
            }
        }
    };

    const renderSettings = () => {
        container.innerHTML = `
            <style>
                .settings-input {
                    flex: 1;
                    padding: 0.75rem;
                    border: 1px solid #D1D5DB;
                    border-radius: 8px;
                    font-size: 1rem;
                    background: var(--color-bg);
                    color: var(--color-text);
                    transition: border-color 0.2s, box-shadow 0.2s;
                    outline: none;
                }
                
                .settings-input:focus {
                    border-color: #3B82F6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                
                .settings-input:hover:not(:focus) {
                    border-color: #9CA3AF;
                }
            </style>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>⚙️ Parâmetros Gerais</h2>
            </div>

            <div style="background: var(--color-surface); padding: 2rem; border-radius: 12px; border: 1px solid var(--color-border-light);">
                
                <!-- Número de Dias -->
                <div style="margin-bottom: 2rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-text);">
                        📅 Número de Dias
                    </label>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <input 
                            type="number" 
                            id="input-numero_dias" 
                            class="settings-input"
                            value="${currentSettings.numero_dias}"
                            min="1"
                        />
                        <button 
                            id="save-numero_dias"
                            class="btn-save-setting"
                            disabled
                            style="
                                padding: 0.75rem 1.5rem;
                                background: var(--color-success);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 1.2rem;
                                cursor: not-allowed;
                                opacity: 0.4;
                                transition: all 0.2s;
                            "
                            title="Salvar alteração"
                        >✓</button>
                    </div>
                    <small style="display: block; margin-top: 0.5rem; color: var(--color-text-muted);">
                        Número de dias padrão utilizado pelo sistema
                    </small>
                </div>

                <!-- Tempo em Minutos -->
                <div style="margin-bottom: 2rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-text);">
                        ⏱️ Tempo em minutos para usar o sistema sem regras de datas
                    </label>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <input 
                            type="number" 
                            id="input-tempo_minutos_liberacao" 
                            class="settings-input"
                            value="${currentSettings.tempo_minutos_liberacao}"
                            min="1"
                        />
                        <button 
                            id="save-tempo_minutos_liberacao"
                            class="btn-save-setting"
                            disabled
                            style="
                                padding: 0.75rem 1.5rem;
                                background: var(--color-success);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 1.2rem;
                                cursor: not-allowed;
                                opacity: 0.4;
                                transition: all 0.2s;
                            "
                            title="Salvar alteração"
                        >✓</button>
                    </div>
                    <small style="display: block; margin-top: 0.5rem; color: var(--color-text-muted);">
                        Duração da liberação temporária para editar datas antigas
                    </small>
                </div>

                <!-- Separador -->
                <hr style="border: none; border-top: 1px solid var(--color-border-light); margin: 2rem 0;" />

                <!-- Botão de Liberação Temporária -->
                <div>
                    <button 
                        id="btn-activate-unlock"
                        class="btn-unlock"
                        style="
                            width: 100%;
                            padding: 1rem;
                            background: #E5E7EB;
                            color: #1F2937;
                            border: none;
                            border-radius: 8px;
                            font-size: 1rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 0.5rem;
                        "
                        onmouseover="this.style.background='#D1D5DB'"
                        onmouseout="this.style.background='#E5E7EB'"
                    >
                        <span style="color: #4B5563; font-size: 1.1rem;">🔒</span> Liberar Edições Temporariamente
                    </button>
                    <div id="unlock-timer-display" style="display: none; margin-top: 0.75rem; text-align: center; font-size: 1.1rem;"></div>
                    <small style="display: block; margin-top: 0.75rem; color: var(--color-text-muted); text-align: center;">
                        Permite editar registros em qualquer data por tempo limitado
                    </small>
                </div>

            </div>
        `;

        // Event listeners para inputs
        const fields = ['numero_dias', 'tempo_minutos_liberacao'];
        fields.forEach(field => {
            const input = container.querySelector(`#input-${field}`);
            input.addEventListener('input', () => {
                currentSettings[field] = parseInt(input.value);
                updateFieldState(field);
            });

            const saveBtn = container.querySelector(`#save-${field}`);
            saveBtn.addEventListener('click', () => saveSetting(field));
        });

        // Event listener para botão de liberação
        const unlockBtn = container.querySelector('#btn-activate-unlock');
        unlockBtn.addEventListener('click', activateUnlock);
    };

    loadSettings();

    return container;
};
