/**
 * EVA Guided Tour System
 * Automatically navigates through system screens with narration and highlights
 */

import { EvaNavigationIndicator } from './EvaNavigationIndicator.js';
import { EvaActions } from './EvaActions.js';

export const EvaTour = {
    currentStep: 0,
    isActive: false,
    steps: [],
    isPaused: false,
    sharedTablePresented: false, // Track if SharedTable was already presented

    /**
     * Start tour
     * @param {string} mode - 'overview' for quick 2min tour, 'full' for complete 10-15min tour
     */
    async start(mode = 'full') {
        console.log('[EVA Tour] Starting tour:', mode);
        this.isActive = true;
        this.currentStep = 0;
        this.isPaused = false;
        this.sharedTablePresented = false; // Reset for new tour

        // Load appropriate tour script
        if (mode === 'overview') {
            const { TOUR_OVERVIEW } = await import('./tour-scripts.js');
            this.steps = TOUR_OVERVIEW;
        } else {
            const { TOUR_FULL } = await import('./tour-scripts.js');
            this.steps = TOUR_FULL;
        }

        // Show tour controls
        this.showControls();

        // Ensure EVA Chat is valid and open for narration text
        if (window.EVAConsultant) {
            if (window.EVAConsultant.isOpen && !window.EVAConsultant.isOpen()) {
                window.EVAConsultant.toggleChat();
            }
        }

        // Start first step
        await this.executeStep(0);
    },

    /**
     * Execute a single tour step
     */
    async executeStep(index) {
        if (!this.isActive || this.isPaused) return;
        if (index >= this.steps.length) {
            this.finish();
            return;
        }

        const step = this.steps[index];

        // Skip SharedTable intro if already presented
        if (step.isSharedTableIntro && this.sharedTablePresented) {
            console.log('[EVA Tour] SharedTable already presented, skipping...');
            this.currentStep = index + 1;
            await this.executeStep(this.currentStep);
            return;
        }

        // Mark SharedTable as presented if this is the intro step
        if (step.isSharedTableIntro) {
            this.sharedTablePresented = true;
        }

        console.log(`[EVA Tour] Step ${index + 1}/${this.steps.length}:`, step.title);

        try {
            // 1. Clear previous highlights
            EvaNavigationIndicator.clearAll();

            // 2. Navigate to screen
            if (step.screenId) {
                EvaActions.handle('NAVIGATE', { target: step.screenId });
            }

            // 3. Wait for navigation to complete
            await this.wait(1200);

            // 4. Add navigation indicators (arrows + highlights)
            if (step.screenId) {
                EvaNavigationIndicator.markNavigationPath(step.screenId);
            }

            // 5. Highlight specific elements
            if (step.highlights) {
                await this.wait(500); // Wait a bit for page to stabilize
                step.highlights.forEach(h => {
                    const el = document.querySelector(h.selector);
                    if (el) {
                        EvaNavigationIndicator.addBorderHighlight(el);
                        if (h.addArrow) {
                            EvaNavigationIndicator.addArrowIndicator(el);
                        }
                        console.log('[EVA Tour] Highlighted:', h.selector);
                    } else {
                        console.warn('[EVA Tour] Element not found:', h.selector);
                    }
                });
            }

            // 5.5. Execute interactive actions (NEW!)
            if (step.actions && Array.isArray(step.actions)) {
                for (const action of step.actions) {
                    await this.wait(action.delay || 1000);

                    if (action.type === 'click') {
                        const el = document.querySelector(action.selector);
                        if (el) {
                            console.log('[EVA Tour] Clicking:', action.selector);
                            el.click();

                            // Wait for modal/dropdown to appear
                            if (action.waitAfter) {
                                await this.wait(action.waitAfter);
                            }
                        } else {
                            console.warn('[EVA Tour] Action element not found:', action.selector);
                        }
                    } else if (action.type === 'close') {
                        // Close any open modals/overlays
                        const closeBtn = document.querySelector(action.selector);
                        if (closeBtn) {
                            console.log('[EVA Tour] Closing:', action.selector);
                            closeBtn.click();
                        } else {
                            // Try ESC key
                            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                        }

                        if (action.waitAfter) {
                            await this.wait(action.waitAfter);
                        }
                    }
                }
            }

            // 6. EVA narration WITH SYNCHRONIZATION
            if (window.EVAConsultant) {
                window.EVAConsultant.addMessage?.('ai', step.narration);

                // Wait for speech to complete
                await this.speakAndWait(step.narration);
            }

            // 7. Update progress
            this.updateProgress(index + 1, this.steps.length);

            // 8. Wait additional duration if specified (for user to read/observe)
            const additionalWait = step.duration || 2000; // Reduced default from 6000 to 2000
            await this.wait(additionalWait);

            // 9. Next step
            if (this.isActive && !this.isPaused) {
                this.currentStep = index + 1;
                await this.executeStep(this.currentStep);
            }

        } catch (error) {
            console.error('[EVA Tour] Error in step:', error);
            // Continue to next step despite error
            setTimeout(() => this.executeStep(index + 1), 2000);
        }
    },

    /**
     * Pause tour
     */
    pause() {
        this.isPaused = true;
        if (window.speechSynthesis) {
            window.speechSynthesis.pause();
        }
        console.log('[EVA Tour] Paused');
    },

    /**
     * Resume tour
     */
    resume() {
        this.isPaused = false;
        if (window.speechSynthesis) {
            window.speechSynthesis.resume();
        }
        console.log('[EVA Tour] Resumed');
        this.executeStep(this.currentStep);
    },

    /**
     * Skip current step
     */
    skip() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        this.executeStep(this.currentStep + 1);
    },

    /**
     * Finish tour
     */
    async finish() {
        console.log('[EVA Tour] Finishing tour');
        this.isActive = false;
        this.isPaused = false;

        // Clear all highlights
        EvaNavigationIndicator.clearAll();

        // Hide controls
        this.hideControls();

        // Mark user as introduced
        if (window.EVAConsultant) {
            try {
                const token = localStorage.getItem('token');
                await fetch(`${window.API_BASE_URL}/auth/update-preference`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ evaIntroduced: 1 })
                });

                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.eva_introduced = 1;
                localStorage.setItem('user', JSON.stringify(user));

            } catch (error) {
                console.error('[EVA Tour] Error marking introduced:', error);
            }
        }

        // Final message
        const msg = '🎉 Tour concluído! Agora você conhece todas as funcionalidades do CASH. Estarei sempre aqui para ajudar!';
        if (window.EVAConsultant) {
            window.EVAConsultant.addMessage?.('ai', msg);
            // Remove emojis for speech
            const msgForSpeech = msg.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
            window.EVAConsultant.speak?.(msgForSpeech);
        }
    },

    /**
     * Show tour controls UI
     */
    showControls() {
        let controls = document.getElementById('eva-tour-controls');
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'eva-tour-controls';
            controls.innerHTML = `
                <div class="eva-tour-progress">
                    <div class="progress-bar"></div>
                    <span class="progress-text">Etapa 0 de 0</span>
                </div>
                <div class="tour-buttons">
                    <button onclick="window.EvaTour.pause()" class="btn-pause">⏸️ Pausar</button>
                    <button onclick="window.EvaTour.resume()" class="btn-resume" style="display:none;">▶️ Continuar</button>
                    <button onclick="window.EvaTour.skip()" class="btn-skip">⏭️ Pular</button>
                    <button onclick="window.EvaTour.finish()" class="btn-exit">❌ Sair</button>
                </div>
            `;
            controls.style.cssText = `
                position: fixed;
                bottom: 120px;
                right: 20px;
                background: white;
                padding: 1rem;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 9999999;
                min-width: 280px;
            `;
            document.body.appendChild(controls);

            // Add CSS for controls
            if (!document.getElementById('eva-tour-styles')) {
                const style = document.createElement('style');
                style.id = 'eva-tour-styles';
                style.textContent = `
                    .eva-tour-progress {
                        margin-bottom: 1rem;
                    }
                    .eva-tour-progress .progress-bar {
                        height: 8px;
                        background: #e5e7eb;
                        border-radius: 4px;
                        overflow: hidden;
                        margin-bottom: 0.5rem;
                    }
                    .eva-tour-progress .progress-bar::after {
                        content: '';
                        display: block;
                        height: 100%;
                        background: linear-gradient(90deg, #DAB177 0%, #C8A060 100%);
                        width: 0%;
                        transition: width 0.3s ease;
                    }
                    .progress-text {
                        font-size: 0.875rem;
                        color: #6b7280;
                        font-weight: 500;
                    }
                    .tour-buttons {
                        display: flex;
                        gap: 0.5rem;
                        flex-wrap: wrap;
                    }
                    .tour-buttons button {
                        padding: 0.5rem 0.75rem;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.875rem;
                        font-weight: 500;
                        transition: all 0.2s;
                        flex: 1;
                        min-width: 80px;
                    }
                    .btn-pause, .btn-resume {
                        background: #f59e0b;
                        color: white;
                    }
                    .btn-pause:hover, .btn-resume:hover {
                        background: #d97706;
                    }
                    .btn-skip {
                        background: #3b82f6;
                        color: white;
                    }
                    .btn-skip:hover {
                        background: #2563eb;
                    }
                    .btn-exit {
                        background: #ef4444;
                        color: white;
                    }
                    .btn-exit:hover {
                        background: #dc2626;
                    }
                `;
                document.head.appendChild(style);
            }
        }

        // Expose to window for onclick handlers
        window.EvaTour = this;
    },

    /**
     * Hide tour controls
     */
    hideControls() {
        const controls = document.getElementById('eva-tour-controls');
        if (controls) {
            controls.remove();
        }
    },

    /**
     * Update progress bar
     */
    updateProgress(current, total) {
        const controls = document.getElementById('eva-tour-controls');
        if (controls) {
            const progressBar = controls.querySelector('.progress-bar');
            const progressText = controls.querySelector('.progress-text');

            const percentage = (current / total) * 100;
            if (progressBar) {
                progressBar.style.setProperty('--progress', `${percentage}%`);
                const after = progressBar.querySelector('::after');
                if (after) after.style.width = `${percentage}%`;
                // Hack: use CSS variable
                progressBar.setAttribute('style', `--width: ${percentage}%`);
            }

            if (progressText) {
                progressText.textContent = `Etapa ${current} de ${total}`;
            }
        }
    },

    /**
     * Speak text and wait for completion
     */
    async speakAndWait(text) {
        return new Promise((resolve) => {
            const user = JSON.parse(localStorage.getItem('user') || '{}');

            // If voice is disabled, resolve immediately
            if (!user?.eva_voice_enabled) {
                console.log('[EVA Tour] Voice disabled, skipping speech');
                resolve();
                return;
            }

            // Call speak function
            if (window.EVAConsultant?.speak) {
                window.EVAConsultant.speak(text);
            }

            // Calculate estimated speech duration
            // Average speaking rate: ~150 words per minute (2.5 words/second)
            // Adjust for voice rate setting (0.5x to 1.5x speed)
            const voiceRate = user?.eva_voice_rate !== undefined ? user.eva_voice_rate : 75;
            const actualRate = 0.5 + (voiceRate / 100); // 0.5 to 1.5

            const wordCount = text.split(/\s+/).length;
            const baseTimeMs = (wordCount / 2.5) * 1000; // Base time at normal speed
            const adjustedTimeMs = baseTimeMs / actualRate; // Adjust for speed

            // Add buffer for TTS initialization and safety margin
            const totalWaitMs = adjustedTimeMs + 1500;

            console.log(`[EVA Tour] Speech duration estimate: ${Math.round(totalWaitMs)}ms (${wordCount} words, rate: ${actualRate.toFixed(2)}x)`);

            setTimeout(resolve, totalWaitMs);
        });
    },

    /**
     * Utility: wait helper
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Auto-expose to window
window.EvaTour = EvaTour;
