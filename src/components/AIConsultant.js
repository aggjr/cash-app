import { getApiBaseUrl } from '../utils/apiConfig.js';
import { IvaActions } from '../iva/IvaActions.js';
import { IvaHighlight } from '../iva/IvaHighlight.js';
import { IvaKnowledge } from '../iva/IvaKnowledge.js';
import { IvaService } from '../iva/IvaService.js';
import { showToast } from '../utils/toast.js';
import ScreenContextExtractor from '../utils/screenContextExtractor.js';
import IvaScreenActions from '../iva/IvaScreenActions.js';
import IvaHighlighter from '../iva/IvaHighlighter.js';
import { IvaNavigationIndicator } from '../iva/IvaNavigationIndicator.js';
import { MenuNavigator } from '../iva/MenuNavigator.js';
import { IvaActionDiscovery } from '../iva/IvaActionDiscovery.js';
import { IvaActionExecutor } from '../iva/IvaActionExecutor.js';
import { IvaActionFormatter } from '../iva/IvaActionFormatter.js';
import { IvaLearning } from '../iva/IvaLearning.js';
import { IvaConversation } from '../iva/IvaConversation.js';

export const AIConsultant = () => {
    console.log('AIConsultant: Version 2.2 (Project Context Fix)');
    const API_BASE_URL = getApiBaseUrl();
    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token} `
        };
    };

    // Container
    const container = document.createElement('div');
    container.id = 'ai-consultant-wrapper';
    container.style.position = 'fixed';
    container.style.bottom = '50px';
    container.style.right = '10px';
    container.style.zIndex = '9999';
    container.style.fontFamily = 'var(--font-main, sans-serif)';

    // State
    let isOpen = false;
    let wasDismissed = false; // Track if chat was closed by AI/User dismissal
    let isListening = false;
    let pendingAction = null; // null | 'intro_ask_name' | 'intro_ask_voice' | ...
    let loanResolver = null;
    let loanContext = null;

    // Voice Recording State
    var isRecording = false;
    var IVASpeechRec = null;
    var silenceTimer = null;
    var accumulatedTranscript = '';
    var IVATimeout = 2000; // Default 2s
    var shouldRestart = false; // Flag for auto-restart

    // PREFETCH STATE (Zero Latency)
    let prefetchedGreeting = null;
    let isPrefetching = false;
    var IVASpeechRec = null;
    var silenceTimer = null;
    var accumulatedTranscript = '';
    var IVATimeout = 2000; // Default 2s
    var shouldRestart = false; // Flag for auto-restart

    // --- State Helpers ---
    const getUser = () => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch (e) {
            return null;
        }
    };

    const updateLocalUser = (updates) => {
        const user = getUser();
        if (user) {
            Object.assign(user, updates);
            localStorage.setItem('user', JSON.stringify(user));
        }
    };

    // --- MIGRATION: Force update legacy default speed (< 75) to new faster default (75) ---
    (() => {
        const u = getUser();
        // If no rate set, OR rate is the old default (50), update to 75
        if (u && (!u.IVA_voice_rate || u.IVA_voice_rate === 50)) {
            const oldSpeed = 50;
            const currentSpeed = u.IVA_voice_rate;
            console.log(`[AI Consultant] Migrating legacy voice rate (${oldSpeed}/${currentSpeed}) -> 75 (FAST)`);
            localStorage.setItem('iva_voice_rate', '75');

            // Clean headers object to avoid 400 errors
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            };

            fetch(`${API_BASE_URL}/auth/update-preference`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({ ivaVoiceRate: 75 })
            }).catch(e => console.error('Migration sync failed:', e));
        }
    })();

    // --- ZERO LATENCY PREFETCH ---
    const prefetchGreeting = async () => {
        const user = getUser();
        const hasGreetedKey = 'IVA_has_greeted_session_' + (user?.id || 'anon');
        const hasGreeted = sessionStorage.getItem(hasGreetedKey);

        // Only pre-fetch if we haven't greeted in this session yet
        // and we are not currently reading/dismissing
        if (hasGreeted) return;

        console.log('[IVA] ⚡ Prefetching greeting for Zero Latency...');
        isPrefetching = true;

        try {
            const context = {
                currentScreen: IvaKnowledge.activeScreen || 'home',
                availableScreens: {}
            };

            // Use systemAction=true so backend knows it's a silent pre-fetch check
            // BUT backend must return the greeting structure if it generates one
            const decision = await IvaService.decideOperation('IVA_AUTO_GREETING', context, true);

            if (decision && (decision.action === 'REPLY' || decision.action === 'SILENT' || decision.action === 'NAVIGATE')) {
                prefetchedGreeting = decision;
                console.log('[IVA] ⚡ Greeting ready in background.');
            }
        } catch (e) {
            console.warn('[IVA] Prefetch failed', e);
        } finally {
            isPrefetching = false;
        }
    };

    // Trigger prefetch immediately
    setTimeout(prefetchGreeting, 1000);

    // --- Voice Logic (TTS) ---
    // == TTS Function (MODIFIED TO SUPPORT VOICE TYPES & RATES) ==
    const speak = async (text) => {
        if (!window.speechSynthesis) return;

        // Check if voice is enabled and load rate adjustment
        const user = getUser();
        // Fix: Check lowercase property name from database
        if (!user?.iva_voice_enabled && user?.iva_voice_enabled !== 1) return;

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';

        // Load voice rate from user settings (IVA_voice_rate field in DB)
        // Load voice rate from user settings (IVA_voice_rate field in DB)
        const rateAdjustment = user?.IVA_voice_rate !== undefined ? user.IVA_voice_rate : 60;
        window.IVAVoiceRateAdjustment = rateAdjustment; // Update global

        // Apply voice rate: Linear scale from 0.5 to 4.0
        // 0 -> 0.5x, 50 -> 2.25x, 100 -> 4.0x
        utterance.rate = 0.5 + (rateAdjustment * 3.5 / 100);
        console.log('[IVA Voice] Rate adjustment from DB:', rateAdjustment, '-> Final rate:', utterance.rate);

        const voices = window.speechSynthesis.getVoices();

        // Get voice tier preference from settings (0=Free, 1=Standard, 2=Premium)
        const voiceTier = window.IVAVoicePremium !== undefined ? window.IVAVoicePremium : 0;
        const isMale = (window.IVAVoiceMale === 1);

        // Use Google Cloud TTS for Standard (1) and Premium (2)
        if (voiceTier >= 1) {
            try {
                // Use rate adjustment already calculated above
                const rate = utterance.rate;

                console.log(`[IVA Voice] Requesting Google TTS(Tier ${voiceTier}, ${isMale ? 'Male' : 'Female'}, Rate: ${rate.toFixed(2)})`);

                const response = await fetch(`${API_BASE_URL}/tts/synthesize`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        text,
                        isMale,
                        rate,
                        tier: voiceTier
                    })
                });

                if (response.ok) {
                    const { audioContent, voiceName, tier: tierName } = await response.json();

                    // Play audio with dynamic delay to prevent first syllable cut
                    const audio = new Audio(`data: audio / mp3; base64, ${audioContent} `);

                    // Calculate delay based on speech rate (faster = longer delay needed)
                    // Base delay: 500ms minimum (increased from 300ms), scales aggressively with rate
                    // Formula: 500ms + (500 * rate) ensures no word clipping even at 4.0x speed
                    const delayMs = Math.max(500, Math.floor(500 * rate));

                    // Wait for audio to be ready
                    audio.addEventListener('canplaythrough', () => {
                        // Delay proportional to speech rate
                        setTimeout(() => {
                            audio.play().catch(err => {
                                console.error('[IVA Voice] Play failed:', err);
                            });
                        }, delayMs);
                    }, { once: true });

                    // Clear highlights when speech ends
                    audio.addEventListener('ended', () => {
                        console.log('[IVA Voice] Speech ended, clearing highlights');
                        IvaHighlighter.clearAll();
                    }, { once: true });

                    // Start loading audio
                    audio.load();

                    console.log(`[IVA Voice] Using ${voiceName} (${tierName}), delay: ${delayMs} ms`);
                    return;
                } else {
                    const error = await response.json();
                    console.error('[IVA Voice] Google TTS failed:', error.error);
                    console.warn('[IVA Voice] Falling back to browser voice');
                }
            } catch (error) {
                console.error('[IVA Voice] Google TTS request failed:', error);
                console.warn('[IVA Voice] Falling back to browser voice');
            }
        }

        // Tier 0 or fallback: Use browser Web Speech API
        console.log('[IVA Voice] Using browser voice (Free tier or fallback)');

        const isMaleVoice = isMale;

        // Known male and female voice names
        const maleNames = ['daniel', 'ricardo', 'felipe', 'carlos', 'bruno', 'paulo', 'male'];
        const femaleNames = ['maria', 'luciana', 'francisca', 'joana', 'ana', 'bruna', 'female', 'feminina'];

        // Filter pt-BR voices
        const ptBRVoices = voices.filter(v => v.lang === 'pt-BR' || v.lang.startsWith('pt'));
        let ptVoice = null;

        if (isMaleVoice) {
            // Find male voice
            ptVoice = ptBRVoices.find(v => {
                const lowerName = v.name.toLowerCase();
                return maleNames.some(name => lowerName.includes(name));
            });

            // Fallback: avoid female voices
            if (!ptVoice) {
                ptVoice = ptBRVoices.find(v => {
                    const lowerName = v.name.toLowerCase();
                    return !femaleNames.some(name => lowerName.includes(name));
                });
            }
        } else {
            // Prioritize younger/clearer female voices: Francisca, Joana, Bruna, then Maria/Luciana
            const priorityFemaleNames = ['francisca', 'joana', 'bruna', 'ana'];
            const secondaryFemaleNames = ['maria', 'luciana'];

            // Try priority female voices first
            ptVoice = ptBRVoices.find(v => {
                const lowerName = v.name.toLowerCase();
                return priorityFemaleNames.some(name => lowerName.includes(name));
            });

            // Try secondary female voices
            if (!ptVoice) {
                ptVoice = ptBRVoices.find(v => {
                    const lowerName = v.name.toLowerCase();
                    return secondaryFemaleNames.some(name => lowerName.includes(name));
                });
            }

            // Try any female voice
            if (!ptVoice) {
                ptVoice = ptBRVoices.find(v => {
                    const lowerName = v.name.toLowerCase();
                    return femaleNames.some(name => lowerName.includes(name));
                });
            }

            // Fallback: avoid male voices
            if (!ptVoice) {
                ptVoice = ptBRVoices.find(v => {
                    const lowerName = v.name.toLowerCase();
                    return !maleNames.some(name => lowerName.includes(name));
                });
            }
        }

        // Ultimate fallback: first pt-BR voice
        if (!ptVoice && ptBRVoices.length > 0) {
            ptVoice = ptBRVoices[0];
        }

        if (ptVoice) {
            utterance.voice = ptVoice;
            console.log('[IVA Voice] Using voice:', ptVoice.name);
        } else {
            console.warn('[IVA Voice] No pt-BR voice found, using default');
        }

        // Clear highlights when speech ends
        utterance.onend = () => {
            console.log('[IVA Voice] Browser speech ended, clearing highlights');
            IvaHighlighter.clearAll();
        };

        window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }

    const messages = []; // Start empty, populate on init

    // Load IVA Settings
    const loadIVASettings = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/settings`, { headers: getHeaders() });
            if (res.ok) {
                const settings = await res.json();
                if (settings.IVA_timeout) {
                    IVATimeout = settings.IVA_timeout * 1000;
                    console.log('IVA Timeout loaded:', IVATimeout);
                }
                if (settings.IVA_voice_rate !== undefined) {
                    // Store the rate adjustment value (-100 to +100)
                    window.IVAVoiceRateAdjustment = settings.IVA_voice_rate;
                    console.log('IVA Voice Rate Adjustment loaded:', settings.IVA_voice_rate);
                }

                // Load voice gender and premium settings
                if (settings.IVA_voice_male !== undefined) {
                    window.IVAVoiceMale = settings.IVA_voice_male;
                    console.log('IVA Voice Gender loaded:', settings.IVA_voice_male === 1 ? 'Male' : 'Female');
                }

                if (settings.IVA_voice_premium !== undefined) {
                    window.IVAVoicePremium = settings.IVA_voice_premium;
                    console.log('IVA Voice Type loaded:', settings.IVA_voice_premium === 1 ? 'Premium' : 'Free');
                }
            }
        } catch (error) {
            console.error('Failed to load IVA settings:', error);
        }
    };

    // Initial load
    loadIVASettings();

    // --- Components ---

    // 1. Floating Button
    const fab = document.createElement('button');
    fab.className = 'ai-fab';
    fab.style.width = '103px';  // Increased by 10% (94 * 1.10 = 103.4, rounded to 103)
    fab.style.height = '145px';  // Taller for elliptical shape
    fab.style.borderRadius = '50% / 50%';  // Creates ellipse (horizontal / vertical)
    fab.style.border = 'none';
    fab.style.cursor = 'pointer';
    fab.style.backgroundColor = 'transparent';
    fab.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)';
    fab.style.transition = 'transform 0.2s';
    fab.style.overflow = 'hidden';
    fab.style.padding = '0';

    const img = document.createElement('img');
    img.src = '/robot_icon.png';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.transform = 'scale(1.43)'; // Image 43% larger than container (10% increase from 1.3)
    img.style.transformOrigin = 'center';

    fab.appendChild(img);

    fab.onmouseenter = () => fab.style.transform = 'scale(1.05)';
    fab.onmouseleave = () => fab.style.transform = 'scale(1)';
    fab.onclick = () => toggleChat();

    // 2. Chat Window
    const chatWindow = document.createElement('div');
    chatWindow.className = 'ai-chat-window';
    chatWindow.style.position = 'absolute';
    chatWindow.style.bottom = '158px';  // Adjusted for taller 145px icon
    chatWindow.style.right = '0';
    chatWindow.style.width = '350px';
    chatWindow.style.height = '500px';
    chatWindow.style.backgroundColor = 'white';
    chatWindow.style.borderRadius = '12px';
    chatWindow.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
    chatWindow.style.display = 'none';
    chatWindow.style.flexDirection = 'column';
    chatWindow.style.overflow = 'hidden';
    chatWindow.style.border = '1px solid #e5e7eb';
    chatWindow.style.zIndex = '10000000';

    // Header
    const header = document.createElement('div');
    header.style.backgroundColor = '#00425F';
    header.style.color = 'white';
    header.style.padding = '1rem';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';

    const headerTitle = document.createElement('div');
    headerTitle.style.display = 'flex';
    headerTitle.style.alignItems = 'center';
    headerTitle.style.gap = '0.5rem';
    headerTitle.innerHTML = `
        <div style="width: 8px; height: 8px; background-color: #10B981; border-radius: 50%;"></div>
        <span style="font-weight: 600; font-size: 1rem;">IVA - Assistente Virtual</span>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.color = 'white';
    closeBtn.style.fontSize = '1.5rem';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        wasDismissed = true; // Mark as dismissed for re-engagement
        toggleChat();
    };

    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    // Messages Area
    const messagesContainer = document.createElement('div');
    messagesContainer.style.flex = '1';
    messagesContainer.style.padding = '1rem';
    messagesContainer.style.overflowY = 'auto';
    messagesContainer.style.backgroundColor = '#f9fafb';
    messagesContainer.style.display = 'flex';
    messagesContainer.style.flexDirection = 'column';
    messagesContainer.style.gap = '1rem';

    // Input Area
    const inputArea = document.createElement('div');
    inputArea.style.padding = '1rem';
    inputArea.style.borderTop = '1px solid #e5e7eb';
    inputArea.style.backgroundColor = 'white';
    inputArea.style.display = 'flex';
    inputArea.style.gap = '0.5rem';

    const micBtn = document.createElement('button');
    micBtn.innerHTML = '🎤';
    micBtn.style.fontSize = '1.2rem';
    micBtn.style.background = 'transparent';
    micBtn.style.border = '1px solid #d1d5db';
    micBtn.style.borderRadius = '50%';
    micBtn.style.width = '36px';
    micBtn.style.height = '36px';
    micBtn.style.cursor = 'pointer';
    micBtn.style.display = 'flex';
    micBtn.style.alignItems = 'center';
    micBtn.style.justifyContent = 'center';
    micBtn.style.transition = 'all 0.3s ease';

    // Initialize Speech Recognition
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (Recognition) {
        console.log('AIConsultant: Initializing IVASpeechRec...');
        try {
            IVASpeechRec = new Recognition();
            IVASpeechRec.lang = 'pt-BR';
            IVASpeechRec.continuous = true;  // Continuous mode!
            IVASpeechRec.interimResults = true;  // Get interim results
            IVASpeechRec.maxAlternatives = 1;

            console.log('[AIConsultant] Speech recognition configured:', {
                lang: IVASpeechRec.lang,
                continuous: IVASpeechRec.continuous,
                interimResults: IVASpeechRec.interimResults
            });

            IVASpeechRec.onstart = () => {
                console.log('[SPEECH REC] onstart fired');

                // First beep: Engine is starting
                playBeep();

                // Cancel IVA's speech immediately when user starts talking
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.cancel();
                    console.log('[IVA] Speech interrupted by user');
                }

                // Show "warming up" state
                input.placeholder = 'Aquecendo microfone...';

                // Reduced warmup time from 400ms to 100ms to prevent losing user's first words
                // The first beep already provides feedback, no need for long delay
                setTimeout(() => {
                    // REMOVED second beep to avoid interfering with speech capture
                    // playBeep(); 

                    // Set recording state and update UI to READY
                    isRecording = true;
                    isListening = true;

                    // Update mic button to show recording state
                    micBtn.classList.add('mic-recording');
                    micBtn.style.backgroundColor = '#ffebe9';
                    micBtn.style.borderColor = '#ef4444';
                    micBtn.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.1)';
                    input.placeholder = `Gravando... (${IVATimeout / 1000}s silêncio para enviar)`;

                    console.log('[SPEECH REC] Mic fully warmed up and ready');
                }, 400); // 400ms warmup delay
            };

            IVASpeechRec.onend = () => {
                console.log('[SPEECH REC] onend fired! isRecording:', isRecording, 'accumulatedTranscript:', accumulatedTranscript, 'shouldRestart:', shouldRestart);

                // Auto-restart if needed (e.g. after no-speech error)
                if (shouldRestart) {
                    console.log('[SPEECH REC] Restarting recognition due to no-speech...');
                    shouldRestart = false;
                    try {
                        IVASpeechRec.start();
                        return; // Keep UI active
                    } catch (e) {
                        console.error('[SPEECH REC] Failed to restart:', e);
                    }
                }

                // FIX: If we have text (accumulated OR currently in input from interim), SEND IT!
                // We prioritize accumulated, but fallback to input.value if user spoke short phrase that didn't finalize.
                const textToSend = accumulatedTranscript.trim() || input.value.trim();

                if (textToSend) {
                    console.log('[SPEECH REC] Auto-sending on end:', textToSend);
                    input.value = textToSend;
                    sendMessage();
                    accumulatedTranscript = '';
                }

                isRecording = false;
                isListening = false;
                micBtn.classList.remove('mic-recording');
                micBtn.style.backgroundColor = 'transparent';
                micBtn.style.borderColor = '#d1d5db';
                micBtn.style.boxShadow = 'none';
                input.placeholder = 'Digite aqui...';

                // Clear silence timer
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                    silenceTimer = null;
                }

                console.log('[SPEECH REC] onend completed, recording stopped');
            };

            IVASpeechRec.onresult = (event) => {
                // Clear previous silence timer
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                }

                // Accumulate all final results
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                // Update accumulated transcript with final results
                if (finalTranscript) {
                    accumulatedTranscript += finalTranscript;
                }

                // Show accumulated + interim in input
                input.value = accumulatedTranscript + interimTranscript;

                // Trigger auto-resize for voice input
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';

                // Set 10-second silence timer
                silenceTimer = setTimeout(() => {
                    console.log('10s silence detected, stopping...');
                    if (IVASpeechRec) IVASpeechRec.stop();
                    // Cleanup handled by onend
                }, IVATimeout);  // Configurable timeout
            };

            IVASpeechRec.onerror = (event) => {
                console.error('[SPEECH REC] Error event:', event.error, 'Message:', event.message);

                // Don't stop recording for no-speech errors (normal during silence)
                if (event.error === 'no-speech') {
                    console.log('[SPEECH REC] no-speech error - flagging for restart...');
                    shouldRestart = true;
                    // stop() -> triggers onend -> checks shouldRestart -> start()
                    IVASpeechRec.stop();
                    return;
                }

                // For other errors, log and stop
                console.error('[SPEECH REC] Stopping due to error:', event.error);
                isRecording = false;
                isListening = false;
                micBtn.classList.remove('mic-recording');
                micBtn.style.backgroundColor = 'transparent';
                micBtn.style.borderColor = '#d1d5db';
                micBtn.style.boxShadow = 'none';
            };

            // Helper: Beep Sound
            const playBeep = () => {
                try {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (!AudioContext) return;
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.value = 880; // High beep
                    gain.gain.value = 0.1;
                    osc.start();
                    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15);
                    setTimeout(() => { osc.stop(); ctx.close(); }, 150);
                } catch (e) { console.error('Beep failed', e); }
            };

            // Toggle recording on click
            micBtn.onclick = () => {
                console.log('[MIC BTN] Clicked! Current state:', { isRecording, IVASpeechRec: !!IVASpeechRec });

                if (isRecording) {
                    console.log('[MIC BTN] Stopping recording...');
                    // Stop recording, onend will handle sending
                    if (IVASpeechRec) IVASpeechRec.stop();
                } else {
                    // Start recording
                    console.log('[MIC BTN] Starting recording...');
                    // playBeep(); // MOVED TO onstart to prevent clipping

                    // Visual feedback "Preparing"
                    micBtn.style.backgroundColor = '#FFF7ED'; // Orange tint
                    micBtn.style.borderColor = '#F59E0B';
                    input.placeholder = 'Iniciando microfone...';

                    try {
                        if (IVASpeechRec) {
                            IVASpeechRec.start();
                            console.log('[MIC BTN] Speech recognition started successfully');
                        } else {
                            console.error('[MIC BTN] IVASpeechRec is null!');
                        }
                    } catch (e) {
                        console.error('[MIC BTN] Error starting recognition:', e);
                        // Reset UI if failed
                        micBtn.style.backgroundColor = 'transparent';
                        micBtn.style.borderColor = '#d1d5db';
                        input.placeholder = 'Digite aqui...';
                    }
                }
            };
        } catch (e) {
            console.error('AIConsultant: Failed to initialize IVASpeechRec:', e);
        }
    } else {
        micBtn.style.display = 'none';
    }

    const input = document.createElement('textarea');
    input.placeholder = 'Digite aqui...';
    input.style.flex = '1';
    input.style.padding = '0.5rem';
    input.style.border = '1px solid #d1d5db';
    input.style.borderRadius = '6px';
    input.style.outline = 'none';
    input.style.fontSize = '0.9rem';
    input.style.resize = 'none';
    input.style.minHeight = '36px';
    input.style.maxHeight = '120px';
    input.style.overflow = 'auto';
    input.style.fontFamily = 'inherit';
    input.rows = 1;

    // Auto-resize textarea as user types
    input.oninput = () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    };

    input.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const sendBtn = document.createElement('button');
    sendBtn.innerHTML = '➤';
    sendBtn.style.background = '#00425F';
    sendBtn.style.color = 'white';
    sendBtn.style.border = 'none';
    sendBtn.style.borderRadius = '6px';
    sendBtn.style.width = '36px';
    sendBtn.style.minHeight = '36px';
    sendBtn.style.alignSelf = 'flex-end';
    sendBtn.style.cursor = 'pointer';
    sendBtn.onclick = () => sendMessage();

    inputArea.appendChild(micBtn);
    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputArea);

    container.appendChild(chatWindow);
    container.appendChild(fab);

    // --- Helper Logic ---
    const addMessage = (sender, text) => {
        messages.push({ sender, text });
        renderMessages();
    };

    const renderMessages = () => {
        messagesContainer.innerHTML = '';
        messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.style.maxWidth = '85%';
            msgDiv.style.padding = '0.8rem';
            msgDiv.style.borderRadius = '8px';
            msgDiv.style.fontSize = '0.9rem';
            msgDiv.style.lineHeight = '1.4';

            if (msg.sender === 'user') {
                msgDiv.style.alignSelf = 'flex-end';
                msgDiv.style.backgroundColor = '#00425F'; // Brand color
                msgDiv.style.color = 'white';
                msgDiv.style.borderBottomRightRadius = '0';
            } else {
                msgDiv.style.alignSelf = 'flex-start';
                msgDiv.style.backgroundColor = 'white';
                msgDiv.style.color = '#374151';
                msgDiv.style.border = '1px solid #e5e7eb';
                msgDiv.style.borderBottomLeftRadius = '0';
                msgDiv.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            }

            msgDiv.innerHTML = msg.text.replace(/\n/g, '<br>');
            messagesContainer.appendChild(msgDiv);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const savePreferences = async (updates) => {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/update-preference`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                const data = await res.json();
                updateLocalUser(data.user);
                return true;
            }
        } catch (e) {
            console.error(e);
        }
        return false;
    };

    // --- Interaction Flow ---

    const startIntroductionFlow = async () => {
        const user = getUser();
        if (!user) return;

        // Detect gender from name (simple heuristic)
        const userName = user.name || '';
        const maleEndings = ['o', 'os', 'el', 'eu', 'au'];
        const femaleEndings = ['a', 'as'];
        const lastChar = userName.toLowerCase().slice(-1);
        const lastTwoChars = userName.toLowerCase().slice(-2);

        let isMale = true; // Default
        if (femaleEndings.includes(lastChar) && !maleEndings.includes(lastTwoChars)) {
            isMale = false;
        }

        const pronoun = isMale ? 'o senhor' : 'a senhora';
        const welcomeGender = isMale ? 'bem-vindo' : 'bem-vinda';
        const called = isMale ? 'chamado' : 'chamada';

        // Suggest formal name (Sr./Sra. + Name)
        const nameParts = userName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        const suggestedName = lastName ? `${isMale ? 'Sr.' : 'Sra.'} ${firstName} ${lastName}` : `${isMale ? 'Sr.' : 'Sra.'} ${firstName}`;

        // Use LLM for introduction
        pendingAction = 'intro_llm';
        const msg = `Olá "${suggestedName}". Seja ${welcomeGender}. Eu sou a IVA, sua assistente virtual.\n\nPara que nossa interação seja mais adequada, como ${pronoun} gostaria de ser ${called}?`

        addMessage('ai', msg);
        speak(msg);
    };

    const handleIntroductionResponse = async (text) => {
        const lowerText = text.toLowerCase();

        if (pendingAction === 'intro_ask_name') {
            // Validate name (simple check)
            if (text.length < 2) {
                const msg = "Por favor, poderia repetir como prefere ser chamado?";
                addMessage('ai', msg);
                speak(msg);
                return;
            }

            // Save Name
            await savePreferences({ preferredName: text });

            // Next step: Check Voice
            pendingAction = 'intro_ask_voice';
            const msg = `Entendido, ${text}.\n\nPara facilitar nosso dia a dia, o(a) senhor(a) prefere que eu responda utilizando **áudio e texto** ou **apenas texto**?`;
            addMessage('ai', msg);
            speak(msg);

        } else if (pendingAction === 'intro_ask_voice') {
            // Interpret Intent
            let enableVoice = false;
            let understood = false;

            if (lowerText.includes('audio') || lowerText.includes('voz') || lowerText.includes('falar') || lowerText.includes('fala') || lowerText.includes('ambos')) {
                enableVoice = true;
                understood = true;
            } else if (lowerText.includes('texto') || lowerText.includes('escrita') || lowerText.includes('ler') || lowerText.includes('apenas') || lowerText.includes('somente')) {
                enableVoice = false;
                understood = true;
            }

            if (!understood) {
                const msg = "Desculpe, n├úo entendi. Prefere **├íudio** ou **somente texto**?";
                addMessage('ai', msg);
                speak(msg);
                return;
            }

            // Save Voice Preference & Mark Introduced
            await savePreferences({
                IVAVoiceEnabled: enableVoice,
                IVAIntroduced: true
            });

            pendingAction = null;
            const msg = enableVoice
                ? `Perfeito. Responderei por ├íudio sempre que poss├¡vel. \n\nAh, meu tempo de espera padr├úo ├⌐ de **${IVATimeout / 1000} segundos**, mas o senhor pode me pedir para alterar quando quiser.`
                : `Combinado. Manterei nossa comunica├º├úo apenas por texto. \n\nAh, meu tempo de espera padr├úo ├⌐ de **${IVATimeout / 1000} segundos**, mas o senhor pode me pedir para alterar quando quiser.`;

            addMessage('ai', msg);
            if (enableVoice) speak(msg);

            // Check if there's a pending loan categorization
            if (loanContext && loanResolver) {
                // Process the pending loan categorization after a brief delay
                setTimeout(() => {
                    processPendingLoanCategorization();
                }, 1500);
            } else {
                // No pending action, just offer help
                const helpMsg = "Em que posso ajudar no momento?";
                setTimeout(() => {
                    addMessage('ai', helpMsg);
                    if (enableVoice) speak(helpMsg);
                }, 1000);
            }
        }
    };

    // Process pending loan categorization after introduction
    const processPendingLoanCategorization = async () => {
        if (!loanContext || !loanResolver) return;

        try {
            const [feeRes, intRes] = await Promise.all([
                fetch(`${API_BASE_URL}/loans/suggest-category?projectId=${loanContext.projectId}&type=fees`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/loans/suggest-category?projectId=${loanContext.projectId}&type=interest`, { headers: getHeaders() })
            ]);
            const feeSugg = await feeRes.json();
            const intSugg = await intRes.json();

            loanContext.suggestions = { fees: feeSugg, interest: intSugg };

            const msg = `Detectei um contrato com taxas de **${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(loanContext.feeAmount)}**.\n\nSugiro classificar as **Tarifas** em: *"${feeSugg.name}"* e os **Juros** em: *"${intSugg.name}"*.\n\nO(a) senhor(a) concorda?`;

            addMessage('ai', msg);
            speak(msg.replace(/\*\*/g, '').replace(/\*/g, ''));
            pendingAction = 'loan_cat_confirm';

        } catch (e) {
            console.error(e);
            if (loanResolver) loanResolver(null);
            loanResolver = null;
            loanContext = null;
        }
    };

    // Helper to get suggested formal name
    const getSuggestedName = (fullName, gender) => {
        if (!fullName) return '';
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        const prefix = gender === 'F' ? 'Sra.' : 'Sr.';
        return lastName ? `${prefix} ${firstName} ${lastName}` : `${prefix} ${firstName}`;
    };

    // Handle introduction using LLM
    const handleIntroductionLLM = async (userMessage) => {
        try {
            const user = getUser();

            // Detect gender using LLM
            let detectedGender = user?.gender || 'M'; // Default to M if not set

            if (!user?.gender && user?.name) {
                try {
                    const genderResponse = await fetch(`${API_BASE_URL}/auth/detect-gender`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ name: user.name })
                    });

                    if (genderResponse.ok) {
                        const { gender } = await genderResponse.json();
                        if (gender) {
                            detectedGender = gender;
                            // Store for confirmation - DON'T auto-save yet
                            window._tempDetectedGender = detectedGender;
                            console.log('[IVA] Gender detected (awaiting user confirmation):', gender);
                        }
                    }
                } catch (error) {
                    console.error('[IVA] Gender detection failed, using default:', error);
                }
            }

            const response = await fetch(`${API_BASE_URL}/IVA/chat`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    message: userMessage,
                    conversationHistory: messages.slice(-5).map(msg => ({
                        sender: msg.sender,
                        text: msg.text
                    })),
                    context: {
                        gender: detectedGender,
                        userName: user?.name,
                        suggestedName: getSuggestedName(user?.name, detectedGender),
                        askGenderConfirmation: !user?.gender // Ask if not saved yet
                    },
                    isIntroduction: true
                })
            });

            if (!response.ok) {
                console.error('LLM introduction failed, falling back to rules');
                await handleIntroductionResponse(userMessage);
                return;
            }

            const { reply, extracted } = await response.json();

            addMessage('ai', reply);
            speak(reply);


            // Save extracted data if available

            // Handle gender confirmation first
            if (extracted && extracted.genderConfirmation) {
                let finalGender;

                if (extracted.genderConfirmation === 'CORRECT') {
                    // Use detected gender from temp storage
                    finalGender = window._tempDetectedGender || 'M';
                } else {
                    // Use corrected gender from user
                    finalGender = extracted.genderConfirmation;
                }

                // Save to database
                await fetch(`${API_BASE_URL}/auth/update-preference`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({ gender: finalGender })
                });

                // Update local user object
                const user = getUser();
                if (user) {
                    user.gender = finalGender;
                    localStorage.setItem('user', JSON.stringify(user));
                }

                console.log('[IVA] Gender confirmed and saved:', finalGender);
                delete window._tempDetectedGender;
            }

            if (extracted && extracted.preferredName) {
                await savePreferences({ preferredName: extracted.preferredName });
            }

            if (extracted && extracted.voicePreference) {
                const voiceEnabled = extracted.voicePreference === 'audio' || extracted.voicePreference === 'both';
                await savePreferences({
                    IVAVoiceEnabled: voiceEnabled ? 1 : 0
                    // Don't mark introduced yet - waiting for tour decision
                });

                // Offer tour
                const user = getUser();
                const tourMsg = `Perfeito, ${user?.preferred_name || user?.name}! 

Agora, gostaria de conhecer o sistema?

**1** - Vis├úo Geral R├ípida (2-3 minutos)
**2** - Tour Completo Guiado (10-15 minutos)  
**3** - Pular e explorar sozinho

Digite 1, 2 ou 3.`;

                addMessage('ai', tourMsg);
                speak(tourMsg.replace(/\*\*/g, ''));

                pendingAction = 'tour_offer';
            }

        } catch (error) {
            console.error('Introduction LLM Error:', error);
            // Fallback to rules-based
            await handleIntroductionResponse(userMessage);
        }
    };


    const toggleChat = async () => {
        // Unlock Audio Context immediately on user interaction
        try {
            if (window.speechSynthesis) window.speechSynthesis.resume();
            const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQQAAAAAAA==');
            silentAudio.volume = 0.01;
            silentAudio.play().catch(() => { });
        } catch (e) { console.error('Audio unlock failed', e); }

        isOpen = !isOpen;
        chatWindow.style.display = isOpen ? 'flex' : 'none';

        if (isOpen) {
            const user = getUser();
            console.log('[IVA] Chat opened. Messages:', messages.length);

            // 1. CHECK PREFETCHED GREETING (Zero Latency)
            if (prefetchedGreeting) {
                console.log('[IVA] ⚡ Using prefetched greeting!');
                const decision = prefetchedGreeting;
                prefetchedGreeting = null; // Consume it

                const hasGreetedKey = 'IVA_has_greeted_session_' + (user?.id || 'anon');
                const lastGreetingDateKey = 'IVA_last_greeting_date_' + (user?.id || 'anon');
                const today = new Date().toISOString().split('T')[0];

                // Mark session and update daily date
                sessionStorage.setItem(hasGreetedKey, 'true');
                localStorage.setItem(lastGreetingDateKey, today);

                if (decision.action === 'REPLY') {
                    addMessage('ai', decision.message);
                    speak(decision.message);
                } else if (decision.action === 'NAVIGATE') {
                    if (decision.message) {
                        addMessage('ai', decision.message);
                        speak(decision.message);
                    }
                    if (typeof MenuNavigator !== 'undefined') MenuNavigator.navigate(decision.target);
                }
                renderMessages();
                input.focus();
                return;
            }

            // Auto-greeting logic (Fallback if no prefetch)
            const hasGreetedKey = 'IVA_has_greeted_session_' + (user?.id || 'anon');
            const lastGreetingDateKey = 'IVA_last_greeting_date_' + (user?.id || 'anon');
            const hasGreeted = sessionStorage.getItem(hasGreetedKey);
            const today = new Date().toISOString().split('T')[0];
            const lastGreetingDate = localStorage.getItem(lastGreetingDateKey);

            const isFirstSessionInteraction = !hasGreeted && messages.length === 0;

            if (messages.length === 0 || wasDismissed) {
                console.log('[IVA] Chat opened - generating greeting. Dismissed:', wasDismissed);
                const isReopening = wasDismissed;
                wasDismissed = false;

                if (isFirstSessionInteraction) {
                    sessionStorage.setItem(hasGreetedKey, 'true');
                    localStorage.setItem(lastGreetingDateKey, today);
                }

                const thinkingMsg = document.createElement('div');
                thinkingMsg.className = 'thinking-bubble';
                thinkingMsg.innerText = '...';
                messagesContainer.appendChild(thinkingMsg);

                const isFirstDailyGreeting = (!lastGreetingDate || lastGreetingDate !== today);

                // ZERO DELAY - Call backend immediately
                (async () => {
                    const context = {
                        currentScreen: IvaKnowledge.activeScreen,
                        availableScreens: IvaKnowledge.screens,
                        isFirstDailyGreeting // Pass to backend
                    };

                    try {
                        // System action = true if NOT reopening (first load check)
                        // But here we ARE opening, so we want the help offer.
                        // If it's a reopen, we definitely want a prompt (false).
                        // If it's first load but prefetch failed, we still want prompt.
                        const useSystemAction = !isReopening;

                        // We forced useSystemAction to FALSE here because we are OPENING the chat, 
                        // so we demand a response now.
                        const decision = await IvaService.decideOperation('IVA_AUTO_GREETING', context, false);

                        if (thinkingMsg.parentNode) thinkingMsg.parentNode.removeChild(thinkingMsg);

                        if (decision.action === 'REPLY') {
                            addMessage('ai', decision.message);
                            speak(decision.message);
                        } else if (decision.action === 'NAVIGATE' && decision.target) {
                            if (decision.message) {
                                addMessage('ai', decision.message);
                                speak(decision.message);
                            }
                            if (typeof MenuNavigator !== 'undefined') MenuNavigator.navigate(decision.target);
                        }

                        if (decision.forceClose) {
                            wasDismissed = true;
                            if (isOpen) toggleChat();
                        }
                    } catch (e) {
                        console.error('Greeting error:', e);
                        if (thinkingMsg.parentNode) thinkingMsg.parentNode.removeChild(thinkingMsg);
                        const fallbackMsg = isFirstSessionInteraction ? 'Olá! Como posso ajudar?' : 'Pois não?';
                        addMessage('ai', fallbackMsg);
                    }
                })();
                // Removed 500ms delay

            } else {
                renderMessages();
                input.focus();
            }
        } else {
            IvaNavigationIndicator.clearAll();
        }
    };

    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        addMessage('user', text);
        input.value = '';

        // Clear navigation indicator flag on new user input
        if (window.IvaNavigationIndicator) {
            window.IvaNavigationIndicator.isEvaNavigating = false;
            if (typeof window.ivaClearAllHighlights === 'function') {
                window.ivaClearAllHighlights();
            }
        }

        // Check if we're in a pending flow (intro, loan, etc)
        if (pendingAction) {
            console.log('[IVA] Pending action active, skipping operation logic:', pendingAction);
            // Let the regular flow handle it (below in setTimeout)
            // Don't return here, let it fall through to the setTimeout logic
        } else {
            // --- PHASE 2: Operational Knowledge (LLM BASED) ---
            console.log('[IVA] No pending action, proceeding to LLM operation...');


            // 1. Gather Context
            const context = {
                currentScreen: IvaKnowledge.activeScreen,
                currentScreenData: IvaKnowledge.activeScreenData, // THE EYES: Send semantic data
                availableScreens: IvaKnowledge.screens,
                menuStructure: typeof MenuNavigator !== 'undefined'
                    ? MenuNavigator.getMenuStructure()
                    : { categories: [], flatMenu: [], totalItems: 0 },
                menuNavigationState: typeof MenuNavigator !== 'undefined'
                    ? MenuNavigator.getNavigationState()
                    : { lastSearchPosition: null, searchHistory: [], hasHistory: false }
            };

            // Add warning if MenuNavigator is not available
            if (typeof MenuNavigator === 'undefined') {
                console.error('[IVA] MenuNavigator is not available! Menu navigation will be limited.');
            }


            console.log('[IVA] Context:', {
                currentScreenId: context.currentScreen?.id || 'none',
                availableScreenCount: Object.keys(context.availableScreens || {}).length
            });

            // Extract screen context (filters + visual summary)
            let screenContext = ScreenContextExtractor.extract();
            if (screenContext) {
                console.log('[IVA] Screen Context:', screenContext);

                // Add available actions for this screen
                screenContext.availableActions = IvaScreenActions.getActionsForLLM(
                    screenContext.screenId
                );
                console.log('[IVA] Available Actions:', screenContext.availableActions);

                context.screenContext = screenContext;
            }

            // 2. Ask the Brain
            // Show thinking state if voice enabled or just to indicate processing
            const thinkingMsg = document.createElement('div');
            thinkingMsg.className = 'thinking-bubble';
            thinkingMsg.innerText = '...';
            messagesContainer.appendChild(thinkingMsg);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            try {
                const decision = await IvaService.decideOperation(text, context);

                // Remove thinking bubble
                if (thinkingMsg.parentNode) thinkingMsg.parentNode.removeChild(thinkingMsg);

                console.log('[IVA Decision]', decision);

                // Check if decision includes intent classification for autonomous loop
                if (decision.intent && ['NAVIGATION_ONLY', 'DATA_SEEKING', 'ACTION_EXECUTION'].includes(decision.intent)) {
                    console.log('[IVA] Autonomous loop triggered with intent:', decision.intent);
                    await executeAutonomousLoop(text, decision.intent);
                    return; // Loop handles everything
                }

                // Legacy action handlers (fallback if no intent classification)
                if (decision.action === 'REPLY') {
                    const msg = decision.message;
                    addMessage('ai', msg);
                    speak(msg);

                    // GENERIC USER SYNC (Fix for persistence issues)
                    if (decision.userUpdates) {
                        console.log('[IVA] Syncing user data from backend (REPLY):', decision.userUpdates);
                        updateLocalUser(decision.userUpdates);

                        if (decision.userUpdates.preferred_name) {
                            // Optional: Clear session greeting
                        }
                    }
                }
                else if (decision.action === 'START_TOUR') {
                    // LLM provides gender-aware tour offer message
                    const msg = decision.message || 'Posso mostrar um tour do sistema. Qual prefere: r├ípido ou completo?';
                    addMessage('ai', msg);
                    speak(msg.replace(/\n/g, ' '));

                    // Set pending action for tour selection
                    pendingAction = 'tour_offer';
                }
                else if (decision.action === 'SET_VOICE_RATE') {
                    // Update voice rate in DB
                    try {
                        await fetch(`${API_BASE_URL}/auth/update-preference`, {
                            method: 'PUT',
                            headers: getHeaders(),
                            body: JSON.stringify({ IVAVoiceRate: decision.value })
                        });

                        // Update local user
                        const user = getUser();
                        user.IVA_voice_rate = decision.value;
                        updateLocalUser(user);
                        window.IVAVoiceRateAdjustment = decision.value;

                        console.log('[IVA] Voice rate updated to:', decision.value);

                        // Show confirmation
                        const msg = decision.message || `Velocidade ajustada para ${decision.value}%.`;
                        addMessage('ai', msg);
                        speak(msg);
                    } catch (error) {
                        console.error('[IVA] Error updating voice rate:', error);
                        const errorMsg = 'Desculpe, n├úo consegui ajustar a velocidade.';
                        addMessage('ai', errorMsg);
                        speak(errorMsg);
                    }
                }
                else if (decision.action === 'SET_VOICE_GENDER') {
                    // Update voice gender in DB
                    try {
                        await fetch(`${API_BASE_URL}/auth/update-preference`, {
                            method: 'PUT',
                            headers: getHeaders(),
                            body: JSON.stringify({ IVAVoiceMale: decision.isMale ? 1 : 0 })
                        });

                        // Update local user
                        const user = getUser();
                        user.IVA_voice_male = decision.isMale ? 1 : 0;
                        updateLocalUser(user);
                        window.IVAVoiceMale = decision.isMale ? 1 : 0;

                        console.log('[IVA] Voice gender updated to:', decision.isMale ? 'Male' : 'Female');

                        // Show confirmation
                        const msg = decision.message || `Voz alterada para ${decision.isMale ? 'masculina' : 'feminina'}.`;
                        addMessage('ai', msg);
                        speak(msg);
                    } catch (error) {
                        console.error('[IVA] Error updating voice gender:', error);
                        const errorMsg = 'Desculpe, n├úo consegui mudar a voz.';
                        addMessage('ai', errorMsg);
                        speak(errorMsg);
                    }
                }
                else if (decision.action === 'SET_VOICE_ENABLED') {
                    // Update voice enabled in DB
                    try {
                        await fetch(`${API_BASE_URL}/auth/update-preference`, {
                            method: 'PUT',
                            headers: getHeaders(),
                            body: JSON.stringify({ IVAVoiceEnabled: decision.enabled ? 1 : 0 })
                        });

                        // Update local user
                        const user = getUser();
                        user.IVA_voice_enabled = decision.enabled ? 1 : 0;
                        updateLocalUser(user);

                        console.log('[IVA] Voice enabled:', decision.enabled);

                        // Show confirmation
                        const msg = decision.message || `├üudio ${decision.enabled ? 'ativado' : 'desativado'}.`;
                        addMessage('ai', msg);

                        // Only speak if enabling
                        if (decision.enabled) {
                            speak(msg);
                        }
                    } catch (error) {
                        console.error('[IVA] Error updating voice enabled:', error);
                        const errorMsg = 'Desculpe, n├úo consegui alterar o ├íudio.';
                        addMessage('ai', errorMsg);
                    }
                }
                else if (decision.action === 'INTERACT') {
                    // UI Interaction: Execute filter/action on current screen
                    const { interaction, followUpQuery, message } = decision;

                    console.log('[IVA INTERACT]', interaction);

                    // Show message
                    addMessage('ai', message);
                    speak(message);

                    // Execute the interaction
                    const result = await IvaScreenActions.executeAction(
                        screenContext?.screenId,
                        interaction.actionId,
                        interaction.params
                    );

                    if (!result.success) {
                        const errorMsg = `Desculpe, n├úo consegui executar essa a├º├úo: ${result.error}`;
                        addMessage('ai', errorMsg);
                        speak(errorMsg);
                        return;
                    }

                    // Wait for UI to update
                    await new Promise(r => setTimeout(r, 1000));

                    // Extract updated screen data
                    const updatedScreenContext = ScreenContextExtractor.extract();

                    // Send follow-up query to analyze updated data
                    if (followUpQuery) {
                        const analysisMsg = document.createElement('div');
                        analysisMsg.className = 'thinking-bubble';
                        analysisMsg.innerText = 'Analisando dados atualizados...';
                        messagesContainer.appendChild(analysisMsg);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;

                        try {
                            const analysisResponse = await fetch(`${API_BASE_URL}/IVA/operate`, {
                                method: 'POST',
                                headers: getHeaders(),
                                body: JSON.stringify({
                                    message: `AN├üLISE: ${followUpQuery}`,
                                    context: {
                                        ...context,
                                        screenContext: updatedScreenContext
                                    }
                                })
                            });

                            const analysisDecision = await analysisResponse.json();

                            if (analysisMsg.parentNode) analysisMsg.parentNode.removeChild(analysisMsg);

                            if (analysisDecision.action === 'REPLY') {
                                addMessage('ai', analysisDecision.message);
                                speak(analysisDecision.message);
                            }
                        } catch (error) {
                            console.error('[IVA INTERACT] Analysis error:', error);
                            if (analysisMsg.parentNode) analysisMsg.parentNode.removeChild(analysisMsg);
                        }
                    }
                }
                else if (decision.action === 'GUIDE') {
                    // Visual Guide: Navigate + Highlight elements + Explain
                    const { navigation, highlights, explanation, tips } = decision;

                    console.log('[IVA GUIDE]', decision);

                    // Show explanation
                    addMessage('ai', explanation);
                    speak(explanation);

                    // Navigate if needed
                    if (navigation && navigation.target) {
                        await IvaActions.navigate(navigation.target);
                        await new Promise(r => setTimeout(r, 1000)); // Wait for screen to load
                    }

                    // Highlight elements
                    if (highlights && highlights.length > 0) {
                        IvaHighlighter.highlightElements(highlights);

                        // Show tips if available
                        if (tips && tips.length > 0) {
                            const tipsMessage = '\n\n' + tips.join('\n');
                            addMessage('ai', tipsMessage);
                        }

                        // Auto-clear highlights on next user interaction
                        const clearHandler = () => {
                            IvaHighlighter.clearAll();
                            document.removeEventListener('click', clearHandler);
                        };
                        document.addEventListener('click', clearHandler);
                    }
                }
                else if (['NAVIGATE', 'FILL_FORM', 'CLICK_ACTION'].includes(decision.action)) {
                    const result = await IvaActions.handle(decision.action, decision);



                    if (result.success) {
                        if (decision.action === 'NAVIGATE') {
                            // Use LLM-generated message (adaptive verbosity)
                            const navigationMsg = decision.message || 'Navegando...';
                            addMessage('ai', navigationMsg);
                            speak(navigationMsg);

                            // Track navigation for familiarity learning
                            try {
                                await fetch(`${API_BASE_URL}/IVA/track-navigation`, {
                                    method: 'POST',
                                    headers: getHeaders(),
                                    body: JSON.stringify({ screen: decision.target })
                                });
                                console.log('[IVA] Navigation tracked:', decision.target);
                            } catch (trackError) {
                                console.error('[IVA] Tracking failed (non-critical):', trackError);
                            }

                            // CRITICAL: Wait for screen to load and re-extract screen context
                            // This allows subsequent INTERACT actions to work on the new screen
                            await new Promise(r => setTimeout(r, 1500)); // Wait for navigation + render

                            // Re-extract screen context for the newly loaded screen
                            const newScreenContext = ScreenContextExtractor.extract();
                            console.log('[IVA] Screen context after navigation:', newScreenContext);

                            // Update screenContext in closure so next decision uses updated context
                            screenContext = newScreenContext;

                            // Also update availableActions for new screen
                            if (screenContext && screenContext.screenId) {
                                screenContext.availableActions = IvaScreenActions.getAvailableActions(screenContext.screenId);
                                console.log('[IVA] Available actions on new screen:', screenContext.availableActions);
                            }

                            /* DISABLED FOR NOW - CAUSING RECURSION ISSUES
                            // --- AUTONOMY LOOP (The Eyes -> The Brain) ---
                            const navigationMsg = 'Cheguei. Deixe-me analisar os dados desta tela...';
                            addMessage('ai', navigationMsg);
                            speak(navigationMsg);
    
                            // Verify if it's main dashboard to avoid loop or generic analysis
                            if (decision.screen === 'dashboard') {
                                const m = 'Estou no painel principal via vis├úo geral.';
                                addMessage('ai', m);
                                speak(m);
                                return;
                            }
    
                            // Wait for screen to load and context to update (2.5s)
                            setTimeout(async () => {
                                console.log('[IVA Autonomy] Triggering post-navigation analysis...');
    
                                // Create a visual "Analyzing" indicator
                                const analyzingDiv = document.createElement('div');
                                analyzingDiv.innerHTML = '<i>≡ƒöì Analisando dados da tela...</i>';
                                analyzingDiv.style.color = '#6b7280';
                                analyzingDiv.style.marginLeft = '10px';
                                messagesContainer.appendChild(analyzingDiv);
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
                                try {
                                    // Recursive call to LLM with updated context
                                    // specific "system instruction" style message
                                    const analysisRequest = `SYSTEM_EVENT: NAVIGATION_COMPLETE to ${decision.screen}.
                                    ACTION: Analyze the 'activeScreenContext' data immediately based on the user's previous intention.
                                    Ignore "how can I help", just give the answer/analysis.`;
    
                                    // Re-uses sendMessage logic but bypassing UI input
                                    // We need to call the internal decision logic directly to avoid user bubble
    
                                    // 1. Gather NEW Context (Post-Navigation)
                                    const newContext = {
                                        currentScreen: IvaKnowledge.activeScreen,
                                        currentScreenData: IvaKnowledge.activeScreenData,
                                        availableScreens: IvaKnowledge.screens
                                    };
    
                                    const nextDecision = await IvaService.decideOperation(analysisRequest, newContext);
    
                                    if (analyzingDiv.parentNode) analyzingDiv.parentNode.removeChild(analyzingDiv);
    
                                    if (nextDecision.action === 'REPLY') {
                                        addMessage('ai', nextDecision.message);
                                        speak(nextDecision.message);
                                    } else {
                                        // Chain actions (Rare, but possible)
                                        // For now, just report the action
                                        const m = nextDecision.message || 'An├ílise conclu├¡da. O que mais deseja?';
                                        addMessage('ai', m);
                                        speak(m);
                                    }
    
                                } catch (e) {
                                    console.error('[IVA Autonomy] Error:', e);
                                    if (analyzingDiv.parentNode) analyzingDiv.parentNode.removeChild(analyzingDiv);
                                    addMessage('ai', 'N├úo consegui ler os dados da tela automaticamente. Pode me perguntar novamente?');
                                }
                            }, 2500);
                            */

                        } else {
                            // Generic Success for non-navigation
                            const followUps = ['Feito. O que mais?', 'Pronto.', 'Algo mais?'];
                            const followUp = followUps[Math.floor(Math.random() * followUps.length)];
                            const msg = (result.message || 'A├º├úo realizada.') + ' ' + followUp;
                            addMessage('ai', msg);
                            speak(msg);
                        }
                    } else {
                        const msg = result.message || 'N├úo consegui realizar a a├º├úo.';
                        addMessage('ai', msg);
                        speak(msg);
                    }
                } else {
                    console.warn('Unknown decision action:', decision.action);
                    const msg = 'N├úo entendi o que fazer.';
                    addMessage('ai', msg);
                }







                // Check for auto-close flag from backend
                if (decision.forceClose) {
                    console.log('[IVA] Auto-close requested by decision flag');
                    wasDismissed = true; // Mark as dismissed so next open triggers greeting
                    setTimeout(() => {
                        if (isOpen) toggleChat();
                    }, 3000); // 3s delay to hear the final message
                }

            } catch (err) {
                console.error('[IVA] Operation error:', err);
                if (thinkingMsg.parentNode) thinkingMsg.parentNode.removeChild(thinkingMsg);
                addMessage('ai', 'Erro ao processar comando.');
            }



            return; // Stop here, fulfilled by LLM
        }

        /* REGEX BLOCKS REMOVED - REPLACED BY LLM ABOVE */
        // DEBUG: Reset Command
        if (text === '/reset') {
            const user = getUser();
            if (user) {
                user.IVA_introduced = false;
                user.IVA_voice_enabled = null; // Reset voice pref
                user.preferred_name = null; // Reset name pref
                localStorage.setItem('user', JSON.stringify(user));
                // Also update backend if possible, but for now local is enough to trigger flow locally next reload
                // Or better, let's just trigger it now:

                addMessage('ai', 'ΓÖ╗∩╕Å Reiniciando apresenta├º├úo...');
                setTimeout(() => {
                    messages.length = 0; // Clear history
                    pendingAction = null;
                    startIntroductionFlow();
                }, 1000);
                return;
            }
        }

        // Simulate thinking (ZERO DELAY)
        const loadingDiv = document.createElement('div');
        loadingDiv.textContent = '...';
        loadingDiv.style.alignSelf = 'flex-start';
        loadingDiv.style.marginLeft = '1rem';
        loadingDiv.style.color = '#6b7280';
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        setTimeout(async () => {
            loadingDiv.remove();

            // Handle Navigation Confirmation
            if (pendingAction === 'nav_confirm') {
                const isPositive = IvaConversation.isPositiveResponse(text);
                if (isPositive) {
                    const msg = "├ôtimo! Fico feliz que encontrei o que voc├¬ procurava. O que voc├¬ gostaria de analisar ou fazer nesta tela?";
                    addMessage('ai', msg);
                    speak(msg);
                    pendingAction = null;
                    return;
                } else if (IvaConversation.isNegativeResponse(text)) {
                    const msg = "Entendi. Desculpe por n├úo ser o que voc├¬ esperava. O que voc├¬ gostaria de ver ent├úo? Posso tentar buscar de outra forma.";
                    addMessage('ai', msg);
                    speak(msg);
                    pendingAction = null;
                    return;
                }
                // If not clearly positive/negative, let LLM handle it but clear lock
                pendingAction = null;
            }

            // Handle Tour Offer
            if (pendingAction === 'tour_offer') {
                const choice = text.trim();

                if (choice.includes('1') || /vis[a├ú]o|r[a├í]pid[oa]|quick|curto|breve/i.test(text)) {
                    // Overview tour
                    addMessage('ai', '├ôtimo! Vou mostrar uma vis├úo geral r├ípida. Iniciando...');

                    // Mark as introduced before tour
                    await savePreferences({ IVAIntroduced: 1 });

                    // Import and start tour
                    const { IvaTour } = await import('../iva/IvaTour.js');
                    setTimeout(() => {
                        IvaTour.start('overview');
                    }, 2000);

                    pendingAction = null;
                    return;

                } else if (choice.includes('2') || /complet[oa]|guiad[oa]|full|detalhad[oa]|inteiro|longo/i.test(text)) {
                    // Full tour - LLM will handle gender-appropriate language
                    addMessage('ai', 'Excelente escolha! Vou gui├í-lo(a) por todo o sistema em detalhes. Vamos l├í!');

                    // Mark as introduced before tour
                    await savePreferences({ IVAIntroduced: 1 });

                    // Import and start tour
                    const { IvaTour } = await import('../iva/IvaTour.js');
                    setTimeout(() => {
                        IvaTour.start('full');
                    }, 2000);

                    pendingAction = null;
                    return;

                } else if (choice.includes('3') || /pular|n[a├ú]o|sozinho|explorar|cancelar|sair/i.test(text)) {
                    // Skip tour
                    addMessage('ai', 'Sem problemas! Fique ├á vontade para explorar. Estarei aqui caso precise de ajuda!');

                    // Mark as introduced
                    await savePreferences({ IVAIntroduced: 1 });

                    pendingAction = null;

                    // Process pending loan if exists
                    if (loanContext && loanResolver) {
                        setTimeout(() => processPendingLoanCategorization(), 2000);
                    }
                    return;

                } else {
                    // Invalid choice
                    addMessage('ai', 'N├úo entendi. Por favor, diga se prefere **R├ípido**, **Completo** ou se quer **Pular** o tour.');
                    return;
                }
            }

            // Intercept Introduction Flow
            if (pendingAction && pendingAction.startsWith('intro_')) {
                if (pendingAction === 'intro_llm') {
                    await handleIntroductionLLM(text);
                } else {
                    await handleIntroductionResponse(text);
                }
                return;
            }

            // Command: Change Timeout
            const lowerText = text.toLowerCase();
            if (lowerText.includes('mudar') && lowerText.includes('tempo') && (lowerText.includes('espera') || lowerText.includes('segundos'))) {
                // Extract number
                const match = text.match(/\d+/);
                if (match) {
                    const newSeconds = parseInt(match[0]);
                    if (newSeconds >= 3 && newSeconds <= 60) {
                        try {
                            const res = await fetch(`${API_BASE_URL}/settings/IVA_timeout`, {
                                method: 'PUT',
                                headers: getHeaders(),
                                body: JSON.stringify({ value: newSeconds })
                            });
                            if (res.ok) {
                                IVATimeout = newSeconds * 1000;
                                const msg = `Entendido. Alterei meu tempo de espera para **${newSeconds} segundos**.`;
                                addMessage('ai', msg);
                                speak(msg);
                                return;
                            }
                        } catch (e) { console.error(e); }
                    }
                }
                const msg = "Para alterar o tempo, diga algo como 'Mudar tempo de espera para 5 segundos'. (M├¡nimo 3s, M├íximo 60s)";
                addMessage('ai', msg);
                speak(msg);
                return;
            }

            // Intercept Loan Flows
            if (pendingAction && pendingAction.startsWith('loan_')) {
                if (pendingAction === 'loan_cat_confirm') {
                    const lowerText = text.toLowerCase();
                    let responseText = '';
                    if (lowerText.includes('sim') || lowerText.includes('ok') || lowerText.includes('concordo')) {
                        responseText = "Confirmado. Processando o contrato...";
                        if (loanResolver) {
                            loanResolver({
                                feeCategoryId: loanContext.suggestions.fees.id,
                                interestCategoryId: loanContext.suggestions.interest.id
                            });
                            loanResolver = null;
                            pendingAction = null;
                            setTimeout(() => { if (isOpen) toggleChat(); }, 2000);
                        }
                    } else {
                        responseText = "Entendido. Qual categoria deseja usar para as **Tarifas**?";
                        pendingAction = 'loan_cat_ask_fees';
                    }
                    addMessage('ai', responseText);
                    speak(responseText);
                } else if (pendingAction === 'loan_cat_ask_fees') {
                    loanContext.customFeeName = text;
                    const responseText = `Certo, **${text}**. E para os **Juros**?`;
                    pendingAction = 'loan_cat_ask_interest';
                    addMessage('ai', responseText);
                    speak(responseText);
                } else if (pendingAction === 'loan_cat_ask_interest') {
                    loanContext.customInterestName = text;
                    const responseText = "Registrado. Finalizando o contrato.";
                    if (loanResolver) {
                        loanResolver({
                            feeCategoryId: loanContext.suggestions.fees.id,
                            interestCategoryId: loanContext.suggestions.interest.id
                        });
                        loanResolver = null;
                        pendingAction = null;
                        setTimeout(() => { if (isOpen) toggleChat(); }, 2000);
                    }
                    addMessage('ai', responseText);
                    speak(responseText);
                }
                return;
            }

            // Old fallback chat logic removed - now handled by IvaService above
        }, 800);
    };

    // --- Autonomous Loop State ---
    const loopState = {
        active: false,
        iteration: 0,
        maxActionsPerScreen: 5, // Max actions to try on same screen
        originalQuery: '',
        currentScreen: null,
        extractedData: null,
        awaitingUserResponse: false,
        flowType: null // 'NAVIGATION_ONLY', 'DATA_SEEKING', 'ACTION_EXECUTION'
    };

    // --- Conversational Learning State (Phase 4) ---
    const learningState = {
        active: false,
        step: null, // 'SCREEN_CONFIRMATION' | 'DATA_LOCATION' | 'EXTRACTION_METHOD'
        context: null,
        awaitingResponse: false,
        attemptedActions: []
    };

    const stopAutonomousLoop = () => {
        if (loopState.active) {
            console.log('[IVA Loop] ≡ƒ¢æ STOPPING AUTONOMOUS LOOP (User control assumed)');
            loopState.active = false;
        }
    };

    /**
     * Executes autonomous loop based on user query
     */
    const executeAutonomousLoop = async (userQuery, intentType) => {
        loopState.active = true;
        loopState.originalQuery = userQuery;
        loopState.flowType = intentType;
        loopState.iteration = 0;

        console.log('========================================');
        console.log('[IVA Loop] AUTONOMOUS LOOP STARTED');
        console.log('[IVA Loop] Intent Type:', intentType);
        console.log('[IVA Loop] User Query:', userQuery);
        console.log('[IVA Loop] Timestamp:', new Date().toISOString());
        console.log('========================================');

        try {
            switch (intentType) {
                case 'NAVIGATION_ONLY':
                    await executeNavigationFlow(userQuery);
                    break;

                case 'DATA_SEEKING':
                    await executeDataSeekingFlow(userQuery);
                    break;

                case 'ACTION_EXECUTION':
                    // Assuming executeActionFlow exists elsewhere or will be added
                    // await executeActionFlow(userQuery);
                    break;

                default:
                    // Fallback to data seeking (most complete)
                    await executeDataSeekingFlow(userQuery);
            }
        } catch (error) {
            console.error('========================================');
            console.error('[IVA Loop] CRITICAL ERROR');
            console.error('[IVA Loop] Error Type:', error.name);
            console.error('[IVA Loop] Error Message:', error.message);
            console.error('[IVA Loop] Stack Trace:', error.stack);
            console.error('[IVA Loop] User Query:', userQuery);
            console.error('[IVA Loop] Intent Type:', intentType);
            console.error('[IVA Loop] Loop State:', JSON.stringify(loopState));
            console.error('========================================');
            addMessage('ai', 'Desculpe, ocorreu um erro ao processar sua solicita├º├úo.');
        } finally {
            loopState.active = false;
            // Mark navigation as finished so manual navigation can be detected correctly
            if (window.IvaNavigationIndicator) {
                window.IvaNavigationIndicator.isEvaNavigating = false;
            }
        }
    };

    /**
     * Navigation-only flow: Find and show screen
     */
    const executeNavigationFlow = async (userQuery) => {
        console.log('[IVA Navigation Flow] Starting navigation-only flow');

        // Get all menu items
        const menuStructure = MenuNavigator.getMenuStructure();
        const allScreens = menuStructure.flatMenu || [];

        console.log('[IVA Navigation Flow] Available screens:', allScreens.length);
        console.log('[IVA Navigation Flow] Screens:', allScreens.map(s => s.id || s.name).join(', '));

        // Ask LLM to find appropriate screen
        const decision = await IvaService.decideOperation(
            `PERGUNTA: "${userQuery}"
             TELAS DISPON├ìVEIS: ${JSON.stringify(allScreens)}
             
             Qual tela ├⌐ apropriada para esta pergunta?
             Retorne: { action: "NAVIGATE", target: "screen-id", message: "...", highlight: "texto para destacar" }
             Se n├úo encontrar: { action: "NO_SCREEN", message: "..." }
             Obs: 'highlight' ├⌐ opcional. Use se o usu├írio pediu item espec├¡fico (ex: "gastos do Cliente X").`,
            { menuStructure }
        );

        if (decision.action === 'NO_SCREEN') {
            console.log('[IVA Navigation Flow] No appropriate screen found');
            console.log('[IVA Navigation Flow] LLM Response:', JSON.stringify(decision));
            addMessage('ai', decision.message || 'Desculpe, n├úo encontrei uma tela apropriada para isso.');
            loopState.active = false;
            return;
        }

        if (!loopState.active) {
            console.log('[IVA Navigation Flow] 🛑 Loop cancelled before navigation.');
            return;
        }

        // Navigate
        console.log('[IVA Navigation Flow] Navigating to screen:', decision.target, '+ Highlight:', decision.highlight);
        await IvaActions.navigate(decision.target, decision.highlight);
        console.log('[IVA Navigation Flow] Navigation complete, waiting for render...');
        await new Promise(r => setTimeout(r, 1500));
        console.log('[IVA Navigation Flow] Render complete');

        // CONVERSATIONAL CONFIRMATION
        const screenName = IvaConversation.getScreenName(decision.target);
        const confirmMsg = IvaConversation.getNavigationConfirmation(screenName);
        addMessage('ai', confirmMsg);
        speak(confirmMsg);

        pendingAction = 'nav_confirm';

        // RECORD LEARNING
        await IvaLearning.recordMenuKnowledge(
            userQuery,
            decision.target,
            getMenuPath(decision.target),
            true
        );

        // Wait for user confirmation
        loopState.awaitingConfirmation = true;
        loopState.confirmedScreen = decision.target;
        loopState.awaitingUserResponse = true;
        loopState.active = false;
    };

    /**
     * Get menu path from screen ID
     */
    const getMenuPath = (screenId) => {
        return screenId; // Simple implementation for now
    };

    /**
     * Data-seeking flow: Navigate, extract, filter, present
     */
    const executeDataSeekingFlow = async (userQuery) => {
        console.log('[IVA Data Flow] Starting autonomous data-seeking loop');
        // Get all screens and rank by relevance
        const menuStructure = MenuNavigator.getMenuStructure();
        const allScreens = menuStructure.flatMenu || [];
        console.log('[IVA Data Flow] Max screens to try:', allScreens.length);
        console.log('[IVA Data Flow] Iteration:', loopState.iteration);

        // SAFETY: Max global iterations (reduced to prevent loops)
        if (loopState.iteration >= 5) {
            console.log('[IVA Data Flow] Γ¥î Max global iterations reached (5)');
            const failMsg = 'Desculpe, tentei em v├írias telas mas n├úo consegui encontrar essa informa├º├úo. Poderia reformular sua pergunta ou me dizer em qual tela espec├¡fica voc├¬ quer que eu procure?';
            addMessage('ai', failMsg);
            speak(failMsg);
            loopState.active = false;
            loopState.awaitingUserResponse = true;
            return;
        }

        loopState.iteration++;

        console.log('[IVA Data Flow] Total screens available:', allScreens.length);

        const rankingDecision = await IvaService.decideOperation(
            `PERGUNTA: "${userQuery}"
             TELAS DISPON├ìVEIS: ${JSON.stringify(allScreens)}
             
             Ranqueie TODAS as telas por relev├óncia (0-1).
             Retorne: { screens: [{ id: "...", relevance: 0.95 }, ...] }`,
            { menuStructure }
        );

        const rankedScreens = (rankingDecision.screens || [])
            .sort((a, b) => b.relevance - a.relevance)
            .filter(s => s.relevance >= 0.3); // Only try screens with >30% relevance

        console.log('[IVA Data Flow] ========== SCREEN RANKING ==========');
        console.log('[IVA Data Flow] Screens ranked:', rankedScreens.length);
        rankedScreens.forEach((s, i) => {
            console.log(`[IVA Data Flow] ${i + 1}. ${s.id} - Relevance: ${(s.relevance * 100).toFixed(1)}%`);
        });
        console.log('[IVA Data Flow] ====================================');

        // Try screens by relevance (interactive approach)
        // IVA will try the most relevant screen first, then ask user before trying next
        console.log(`[IVA Data Flow] Found ${rankedScreens.length} relevant screens (>30% relevance)`);

        for (const screen of rankedScreens) {
            if (!loopState.active) {
                console.log('[IVA Data Flow] ≡ƒ¢æ Loop cancelled, stopping search.');
                return;
            }
            console.log('----------------------------------------');
            console.log(`[IVA Data Flow] Attempting screen ${rankedScreens.indexOf(screen) + 1}/${rankedScreens.length}`);
            console.log(`[IVA Data Flow] Screen ID: ${screen.id}`);
            console.log(`[IVA Data Flow] Relevance: ${(screen.relevance * 100).toFixed(1)}%`);

            await IvaActions.navigate(screen.id);
            console.log(`[IVA Data Flow] Navigation to ${screen.id} complete`);
            await new Promise(r => setTimeout(r, 1500));
            console.log(`[IVA Data Flow] Screen ${screen.id} rendered`);

            loopState.currentScreen = screen.id;

            // Try to extract data or execute actions
            const result = await tryExtractOrAct(userQuery, screen.id);

            if (result.success) {
                console.log(`[IVA Data Flow] Γ£à SUCCESS on screen: ${screen.id}`);
                console.log(`[IVA Data Flow] Result type: ${result.type}`);

                // RECORD LEARNING
                await IvaLearning.recordMenuKnowledge(
                    userQuery,
                    screen.id,
                    getMenuPath(screen.id),
                    true
                );

                loopState.active = false;
                return;
            }

            // No data/actions on this screen, try next
            console.log(`[IVA Data Flow] Γ¥î No data/actions on ${screen.id}`);
            console.log(`[IVA Data Flow] Reason: ${result.reason}`);
            console.log(`[IVA Data Flow] Moving to next screen...`);
        }

        // Exhausted all screens
        console.log('[IVA Data Flow] ========== SEARCH EXHAUSTED ==========');
        console.log('[IVA Data Flow] Searched screens:', rankedScreens.length);
        console.log('[IVA Data Flow] No data found in any screen');
        console.log('[IVA Data Flow] ======================================');
        addMessage('ai', 'Pesquisei em todas as telas relevantes mas n├úo encontrei o que voc├¬ precisa. Pode reformular a pergunta?');
        loopState.active = false;
    };

    /**
     * Try to extract data or execute actions on current screen
     */
    const tryExtractOrAct = async (userQuery, screenId) => {
        console.log(`[IVA Extract/Act] ========== SCREEN: ${screenId} ==========`);
        console.log(`[IVA Extract/Act] Max actions per screen: ${loopState.maxActionsPerScreen}`);

        let actionIterations = 0;

        while (actionIterations < loopState.maxActionsPerScreen) {
            if (!loopState.active) {
                console.log('[IVA Extract/Act] ≡ƒ¢æ Loop cancelled, stopping action extraction.');
                return { success: false, reason: 'CANCELLED' };
            }
            console.log(`[IVA Extract/Act] --- Iteration ${actionIterations + 1}/${loopState.maxActionsPerScreen} ---`);

            // Extract screen data
            const screenContext = ScreenContextExtractor.extract();
            loopState.extractedData = screenContext;

            console.log(`[IVA Extract/Act] Screen context extracted:`, {
                screenId: screenContext?.screenId,
                hasVisibleData: !!screenContext?.visibleData,
                dataKeys: screenContext?.visibleData ? Object.keys(screenContext.visibleData) : []
            });

            // Ask LLM if data answers question
            const dataDecision = await IvaService.decideOperation(
                `PERGUNTA ORIGINAL: "${userQuery}"
                 DADOS VISÍVEIS: ${JSON.stringify(screenContext.visibleData)}
                 
                 Esses dados respondem completamente a pergunta?
                 Se SIM: { hasData: true, message: "resposta formatada", highlight: "texto exato encontrada" }
                 Se NÃO: { hasData: false, reason: "..." }
                 Obs: 'highlight' deve ser o texto curto e único que aparece na tela (ex: "R$ 1.200,00").`,
                { screenContext }
            );

            if (dataDecision.hasData) {
                // SUCCESS! Found data
                console.log(`[IVA Extract/Act] ✅ DATA FOUND!`);
                console.log(`[IVA Extract/Act] LLM confirmed data answers question`);

                // AUTO-LEARNING TRIGGER
                if (dataDecision.hasData && dataDecision.message && dataDecision.message.length > 5) {
                    (async () => {
                        try {
                            /*
                            // Infer if it's personal data
                            const isPersonal = /(meu|minha|eu|sou)/i.test(userQuery);
                            const scope = isPersonal ? 'USER' : 'SYSTEM';
                            
                            // Send to Learning API
                            console.log('[IVA Learning] 🎓 Auto-memorizing found data...');
                            await fetch(`${API_BASE_URL}/IVA/learn`, {
                                method: 'POST',
                                headers: getHeaders(),
                                body: JSON.stringify({
                                    type: 'custom_rules', // Use custom_rules for Qdrant Injection
                                    data: {
                                        description: `Quando perguntado sobre "${userQuery}", a resposta encontrada na tela ${screenId} foi: ${dataDecision.message}`,
                                        keywords: IvaLearning.extractKeywords(userQuery),
                                        context: screenId
                                    },
                                    context: {
                                        scope: scope,
                                        projectId: IvaKnowledge.currentProjectId || 0
                                    }
                                })
                            });
                            */
                            // Use existing recordDataKnowledge but with enhanced description for rule generation?
                            // Or just stick to the plan: use explicit custom_rules injection here as shown above?
                            // User requested "ensure data is recorded in memory".
                            // The existing IvaLearning.recordDataKnowledge records to 'data_structures', which might not be picked up by the 'custom_rules' retrieval in Qdrant Context Builder.
                            // I should explicitly inject a 'custom_rule' here as conceived in the plan.

                            const isPersonal = /(meu|minha|eu|sou)/i.test(userQuery);
                            const scope = isPersonal ? 'USER' : 'SYSTEM';
                            const projectId = typeof IvaKnowledge !== 'undefined' ? IvaKnowledge.currentProjectId : ((getUser() || {}).last_project_id || 0);

                            console.log('[IVA Learning] 🎓 Auto-memorizing found data as Rule...');
                            await fetch(`${API_BASE_URL}/IVA/learn`, {
                                method: 'POST',
                                headers: getHeaders(),
                                body: JSON.stringify({
                                    type: 'custom_rules',
                                    data: {
                                        description: `Para a pergunta "${userQuery}", a resposta é: ${dataDecision.message}`,
                                        keywords: IvaLearning.extractKeywords(userQuery),
                                        context: screenId
                                    },
                                    context: {
                                        scope: scope,
                                        projectId: projectId,
                                        userId: (getUser() || {}).id
                                    }
                                })
                            });
                        } catch (err) {
                            console.error('[IVA Learning] Auto-learn failed:', err);
                        }
                    })();
                }
                console.log(`[IVA Extract/Act] Response length: ${dataDecision.message?.length} chars`);

                addMessage('ai', dataDecision.message);
                speak(dataDecision.message);

                if (dataDecision.highlight) {
                    console.log(`[IVA Extract/Act] Highlighting data: ${dataDecision.highlight}`);
                    IvaHighlight.highlightText(dataDecision.highlight, { duration: 5000, pulse: true });
                }

                addMessage('ai', 'Isso responde sua pergunta?');
                pendingAction = 'nav_confirm';
                loopState.awaitingUserResponse = true;

                // RECORD DATA LEARNING
                await IvaLearning.recordDataKnowledge(
                    userQuery,
                    screenId,
                    'visibleData',
                    'extracted',
                    true
                );

                return { success: true, type: 'DATA_FOUND' };
            }

            console.log(`[IVA Extract/Act] Γ¥î No data found, reason: ${dataDecision.reason || 'not specified'}`);
            console.log(`[IVA Extract/Act] Discovering available actions...`);

            // No data, discover actions
            const discoveredActions = IvaActionDiscovery.discoverAllActions();

            console.log(`[IVA Extract/Act] Actions discovered: ${discoveredActions.length}`);
            if (discoveredActions.length > 0) {
                console.log(`[IVA Extract/Act] Action types:`,
                    discoveredActions.reduce((acc, a) => {
                        acc[a.type] = (acc[a.type] || 0) + 1;
                        return acc;
                    }, {})
                );
            }

            if (discoveredActions.length === 0) {
                console.log(`[IVA Extract/Act] ΓÜá∩╕Å No actions available on this screen`);
                return { success: false, reason: 'NO_ACTIONS' };
            }

            // Ask LLM which action to execute
            const actionsForLLM = IvaActionFormatter.formatForLLM(discoveredActions);

            const actionDecision = await IvaService.decideOperation(
                `PERGUNTA: "${userQuery}"
                 A├ç├òES DISPON├ìVEIS: ${JSON.stringify(actionsForLLM)}
                 
                 Qual a├º├úo pode trazer os dados necess├írios?
                 Se encontrou: { action: "EXECUTE", actionId: "...", params: {...}, message: "..." }
                 Se n├úo encontrou: { action: "NO_SUITABLE_ACTION" }`,
                { discoveredActions: actionsForLLM }
            );


            if (actionDecision.action === 'NO_SUITABLE_ACTION') {
                console.log(`[IVA Extract/Act] ΓÜá∩╕Å LLM found no suitable action`);

                // PHASE 4: Enter Conversational Learning Mode
                if (!learningState.active) {
                    console.log('[IVA Learning] ≡ƒÄô Entering conversational learning mode');

                    learningState.active = true;
                    learningState.step = 'DATA_LOCATION';
                    learningState.context = {
                        query: userQuery,
                        screen: screenId,
                        attemptedActions: discoveredActions.map(a => ({
                            id: a.id,
                            type: a.type,
                            label: a.label
                        }))
                    };
                    learningState.awaitingResponse = true;

                    // Stop autonomous loop
                    loopState.active = false;

                    // Ask user for guidance
                    // Ask user for guidance
                    const question = `Estou na tela "${screenId}" procurando por "${userQuery}", mas não encontrei uma ação adequada.
                    
Você pode me ajudar? Onde exatamente está essa informação?

Por exemplo:
• "Na tabela, coluna X, linha Y"
• "No card de resumo no topo"
• "Precisa aplicar filtro primeiro"`;

                    addMessage('ai', question);
                    speak(question);

                    return { success: false, reason: 'LEARNING_MODE_ACTIVATED' };
                }

                return { success: false, reason: 'NO_SUITABLE_ACTION' };
            }

            // Execute action
            actionIterations++;
            console.log(`[IVA Extract/Act] ≡ƒÄ» Executing action: ${actionDecision.actionId}`);
            console.log(`[IVA Extract/Act] Action params:`, actionDecision.params);

            const actionToExecute = discoveredActions.find(a => a.id === actionDecision.actionId);

            if (!actionToExecute) {
                console.error(`[IVA Extract/Act] Γ¥î Action not found in discovered actions: ${actionDecision.actionId}`);
                console.error(`[IVA Extract/Act] Available actions:`, discoveredActions.map(a => a.id));
                continue;
            }

            console.log(`[IVA Extract/Act] Action details:`, {
                id: actionToExecute.id,
                type: actionToExecute.type,
                label: actionToExecute.label
            });

            addMessage('ai', actionDecision.message || 'Executando a├º├úo...');

            const result = await IvaActionExecutor.executeAction(actionToExecute, actionDecision.params);

            if (!result.success) {
                console.error(`[IVA Extract/Act] Γ¥î Action execution failed: ${result.error}`);
                continue;
            }

            console.log(`[IVA Extract/Act] Γ£à Action executed successfully`);
            console.log(`[IVA Extract/Act] Waiting for UI update...`);

            // RECORD ACTION LEARNING
            await IvaLearning.recordActionKnowledge(
                userQuery,
                screenId,
                actionToExecute,
                true
            );

            // Wait for UI to update
            await new Promise(r => setTimeout(r, 1000));

            console.log(`[IVA Extract/Act] UI updated, re-extracting data...`);

            // Loop continues to extract data again
        }

        // Max actions reached
        console.log(`[IVA Extract/Act] ΓÜá∩╕Å Max actions (${loopState.maxActionsPerScreen}) reached`);
        return { success: false, reason: 'MAX_ACTIONS_REACHED' };
    };

    /**
     * Action execution flow: Navigate and execute specific action
     */
    const executeActionFlow = async (userQuery) => {
        console.log('[IVA Action Flow] Starting action execution flow');
        console.log('[IVA Action Flow] Objective:', userQuery);

        // Find appropriate screen
        const menuStructure = MenuNavigator.getMenuStructure();

        console.log('[IVA Action Flow] Finding appropriate screen...');

        const navDecision = await IvaService.decideOperation(
            `OBJETIVO: ${userQuery}
             TELAS DISPON├ìVEIS: ${JSON.stringify(menuStructure.flatMenu)}
             
             Qual tela permite executar esta a├º├úo?
             Retorne: { action: "NAVIGATE", target: "screen-id" }`,
            { menuStructure }
        );

        if (!loopState.active) {
            console.log('[IVA Action Flow] ≡ƒ¢æ Loop cancelled before navigation.');
            return;
        }

        await IvaActions.navigate(navDecision.target);
        await new Promise(r => setTimeout(r, 1500));

        // Discover actions
        const discoveredActions = IvaActionDiscovery.discoverAllActions();
        const actionsForLLM = IvaActionFormatter.formatForLLM(discoveredActions);

        // Ask LLM which action to execute
        const actionDecision = await IvaService.decideOperation(
            `OBJETIVO: ${userQuery}
             A├ç├òES DISPON├ìVEIS: ${JSON.stringify(actionsForLLM)}
             
             Qual a├º├úo executar?
             Retorne: { action: "EXECUTE", actionId: "...", params: {...} }`,
            { discoveredActions: actionsForLLM }
        );

        if (!loopState.active) {
            console.log('[IVA Action Flow] ≡ƒ¢æ Loop cancelled before action execution.');
            return;
        }

        if (actionDecision.action !== 'EXECUTE') {
            addMessage('ai', 'Desculpe, n├úo encontrei uma a├º├úo apropriada para isso.');
            loopState.active = false;
            return;
        }

        // Execute action
        const actionToExecute = discoveredActions.find(a => a.id === actionDecision.actionId);
        const result = await IvaActionExecutor.executeAction(actionToExecute, actionDecision.params);

        if (result.success) {
            addMessage('ai', result.message || 'A├º├úo executada com sucesso!');
            speak('A├º├úo executada com sucesso!');
        } else {
            addMessage('ai', `Erro ao executar a├º├úo: ${result.error}`);
        }

        loopState.active = false;
    };

    // --- Semantic Screen Reading "The Eyes" ---
    const updateScreenContext = (contextData) => {
        // Store in global knowledge
        IvaKnowledge.activeScreenData = contextData;
        console.log('[IVA Vision] Screen Context Updated:', contextData);
    };

    // Public API
    const startLoanCategorization = async (data) => {
        return new Promise(async (resolve) => {
            const user = getUser();

            // Check if user has completed introduction
            if (!user?.IVA_introduced) {
                // Store the loan data and resolver for after introduction
                loanResolver = resolve;
                loanContext = data;

                // Start introduction flow if chat is not open
                if (!isOpen) {
                    toggleChat();
                }

                // The introduction flow will call processPendingLoanCategorization when done
                return;
            }

            // User already introduced, proceed directly
            loanResolver = resolve;
            loanContext = data;

            if (!isOpen) toggleChat();

            // Fetch Suggestions
            try {
                const [feeRes, intRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/loans/suggest-category?projectId=${data.projectId}&type=fees`, { headers: getHeaders() }),
                    fetch(`${API_BASE_URL}/loans/suggest-category?projectId=${data.projectId}&type=interest`, { headers: getHeaders() })
                ]);
                const feeSugg = await feeRes.json();
                const intSugg = await intRes.json();

                loanContext.suggestions = { fees: feeSugg, interest: intSugg };

                const msg = `Detectei um contrato com taxas de **${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.feeAmount)}**.\n\nSugiro classificar as **Tarifas** em: *"${feeSugg.name}"* e os **Juros** em: *"${intSugg.name}"*.\n\nO(a) senhor(a) concorda?`;

                addMessage('ai', msg);
                speak(msg.replace(/\*\*/g, '').replace(/\*/g, ''));
                pendingAction = 'loan_cat_confirm';

            } catch (e) {
                console.error(e);
                resolve(null);
            }
        });
    };

    window.IVA = {
        startLoanCategorization,
        updateScreenContext // Exposed for screens to broadcast data
    };

    window.IVAConsultant = {
        addMessage,
        speak,
        toggleChat,
        isOpen: () => isOpen,
        stopAutonomousLoop
    };

    // Alias for backward compatibility during transition from EVA to IVA
    window.EVA = window.IVA;
    window.FOCCUS = window.IVA;

    return container;
};

