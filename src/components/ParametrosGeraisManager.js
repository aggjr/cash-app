import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { TabPanel } from './TabPanel.js';

export const ParametrosGeraisManager = (project) => {
    // Create main wrapper for tabs
    const wrapper = document.createElement('div');
    wrapper.style.padding = '2rem';
    wrapper.style.margin = '2rem';
    wrapper.style.maxWidth = '900px';
    wrapper.style.height = 'calc(100vh - 200px)';

    // Create container for "Geral" tab content
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
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

            // Helper to get local user
            const getUser = () => {
                try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; }
            };

            const currentUser = getUser();
            console.log('👤 Current User Prefs:', currentUser);

            originalSettings = {
                numero_dias: settings.numero_dias,
                tempo_minutos_liberacao: settings.tempo_minutos_liberacao,
                iva_timeout: settings.iva_timeout || 3,
                // Voice settings: prioritization (User > System > Default)
                iva_voice_enabled: (currentUser?.IVA_voice_enabled !== undefined) ? currentUser.IVA_voice_enabled : 1,
                iva_voice_rate: (currentUser?.IVA_voice_rate !== undefined) ? currentUser.IVA_voice_rate : (settings.iva_voice_rate || 50),
                iva_voice_premium: settings.iva_voice_premium || 0,
                iva_voice_male: settings.iva_voice_male || 0
            };
            currentSettings = { ...originalSettings };

            console.log('[ParametrosGerais] Merged Settings:', currentSettings);

            renderSettings();

            // Check if there's an active unlock
            if (settings.unlock_expires_at) {
                const expiresAt = new Date(settings.unlock_expires_at);
                const now = new Date();

                console.log('🔍 Checking unlock status...');
                console.log('  unlock_expires_at:', expiresAt);
                console.log('  now:', now);
                console.log('  still valid:', expiresAt > now);

                if (expiresAt > now) {
                    // Unlock is still active, restore countdown
                    console.log('✅ Restoring active unlock countdown');
                    unlockExpiresAt = expiresAt;
                    startCountdown();
                } else {
                    // Unlock expired, clear it on server
                    console.log('⏰ Unlock expired, clearing...');
                    try {
                        await fetch(`${API_BASE_URL}/settings/unlock/cancel`, {
                            method: 'POST',
                            headers: getHeaders()
                        });
                        console.log('✓ Expired unlock cleared');
                    } catch (err) {
                        console.warn('Could not clear expired unlock:', err);
                    }
                }
            } else {
                console.log('🔒 No active unlock - starting in LOCK mode');
            }

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

        if (isDirty) {
            saveBtn.style.background = 'var(--color-primary)';
            saveBtn.style.color = 'white';
            saveBtn.style.cursor = 'pointer';
            saveBtn.style.transform = 'translateY(-1px)';
            saveBtn.style.boxShadow = 'var(--shadow-md)';
        } else {
            saveBtn.style.background = '#e5e7eb';
            saveBtn.style.color = '#9ca3af';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.style.transform = 'none';
            saveBtn.style.boxShadow = 'none';
        }
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
        console.log('[ACTIVATE UNLOCK] Button clicked!');
        console.log('[ACTIVATE UNLOCK] unlockCountdownInterval:', unlockCountdownInterval);
        console.log('[ACTIVATE UNLOCK] unlockExpiresAt:', unlockExpiresAt);

        // Se já está ativo, cancelar (verifica se tem countdown ativo OU se ainda não expirou)
        const isActive = unlockCountdownInterval !== null || (unlockExpiresAt && new Date(unlockExpiresAt) > new Date());

        if (isActive) {
            console.log('[ACTIVATE UNLOCK] Unlock is ACTIVE, calling cancelUnlock...');
            await cancelUnlock();
            return;
        }

        console.log('[ACTIVATE UNLOCK] Unlock is inactive, activating...');
        const minutes = currentSettings.tempo_minutos_liberacao;
        const confirmed = await Dialogs.confirm(
            `Você está prestes a liberar edições em qualquer data do sistema por ${minutes} minutos. Deseja continuar?`,
            '⚠️ Atenção: Liberação Temporária'
        );

        if (!confirmed) {
            console.log('[ACTIVATE UNLOCK] User canceled confirmation');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/settings/unlock`, {
                method: 'POST',
                headers: getHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                unlockExpiresAt = new Date(result.expires_at);
                console.log('[ACTIVATE UNLOCK] Unlock activated until:', unlockExpiresAt);
                startCountdown();
                showToast(`✓ ${result.message}`, 'success');
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao ativar liberação', 'error');
            }
        } catch (error) {
            console.error('[ACTIVATE UNLOCK] Error:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    const cancelUnlock = async () => {
        console.log('[CANCEL UNLOCK] Starting cancel process...');
        console.log('[CANCEL UNLOCK] Current interval:', unlockCountdownInterval);
        console.log('[CANCEL UNLOCK] Current timer:', unlockTimer);

        // Clear local timers IMMEDIATELY (synchronous)
        if (unlockCountdownInterval) {
            console.log('[CANCEL UNLOCK] Clearing interval...');
            clearInterval(unlockCountdownInterval);
            unlockCountdownInterval = null;
        }
        if (unlockTimer) {
            console.log('[CANCEL UNLOCK] Clearing timeout...');
            clearTimeout(unlockTimer);
            unlockTimer = null;
        }

        // Clear expiration date
        unlockExpiresAt = null;

        // Update button to default state
        console.log('[CANCEL UNLOCK] Updating button to inactive state');
        updateUnlockButton(false, 0);

        // Call backend to clear unlock in database (async, but doesn't affect UI)
        try {
            const response = await fetch(`${API_BASE_URL}/settings/unlock/cancel`, {
                method: 'POST',
                headers: getHeaders()
            });

            if (response.ok) {
                console.log('[CANCEL UNLOCK] Backend cleared successfully');
                showToast('✓ Liberação temporária cancelada. Sistema retornou ao modo normal', 'success');
            } else {
                console.warn('[CANCEL UNLOCK] Backend error, but local state already cleared');
                showToast('Liberação temporária cancelada localmente', 'info');
            }
        } catch (error) {
            console.error('[CANCEL UNLOCK] Error canceling on server:', error);
            showToast('Liberação temporária cancelada localmente', 'info');
        }
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
            
            <!-- Tab Navigation (Chrome Style) -->
            <div class="chrome-tabs-wrapper">
                <button 
                    id="tab-geral" 
                    class="chrome-tab active"
                >
                    ⚙️ Sistema
                </button>
                <button 
                    id="tab-IVA" 
                    class="chrome-tab"
                >
                    🤖 IA IVA
                </button>
            </div>

            <!-- Tab Content: Geral -->
            <div id="content-geral" class="tab-content" style="display: block;">
                <h2 style="margin-bottom: 1.5rem;">⚙️ Configurações do Sistema</h2>
                <div style="background: var(--color-surface); padding: 2rem; border-radius: 12px; border: 1px solid var(--color-border-light);">
                    
                    <!-- Número de Dias -->
                    <div style="margin-bottom: 2rem;">
                        <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-text);">
                            📅 Número de Dias
                        </label>
                        <div style="display: flex; align-items: center; gap: 0.75rem; height: 45px;">
                            <input 
                                type="number" 
                                id="input-numero_dias" 
                                class="settings-input"
                                value="${currentSettings.numero_dias}"
                                min="1"
                                style="max-width: 150px; height: 100%; box-sizing: border-box;"
                            />
                            <button 
                                id="save-numero_dias"
                                class="btn-save-setting"
                                disabled
                                style="
                                    height: 100%;
                                    aspect-ratio: 1;
                                    padding: 0;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    background: #e5e7eb;
                                    color: #9ca3af;
                                    border: none;
                                    border-radius: 8px;
                                    font-size: 1.2rem;
                                    cursor: not-allowed;
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
                        <div style="display: flex; align-items: center; gap: 0.75rem; height: 45px;">
                            <input 
                                type="number" 
                                id="input-tempo_minutos_liberacao" 
                                class="settings-input"
                                value="${currentSettings.tempo_minutos_liberacao}"
                                min="1"
                                style="max-width: 150px; height: 100%; box-sizing: border-box;"
                            />
                            <button 
                                id="save-tempo_minutos_liberacao"
                                class="btn-save-setting"
                                disabled
                                style="
                                    height: 100%;
                                    aspect-ratio: 1;
                                    padding: 0;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    background: #e5e7eb;
                                    color: #9ca3af;
                                    border: none;
                                    border-radius: 8px;
                                    font-size: 1.2rem;
                                    cursor: not-allowed;
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
                                background: var(--color-primary);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 1rem;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.2s;
                                display: flex;
                                alignItems: center;
                                justifyContent: center;
                                gap: 0.5rem;
                            "
                            onmouseover="this.style.background='#1D4ED8'"
                            onmouseout="this.style.background='var(--color-primary)'"
                        >
                            <span style="color: white; font-size: 1.1rem;">🔓</span> Liberar Edições Temporariamente
                        </button>
                        <div id="unlock-timer-display" style="display: none; margin-top: 0.75rem; text-align: center; font-size: 1.1rem;"></div>
                        <small style="display: block; margin-top: 0.75rem; color: var(--color-text-muted); text-align: center;">
                            Permite editar registros em qualquer data por tempo limitado
                        </small>
                    </div>
                </div>
            </div>

            <!-- Tab Content: IVA -->
            <div id="content-IVA" class="tab-content" style="display: none;">
                <h2 style="margin-bottom: 1.5rem;">🤖 Configurações da IA IVA</h2>
                <div style="background: var(--color-surface); padding: 2rem; border-radius: 12px; border: 1px solid var(--color-border-light);">

                <!-- Ativar Voz (Toggle) -->
                <div style="margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: ${currentSettings.iva_voice_enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.05)'}; border-radius: 8px; border: 1px solid ${currentSettings.iva_voice_enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(107, 114, 128, 0.2)'};">
                    <div>
                        <label style="display: block; font-weight: 600; color: var(--color-text); font-size: 1.1rem; margin-bottom: 0.25rem;">
                            🗣️ Ativar Voz da IVA
                        </label>
                        <small style="color: var(--color-text-muted);">
                            Se desativado, a IVA responderá apenas por texto.
                        </small>
                    </div>
                    <label class="switch" style="position: relative; display: inline-block; width: 60px; height: 34px;">
                        <input type="checkbox" id="toggle-iva_voice_enabled" ${currentSettings.iva_voice_enabled ? 'checked' : ''}>
                        <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px;"></span>
                        <style>
                            .switch input:checked + .slider { background-color: var(--color-primary); }
                            .switch input:focus + .slider { box-shadow: 0 0 1px var(--color-primary); }
                            .switch input:checked + .slider:before { transform: translateX(26px); }
                            .slider:before { position: absolute; content: ""; height: 26px; width: 26px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
                        </style>
                    </label>
                </div>

                <!-- Tempo Resposta IVA - SLIDER -->
                <div style="margin-bottom: 2rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-text);">
                        ⏳ Tempo de Espera (segundos)
                    </label>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="min-width: 30px; text-align: right; color: var(--color-text-muted); font-size: 0.875rem;">1s</span>
                        <div style="flex: 1; position: relative;">
                            <input 
                                type="range" 
                                id="slider-iva_timeout" 
                                min="1" 
                                max="10" 
                                value="${currentSettings.iva_timeout || 2}"
                                step="1"
                                style="
                                    width: 100%;
                                    height: 8px;
                                    -webkit-appearance: none;
                                    appearance: none;
                                    background: linear-gradient(to right, #EF4444 0%, #F59E0B 50%, #10B981 100%);
                                    border-radius: 4px;
                                    outline: none;
                                "
                            />
                            <div 
                                id="timeout-display"
                                style="
                                    position: absolute;
                                    top: -30px;
                                    left: 50%;
                                    transform: translateX(-50%);
                                    background: var(--color-primary);
                                    color: white;
                                    padding: 0.25rem 0.5rem;
                                    border-radius: 4px;
                                    font-size: 0.875rem;
                                    font-weight: 600;
                                    white-space: nowrap;
                                "
                            >2s</div>
                        </div>
                        <span style="min-width: 30px; color: var(--color-text-muted); font-size: 0.875rem;">10s</span>
                    </div>
                    <small style="display: block; margin-top: 0.5rem; color: var(--color-text-muted);">
                        Tempo de silêncio para a IVA considerar que você terminou de falar
                    </small>
                </div>

                <!-- Voice Speed Slider -->
                <div style="margin-bottom: 2rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-text);">
                        🎤 Velocidade da Voz da IVA
                    </label>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="min-width: 40px; text-align: right; color: var(--color-text-muted); font-size: 0.875rem;">0x</span>
                        <div style="flex: 1; position: relative;">
                            <input 
                                type="range" 
                                id="slider-iva_voice_rate" 
                                min="-100" 
                                max="100" 
                                value="${currentSettings.iva_voice_rate || 0}"
                                step="5"
                                style="
                                    width: 100%;
                                    height: 8px;
                                    -webkit-appearance: none;
                                    appearance: none;
                                    background: linear-gradient(to right, #EF4444 0%, #3B82F6 50%, #10B981 100%);
                                    border-radius: 4px;
                                    outline: none;
                                "
                            />
                            <div 
                                id="voice-rate-display"
                                style="
                                    position: absolute;
                                    top: -30px;
                                    left: 50%;
                                    transform: translateX(-50%);
                                    background: var(--color-primary);
                                    color: white;
                                    padding: 0.25rem 0.5rem;
                                    border-radius: 4px;
                                    font-size: 0.875rem;
                                    font-weight: 600;
                                    white-space: nowrap;
                                "
                            >1.30x</div>
                        </div>
                        <span style="min-width: 40px; color: var(--color-text-muted); font-size: 0.875rem;">2.6x</span>
                        <button 
                            id="test-voice-speed"
                            style="
                                height: 45px;
                                aspect-ratio: 1;
                                padding: 0;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                background: var(--color-primary);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 1.3rem;
                                cursor: pointer;
                                transition: all 0.2s;
                            "
                            onmouseover="this.style.background='#1D4ED8'"
                            onmouseout="this.style.background='var(--color-primary)'"
                            title="Testar velocidade da voz"
                        >🔊</button>
                    </div>
                    <small style="display: block; margin-top: 0.5rem; color: var(--color-text-muted);">
                        Ajuste a velocidade de fala da IVA (-100% a +100% da velocidade padrão de 1.30x)
                    </small>
                </div>

                <!-- Tipo de Voz -->
                <div style="margin-bottom: 2rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 1rem; color: var(--color-text); font-size: 1.1rem;">
                        🎙️ Qualidade da Voz da IVA
                    </label>
                    
                    <!-- Free - Row 1 -->
                    <label class="voice-type-option" style="display: flex; align-items: center; padding: 1rem; background: white; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.3s;">
                        <input type="radio" name="iva_voice_premium" value="0" style="margin-right: 1rem; width: 20px; height: 20px; cursor: pointer;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">🆓 Voz Gratuita</div>
                            <small style="color: #666;">Sintetizador do navegador (grátis)</small>
                        </div>
                    </label>
                    
                    <!-- Standard - Row 2 -->
                    <label class="voice-type-option" style="display: flex; align-items: center; padding: 1rem; background: white; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.3s;">
                        <input type="radio" name="iva_voice_premium" value="1" style="margin-right: 1rem; width: 20px; height: 20px; cursor: pointer;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">📢 Voz Standard</div>
                            <small style="color: #666;">Google TTS Standard (sempre grátis - 4M chars/mês)</small>
                        </div>
                    </label>
                    
                    <!-- Premium - Row 3 -->
                    <label class="voice-type-option" style="display: flex; align-items: center; padding: 1rem; background: white; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 1rem; cursor: pointer; transition: all 0.3s;">
                        <input type="radio" name="iva_voice_premium" value="2" style="margin-right: 1rem; width: 20px; height: 20px; cursor: pointer;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">🎤 Voz Premium</div>
                            <small style="color: #666;">Google TTS Neural2 (qualidade máxima - grátis 1º ano)</small>
                        </div>
                    </label>

                    <!-- Gender selection -->
                    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(37, 99, 235, 0.05); border-radius: 8px; border: 1px solid rgba(37, 99, 235, 0.2);">
                        <label style="display: block; font-weight: 500; margin-bottom: 0.75rem; color: var(--color-text); font-size: 0.95rem;">
                            👤 Gênero da Voz:
                        </label>
                        <div style="display: flex; gap: 1.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem 1rem; border: 2px solid #e5e7eb; border-radius: 6px; transition: all 0.2s; flex: 1; justify-content: center;" class="voice-gender-option">
                                <input 
                                    type="radio" 
                                    name="iva_voice_male" 
                                    value="0"
                                    checked
                                    style="cursor: pointer;"
                                />
                                <span style="font-weight: 500;">♀️ Feminina</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem 1rem; border: 2px solid #e5e7eb; border-radius: 6px; transition: all 0.2s; flex: 1; justify-content: center;" class="voice-gender-option">
                                <input 
                                    type="radio" 
                                    name="iva_voice_male" 
                                    value="1"
                                    style="cursor: pointer;"
                                />
                                <span style="font-weight: 500;">♂️ Masculina</span>
                            </label>
                        </div>
                    </div>

                    <small style="display: block; margin-top: 0.75rem; color: var(--color-text-muted); line-height: 1.5;">
                        A voz Premium oferece qualidade superior e sotaque brasileiro autêntico.
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
                            background: var(--color-primary);
                            color: white;
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
                        onmouseover="this.style.background='#1D4ED8'"
                        onmouseout="this.style.background='var(--color-primary)'"
                    >
                        <span style="color: white; font-size: 1.1rem;">🔒</span> Liberar Edições Temporariamente
                    </button>
                    </button>
                    <div id="unlock-timer-display" style="display: none; margin-top: 0.75rem; text-align: center; font-size: 1.1rem;"></div>
                    <small style="display: block; margin-top: 0.75rem; color: var(--color-text-muted); text-align: center;">
                        Permite editar registros em qualquer data por tempo limitado
                    </small>
                </div>

                </div>
            </div>

            <script>
                // Tab switching logic
                // Note: The script tag here is for documentation of structure. 
                // Actual listeners are attached below in the main function execution.
            </script>
        `;

        // Wait for DOM
        setTimeout(() => {
            const tabs = container.querySelectorAll('.settings-tab');
            const contents = container.querySelectorAll('.tab-content');

            console.log('[Settings] Tabs found:', tabs.length);

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.id.replace('tab-', 'content-');
                    console.log('[Settings] Switching to:', targetId);

                    // Reset all tabs
                    tabs.forEach(t => {
                        t.style.color = 'var(--color-text-muted)';
                        t.style.borderBottom = '3px solid transparent';
                    });

                    // Reset all tabs
                    tabs.forEach(t => {
                        t.classList.remove('active');
                        t.style.color = '';
                        t.style.borderBottom = '';
                    });

                    // Hide all contents
                    contents.forEach(c => {
                        c.style.display = 'none';
                    });

                    // Activate clicked tab
                    tab.classList.add('active');

                    // Show target content
                    const content = container.querySelector(`#${targetId}`);
                    if (content) {
                        content.style.display = 'block';
                    }
                });
            });

            // Trigger click on active tab (default: Geral/Sistema)
            const defaultTab = container.querySelector('#tab-geral');
            if (defaultTab) defaultTab.click();
        }, 100);
            </script >

    >

            </div >
    `;

        // Event listeners para inputs (exceto iva_timeout que agora é slider)
        const fields = ['numero_dias', 'tempo_minutos_liberacao'];
        fields.forEach(field => {
            const input = container.querySelector(`#input - ${ field } `);
            input.addEventListener('input', () => {
                currentSettings[field] = parseInt(input.value);
                updateFieldState(field);
            });

            const saveBtn = container.querySelector(`#save - ${ field } `);
            saveBtn.addEventListener('click', () => saveSetting(field));
        });

        // Event listener para timeout slider (AUTO-SAVE)
        const timeoutSlider = container.querySelector('#slider-iva_timeout');
        const timeoutDisplay = container.querySelector('#timeout-display');
        let timeoutSaveTimer = null;

        const updateTimeoutDisplay = (value) => {
            timeoutDisplay.textContent = value + 's';

            // Move display above slider position (range is now 1-10)
            const percentage = ((value - 1) / 9) * 100; // (value - min) / (max - min)
            timeoutDisplay.style.left = `${ percentage }% `;
        };

        timeoutSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            currentSettings.iva_timeout = value;
            updateTimeoutDisplay(value);

            // Clear previous timer
            if (timeoutSaveTimer) {
                clearTimeout(timeoutSaveTimer);
            }

            // Auto-save after 800ms of inactivity
            timeoutSaveTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`${ API_BASE_URL } /settings/iva_timeout`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({ value })
                    });

                    if (response.ok) {
                        originalSettings.iva_timeout = value;
                        // Update global timeout immediately
                        if (window.AIConsultant && window.AIConsultant.ivaTimeout !== undefined) {
                            window.AIConsultant.ivaTimeout = value * 1000;
                        }
                        console.log('[Settings] Auto-saved timeout to:', value + 's');
                        showToast('✓ Tempo de espera atualizado', 'success');
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao salvar', 'error');
                    }
                } catch (error) {
                    console.error('[Settings] Error saving timeout:', error);
                    showToast('Erro de conexão', 'error');
                }
            }, 800);
        });

        // Initialize timeout display
        updateTimeoutDisplay(currentSettings.iva_timeout || 2);

        // --- Voice Toggle Logic ---
        const voiceToggle = container.querySelector('#toggle-iva_voice_enabled');
        if (voiceToggle) {
            voiceToggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked ? 1 : 0;
                currentSettings.iva_voice_enabled = enabled;

                // Visual feedback update
                const parentDiv = e.target.closest('div').parentElement;
                if (parentDiv) {
                    parentDiv.style.background = enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.05)';
                    parentDiv.style.borderColor = enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(107, 114, 128, 0.2)';
                }

                try {
                    // Update Local Storage User immediately
                    const user = getUser();
                    if (user) {
                        user.IVA_voice_enabled = enabled;
                        localStorage.setItem('user', JSON.stringify(user));
                    }

                    // Call API
                    const response = await fetch(`${ API_BASE_URL } /auth/update - preference`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({ ivaVoiceEnabled: enabled })
                    });

                    if (response.ok) {
                        showToast(enabled ? '🔊 Voz ativada' : '🔇 Voz desativada', 'success');
                    } else {
                        showToast('Erro ao salvar preferência de voz', 'error');
                    }
                } catch (error) {
                    console.error('Error saving voice toggle:', error);
                    showToast('Erro de conexão', 'error');
                }
            });
        }

        // Event listener para voice rate slider (AUTO-SAVE)
        const voiceSlider = container.querySelector('#slider-iva_voice_rate');
        const voiceDisplay = container.querySelector('#voice-rate-display');
        let voiceSaveTimer = null;

        const updateVoiceDisplay = (value) => {
            // Formula: 0.5 + (value/100) -> 50 = 1.0x
            const rate = 0.5 + (value / 100);
            voiceDisplay.textContent = rate.toFixed(2) + 'x';

            // Move display above slider position
            const percentage = ((value + 100) / 200) * 100;
            voiceDisplay.style.left = `${ percentage }% `;
        };

        if (voiceSlider) {
            voiceSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                currentSettings.iva_voice_rate = value;
                updateVoiceDisplay(value);

                // Clear previous timer
                if (voiceSaveTimer) clearTimeout(voiceSaveTimer);

                // Auto-save
                voiceSaveTimer = setTimeout(async () => {
                    try {
                        // Update Local Storage User
                        const user = getUser();
                        if (user) {
                            user.IVA_voice_rate = value;
                            localStorage.setItem('user', JSON.stringify(user));
                        }

                        // SYSTEM SETTING (Fallback/Global)
                        const sysResponse = await fetch(`${ API_BASE_URL } /settings/iva_voice_rate`, {
                            method: 'PUT',
                            headers: getHeaders(),
                            body: JSON.stringify({ value })
                        });

                        // USER PREFERENCE (Primary)
                        const userResponse = await fetch(`${ API_BASE_URL } /auth/update - preference`, {
                            method: 'PUT',
                            headers: getHeaders(),
                            body: JSON.stringify({ ivaVoiceRate: value })
                        });

                        if (userResponse.ok) {
                            originalSettings.iva_voice_rate = value;
                            console.log('[Settings] Auto-saved voice rate:', value);
                            showToast('✓ Velocidade da voz atualizada', 'success');
                        } else {
                            if (sysResponse.ok) {
                                showToast('✓ Velocidade (Sistema) atualizada', 'success');
                            } else {
                                const error = await userResponse.json();
                                showToast(error.error || 'Erro ao salvar', 'error');
                            }
                        }
                    } catch (error) {
                        console.error('[Settings] Error saving voice rate:', error);
                        showToast('Erro de conexão', 'error');
                    }
                }, 800);
            });
        }

        // Initialize voice display
        updateVoiceDisplay(currentSettings.iva_voice_rate || 0);

        // Voice type selection
        const voiceTypeRadios = container.querySelectorAll('input[name="iva_voice_premium"]');
        const voiceGenderRadios = container.querySelectorAll('input[name="iva_voice_male"]');

        // Set initial values
        const voiceTypeChecked = container.querySelector(`input[name = "iva_voice_premium"][value = "${currentSettings.iva_voice_premium}"]`);
        if (voiceTypeChecked) voiceTypeChecked.checked = true;

        const voiceGenderChecked = container.querySelector(`input[name = "iva_voice_male"][value = "${currentSettings.iva_voice_male}"]`);
        if (voiceGenderChecked) voiceGenderChecked.checked = true;

        // Function to update voice type borders
        const updateVoiceTypeBorders = () => {
            container.querySelectorAll('.voice-type-option').forEach(label => {
                const radio = label.querySelector('input[type="radio"]');
                if (radio && radio.checked) {
                    label.style.borderColor = 'var(--color-primary)';
                    label.style.backgroundColor = 'rgba(37, 99, 235, 0.05)';
                } else {
                    label.style.borderColor = '#e5e7eb';
                    label.style.backgroundColor = 'transparent';
                }
            });
        };

        // Function to update gender borders
        const updateGenderBorders = () => {
            container.querySelectorAll('.voice-gender-option').forEach(label => {
                const radio = label.querySelector('input[type="radio"]');
                if (radio && radio.checked) {
                    label.style.borderColor = 'var(--color-primary)';
                    label.style.backgroundColor = 'rgba(37, 99, 235, 0.05)';
                } else {
                    label.style.borderColor = '#e5e7eb';
                    label.style.backgroundColor = 'transparent';
                }
            });
        };

        // Initial border updates
        updateVoiceTypeBorders();
        updateGenderBorders();

        // Check if Google Cloud TTS is available
        (async () => {
            try {
                const response = await fetch(`${ API_BASE_URL } /tts/status`, {
                    headers: getHeaders()
                });
                const data = await response.json();

                if (!data.available) {
                    console.warn('[IVA Settings] Google Cloud TTS not available:', data.message);

                    // Disable Standard and Premium options
                    const standardRadio = container.querySelector('input[name="iva_voice_premium"][value="1"]');
                    const premiumRadio = container.querySelector('input[name="iva_voice_premium"][value="2"]');
                    const standardLabel = standardRadio?.closest('.voice-type-option');
                    const premiumLabel = premiumRadio?.closest('.voice-type-option');

                    if (standardRadio) {
                        standardRadio.disabled = true;
                        if (standardLabel) {
                            standardLabel.style.opacity = '0.5';
                            standardLabel.style.cursor = 'not-allowed';
                            standardLabel.title = 'Google Cloud TTS não está disponível no momento';
                        }
                    }

                    if (premiumRadio) {
                        premiumRadio.disabled = true;
                        if (premiumLabel) {
                            premiumLabel.style.opacity = '0.5';
                            premiumLabel.style.cursor = 'not-allowed';
                            premiumLabel.title = 'Google Cloud TTS não está disponível no momento';
                        }
                    }

                    // If user had tier 1 or 2 selected, force fallback to tier 0 (Free)
                    if (currentSettings.iva_voice_premium >= 1) {
                        console.log('[IVA Settings] Forcing fallback to Free tier (browser voice)');
                        currentSettings.iva_voice_premium = 0;

                        const freeRadio = container.querySelector('input[name="iva_voice_premium"][value="0"]');
                        if (freeRadio) {
                            freeRadio.checked = true;
                            updateVoiceTypeBorders();
                        }

                        // Auto-save fallback
                        try {
                            await fetch(`${ API_BASE_URL }/settings`, {
method: 'PATCH',
    headers: getHeaders(),
        body: JSON.stringify({
            setting: 'iva_voice_premium',
            value: 0
        })
                            });
showToast('⚠️ Voz alterada para Gratuita (TTS não disponível)', 'warning');
                        } catch (error) {
    console.error('[IVA Settings] Failed to save fallback:', error);
}
                    }
                } else {
    console.log('[IVA Settings] Google Cloud TTS is available');
}
            } catch (error) {
    console.error('[IVA Settings] Failed to check TTS status:', error);
}
        }) ();

// Auto-save voice type
let voiceTypeSaveTimer = null;
voiceTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        const value = parseInt(radio.value); // Convert to integer
        currentSettings.iva_voice_premium = value;

        // Update visual feedback
        updateVoiceTypeBorders();

        // Clear previous timer
        if (voiceTypeSaveTimer) clearTimeout(voiceTypeSaveTimer);

        // Auto-save after 500ms
        voiceTypeSaveTimer = setTimeout(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/settings/iva_voice_premium`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({ value })
                });

                if (response.ok) {
                    originalSettings.iva_voice_premium = value;

                    // Update global variable immediately (no need to reload page!)
                    window.ivaVoicePremium = value;
                    console.log('[Settings] Auto-saved voice premium to:', value);

                    const tierNames = ['Gratuita', 'Standard', 'Premium'];
                    showToast(`✓ Tipo de voz: ${tierNames[value] || 'Desconhecido'}`, 'success');
                } else {
                    const error = await response.json();
                    showToast(error.error || 'Erro ao salvar', 'error');
                }
            } catch (error) {
                console.error('[Settings] Error saving voice premium:', error);
                showToast('Erro de conexão', 'error');
            }
        }, 500);
    });
});

//Auto-save voice gender
let voiceGenderSaveTimer = null;
voiceGenderRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        const value = parseInt(radio.value); // Convert to integer
        currentSettings.iva_voice_male = value;

        // Update visual feedback
        updateGenderBorders();

        // Clear previous timer
        if (voiceGenderSaveTimer) clearTimeout(voiceGenderSaveTimer);

        // Auto-save after 500ms
        voiceGenderSaveTimer = setTimeout(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/settings/iva_voice_male`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({ value })
                });

                if (response.ok) {
                    originalSettings.iva_voice_male = value;

                    // Update global variable immediately
                    window.ivaVoiceMale = value;
                    console.log('[Settings] Auto-saved voice male to:', value);
                    showToast(`✓ Gênero da voz: ${value === 1 ? 'Masculina' : 'Feminina'}`, 'success');
                } else {
                    const error = await response.json();
                    showToast(error.error || 'Erro ao salvar', 'error');
                }
            } catch (error) {
                console.error('[Settings] Error saving voice male:', error);
                showToast('Erro de conexão', 'error');
            }
        }, 500);
    });
});

// Helper function to calculate speech rate
const calculateSpeechRate = (value) => {
    // Linear scale: 0.5 to 1.5
    return 0.5 + (value / 100);
};

// Test voice speed button
const testVoiceBtn = container.querySelector('#test-voice-speed');
if (testVoiceBtn) {
    testVoiceBtn.addEventListener('click', () => {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        // Get current settings
        const rate = calculateSpeechRate(currentSettings.iva_voice_rate || 70);
        const isMale = currentSettings.iva_voice_male === 1;

        console.log('[Test Voice] Speaking at rate:', rate.toFixed(2), 'Gender:', isMale ? 'Male' : 'Female');

        // Get available voices
        const voices = window.speechSynthesis.getVoices();
        console.log('[Test Voice] Available voices:', voices.map(v => v.name).join(', '));

        // Known male and female voice names
        const maleNames = ['daniel', 'ricardo', 'felipe', 'carlos', 'bruno', 'paulo', 'male'];
        const femaleNames = ['maria', 'luciana', 'francisca', 'joana', 'ana', 'bruna', 'female', 'feminina'];

        let selectedVoice = null;

        // Filter pt-BR voices
        const ptBRVoices = voices.filter(v => v.lang === 'pt-BR' || v.lang.startsWith('pt'));

        if (isMale) {
            // Find male voice: check if name contains male names
            selectedVoice = ptBRVoices.find(v => {
                const lowerName = v.name.toLowerCase();
                return maleNames.some(name => lowerName.includes(name));
            });

            // If no male voice found, use first pt-BR that's NOT female
            if (!selectedVoice) {
                selectedVoice = ptBRVoices.find(v => {
                    const lowerName = v.name.toLowerCase();
                    return !femaleNames.some(name => lowerName.includes(name));
                });
            }
        } else {
            // Find female voice: check if name contains female names
            selectedVoice = ptBRVoices.find(v => {
                const lowerName = v.name.toLowerCase();
                return femaleNames.some(name => lowerName.includes(name));
            });

            // If no female voice found, explicitly avoid male voices
            if (!selectedVoice) {
                selectedVoice = ptBRVoices.find(v => {
                    const lowerName = v.name.toLowerCase();
                    return !maleNames.some(name => lowerName.includes(name));
                });
            }
        }

        // Ultimate fallback: first pt-BR voice
        if (!selectedVoice && ptBRVoices.length > 0) {
            selectedVoice = ptBRVoices[0];
        }

        const utterance = new SpeechSynthesisUtterance('A partir de agora vou falar nesta velocidade');
        utterance.rate = rate;
        utterance.lang = 'pt-BR';
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log('[Test Voice] Using voice:', selectedVoice.name);
        } else {
            console.warn('[Test Voice] No pt-BR voice found, using default');
        }

        window.speechSynthesis.speak(utterance);
    });
}

// Event listener para botão de liberação
const unlockBtn = container.querySelector('#btn-activate-unlock');
unlockBtn.addEventListener('click', activateUnlock);
    };

loadSettings();

// Create IVA tab content (placeholder for now)
const ivaTabContent = () => {
    const ivaContainer = document.createElement('div');
    ivaContainer.innerHTML = `
            <h2 style="margin-bottom: 1.5rem; color: var(--color-text-dark); font-size: 1.5rem;">
                🤖 Configurações da IA IVA
            </h2>
            <p style="color: #6b7280; margin-bottom: 2rem;">
                Personalize o comportamento e as preferências da assistente virtual IVA.
            </p>
            <div style="background: #f9fafb; padding: 2rem; border-radius: 8px; text-align: center;">
                <p style="color: #9ca3af; font-size: 0.95rem;">
                    ⚙️ Configurações avançadas da IVA em desenvolvimento...
                </p>
            </div>
        `;
    return ivaContainer;
};

// Create TabPanel - REMOVED TO FIX DOUBLE TABS
// The container already implements its own tabs (Geral / IA IVA) via renderSettings
// Wrapping it in TabPanel caused duplication and layout issues

wrapper.appendChild(container);
return wrapper;
};

