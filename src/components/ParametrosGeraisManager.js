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
                tempo_minutos_liberacao: settings.tempo_minutos_liberacao,
                eva_timeout: settings.eva_timeout || 3, // Default 3s
                eva_voice_rate: settings.eva_voice_rate || 88, // Default 88 = 2.08x speed
                eva_voice_premium: settings.eva_voice_premium || 0, // Default 0 = free
                eva_voice_male: settings.eva_voice_male || 0 // Default 0 = female
            };
            currentSettings = { ...originalSettings };

            console.log('[ParametrosGerais] Settings loaded:', {
                eva_timeout: currentSettings.eva_timeout,
                eva_voice_rate: currentSettings.eva_voice_rate,
                eva_voice_premium: currentSettings.eva_voice_premium,
                eva_voice_male: currentSettings.eva_voice_male
            });

            console.log('Original settings:', originalSettings);
            console.log('Current settings:', currentSettings);

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
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>⚙️ Parâmetros Gerais</h2>
            </div>

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
                
                <h3 style="margin-bottom: 1.5rem; color: var(--color-primary);">🤖 Configuração EVA</h3>

                <!-- Tempo Resposta EVA - SLIDER -->
                <div style="margin-bottom: 2rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-text);">
                        ⏳ Tempo de Espera (segundos)
                    </label>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="min-width: 30px; text-align: right; color: var(--color-text-muted); font-size: 0.875rem;">1s</span>
                        <div style="flex: 1; position: relative;">
                            <input 
                                type="range" 
                                id="slider-eva_timeout" 
                                min="1" 
                                max="10" 
                                value="${currentSettings.eva_timeout || 2}"
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
                        Tempo de silêncio para a EVA considerar que você terminou de falar
                    </small>
                </div>

                <!-- Voice Speed Slider -->
                <div style="margin-bottom: 2rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-text);">
                        🎤 Velocidade da Voz da EVA
                    </label>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="min-width: 40px; text-align: right; color: var(--color-text-muted); font-size: 0.875rem;">0x</span>
                        <div style="flex: 1; position: relative;">
                            <input 
                                type="range" 
                                id="slider-eva_voice_rate" 
                                min="-100" 
                                max="100" 
                                value="${currentSettings.eva_voice_rate || 0}"
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
                        Ajuste a velocidade de fala da EVA (-100% a +100% da velocidade padrão de 1.30x)
                    </small>
                </div>

                <!-- Tipo de Voz -->
                <div style="margin-bottom: 2rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 0.75rem; color: var(--color-text);">
                        🎙️ Tipo de Voz
                    </label>
                    <script>console.log('[DEBUG] Voice Type UI section is rendering!');</script>
                    
                    <!-- Free Voice Option -->
                    <div style="margin-bottom: 0.75rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; transition: all 0.2s;" class="voice-type-option">
                            <input 
                                type="radio" 
                                name="eva_voice_premium" 
                                value="0" 
                                checked
                    <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 20px 0; font-size: 1.2em; color: #333;">🎙️ Tipo de Voz</h3>
                    
                    <label class="voice-type-option" style="display: flex; align-items: center; padding: 15px; background: white; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; cursor: pointer; transition: all 0.3s;">
                        <input type="radio" name="eva_voice_premium" value="0" style="margin-right: 12px; width: 18px; height: 18px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">🆓 Voz Gratuita</div>
                            <small style="color: #666;">Sintetizador do navegador (grátis)</small>
                        </div>
                    </label>
                    
                    <label class="voice-type-option" style="display: flex; align-items: center; padding: 15px; background: white; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; cursor: pointer; transition: all 0.3s;">
                        <input type="radio" name="eva_voice_premium" value="1" style="margin-right: 12px; width: 18px; height: 18px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">📢 Voz Standard</div>
                            <small style="color: #666;">Google TTS Standard (sempre grátis - 4M chars/mês)</small>
                        </div>
                    </label>
                    
                    <label class="voice-type-option" style="display: flex; align-items: center; padding: 15px; background: white; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.3s;">
                        <input type="radio" name="eva_voice_premium" value="2" style="margin-right: 12px; width: 18px; height: 18px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">🎤 Voz Premium</div>
                            <small style="color: #666;">Google TTS Neural2 (qualidade máxima - grátis 1º ano)</small>
                        </div>
                    </label>
                </div>

                    <!-- Gender selection (for both Free and Premium) -->
                    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(37, 99, 235, 0.05); border-radius: 8px; border: 1px solid rgba(37, 99, 235, 0.2);">
                        <label style="display: block; font-weight: 500; margin-bottom: 0.75rem; color: var(--color-text); font-size: 0.95rem;">
                            👤 Gênero da Voz:
                        </label>
                        <div style="display: flex; gap: 1.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem 1rem; border: 2px solid #e5e7eb; border-radius: 6px; transition: all 0.2s; flex: 1; justify-content: center;" class="voice-gender-option">
                                <input 
                                    type="radio" 
                                    name="eva_voice_male" 
                                    value="0"
                                    checked
                                    style="cursor: pointer;"
                                />
                                <span style="font-weight: 500;">♀️ Feminina</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem 1rem; border: 2px solid #e5e7eb; border-radius: 6px; transition: all 0.2s; flex: 1; justify-content: center;" class="voice-gender-option">
                                <input 
                                    type="radio" 
                                    name="eva_voice_male" 
                                    value="1"
                                    style="cursor: pointer;"
                                />
                                <span style="font-weight: 500;">♂️ Masculina</span>
                            </label>
                        </div>
                    </div>

                    <small style="display: block; margin-top: 0.75rem; color: var(--color-text-muted); line-height: 1.5;">
                        A voz natural oferece qualidade superior e sotaque brasileiro autêntico.
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
        `;

        // Event listeners para inputs (exceto eva_timeout que agora é slider)
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

        // Event listener para timeout slider (AUTO-SAVE)
        const timeoutSlider = container.querySelector('#slider-eva_timeout');
        const timeoutDisplay = container.querySelector('#timeout-display');
        let timeoutSaveTimer = null;

        const updateTimeoutDisplay = (value) => {
            timeoutDisplay.textContent = value + 's';

            // Move display above slider position (range is now 1-10)
            const percentage = ((value - 1) / 9) * 100; // (value - min) / (max - min)
            timeoutDisplay.style.left = `${percentage}%`;
        };

        timeoutSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            currentSettings.eva_timeout = value;
            updateTimeoutDisplay(value);

            // Clear previous timer
            if (timeoutSaveTimer) {
                clearTimeout(timeoutSaveTimer);
            }

            // Auto-save after 800ms of inactivity
            timeoutSaveTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/settings/eva_timeout`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({ value })
                    });

                    if (response.ok) {
                        originalSettings.eva_timeout = value;
                        // Update global timeout immediately
                        if (window.AIConsultant && window.AIConsultant.evaTimeout !== undefined) {
                            window.AIConsultant.evaTimeout = value * 1000;
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
        updateTimeoutDisplay(currentSettings.eva_timeout || 2);

        // Event listener para voice rate slider (AUTO-SAVE)
        const voiceSlider = container.querySelector('#slider-eva_voice_rate');
        const voiceDisplay = container.querySelector('#voice-rate-display');
        let voiceSaveTimer = null;

        const updateVoiceDisplay = (value) => {
            // Formula: voice_rate = 1.30 * (1 + value/100)
            const rate = 1.30 * (1 + value / 100);
            voiceDisplay.textContent = rate.toFixed(2) + 'x';

            // Move display above slider position
            const percentage = ((value + 100) / 200) * 100;
            voiceDisplay.style.left = `${percentage}%`;
        };

        voiceSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            currentSettings.eva_voice_rate = value;
            updateVoiceDisplay(value);

            // Clear previous timer
            if (voiceSaveTimer) {
                clearTimeout(voiceSaveTimer);
            }

            // Auto-save after 800ms of inactivity
            voiceSaveTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/settings/eva_voice_rate`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({ value })
                    });

                    if (response.ok) {
                        originalSettings.eva_voice_rate = value;
                        // Update global voice rate immediately
                        window.evaVoiceRateAdjustment = value;
                        console.log('[Settings] Auto-saved voice rate to:', value);
                        showToast('✓ Velocidade da voz atualizada', 'success');
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao salvar', 'error');
                    }
                } catch (error) {
                    console.error('[Settings] Error saving voice rate:', error);
                    showToast('Erro de conexão', 'error');
                }
            }, 800);
        });

        // Initialize voice display
        updateVoiceDisplay(currentSettings.eva_voice_rate || 0);

        // Voice type selection
        const voiceTypeRadios = container.querySelectorAll('input[name="eva_voice_premium"]');
        const voiceGenderRadios = container.querySelectorAll('input[name="eva_voice_male"]');

        // Set initial values
        const voiceTypeChecked = container.querySelector(`input[name="eva_voice_premium"][value="${currentSettings.eva_voice_premium}"]`);
        if (voiceTypeChecked) voiceTypeChecked.checked = true;

        const voiceGenderChecked = container.querySelector(`input[name="eva_voice_male"][value="${currentSettings.eva_voice_male}"]`);
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
                const response = await fetch(`${API_BASE_URL}/tts/status`, {
                    headers: getHeaders()
                });
                const data = await response.json();

                if (!data.available) {
                    console.warn('[EVA Settings] Google Cloud TTS not available:', data.message);

                    // Disable Standard and Premium options
                    const standardRadio = container.querySelector('input[name="eva_voice_premium"][value="1"]');
                    const premiumRadio = container.querySelector('input[name="eva_voice_premium"][value="2"]');
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
                    if (currentSettings.eva_voice_premium >= 1) {
                        console.log('[EVA Settings] Forcing fallback to Free tier (browser voice)');
                        currentSettings.eva_voice_premium = 0;

                        const freeRadio = container.querySelector('input[name="eva_voice_premium"][value="0"]');
                        if (freeRadio) {
                            freeRadio.checked = true;
                            updateVoiceTypeBorders();
                        }

                        // Auto-save fallback
                        try {
                            await fetch(`${API_BASE_URL}/settings`, {
                                method: 'PATCH',
                                headers: getHeaders(),
                                body: JSON.stringify({
                                    setting: 'eva_voice_premium',
                                    value: 0
                                })
                            });
                            showToast('⚠️ Voz alterada para Gratuita (TTS não disponível)', 'warning');
                        } catch (error) {
                            console.error('[EVA Settings] Failed to save fallback:', error);
                        }
                    }
                } else {
                    console.log('[EVA Settings] Google Cloud TTS is available');
                }
            } catch (error) {
                console.error('[EVA Settings] Failed to check TTS status:', error);
            }
        })();

        // Auto-save voice type
        let voiceTypeSaveTimer = null;
        voiceTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const value = parseInt(radio.value); // Convert to integer
                currentSettings.eva_voice_premium = value;

                // Update visual feedback
                updateVoiceTypeBorders();

                // Clear previous timer
                if (voiceTypeSaveTimer) clearTimeout(voiceTypeSaveTimer);

                // Auto-save after 500ms
                voiceTypeSaveTimer = setTimeout(async () => {
                    try {
                        const response = await fetch(`${API_BASE_URL}/settings/eva_voice_premium`, {
                            method: 'PUT',
                            headers: getHeaders(),
                            body: JSON.stringify({ value })
                        });

                        if (response.ok) {
                            originalSettings.eva_voice_premium = value;

                            // Update global variable immediately (no need to reload page!)
                            window.evaVoicePremium = value;
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
                currentSettings.eva_voice_male = value;

                // Update visual feedback
                updateGenderBorders();

                // Clear previous timer
                if (voiceGenderSaveTimer) clearTimeout(voiceGenderSaveTimer);

                // Auto-save after 500ms
                voiceGenderSaveTimer = setTimeout(async () => {
                    try {
                        const response = await fetch(`${API_BASE_URL}/settings/eva_voice_male`, {
                            method: 'PUT',
                            headers: getHeaders(),
                            body: JSON.stringify({ value })
                        });

                        if (response.ok) {
                            originalSettings.eva_voice_male = value;

                            // Update global variable immediately
                            window.evaVoiceMale = value;
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
            return 1.30 * (1 + value / 100);
        };

        // Test voice speed button
        const testVoiceBtn = container.querySelector('#test-voice-speed');
        if (testVoiceBtn) {
            testVoiceBtn.addEventListener('click', () => {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();

                // Get current settings
                const rate = calculateSpeechRate(currentSettings.eva_voice_rate || 88);
                const isMale = currentSettings.eva_voice_male === 1;

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

    return container;
};
