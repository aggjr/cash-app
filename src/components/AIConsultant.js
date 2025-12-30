
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const AIConsultant = () => {
    const API_BASE_URL = getApiBaseUrl();
    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
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
    let isListening = false;

    // --- Voice Logic (TTS) ---
    const speak = (text) => {
        if (!window.speechSynthesis) return;

        // Check if voice is enabled
        const user = getUser();
        if (!user?.eva_voice_enabled) return; // PRIVACY: Only speak if user opted in

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.1; // Slightly faster natural usage
        utterance.pitch = 1.0;

        // Try to find a good Brazilian voice
        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang === 'pt-BR' && v.name.includes('Google')) || voices.find(v => v.lang === 'pt-BR');
        if (ptVoice) utterance.voice = ptVoice;

        window.speechSynthesis.speak(utterance);
    };

    // Load voices eagerly
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }

    // Scripted Initial Greeting
    const messages = [
        {
            sender: 'ai',
            text: 'Oi, meu nome é EVA e eu estou aqui para te auxiliar a gerenciar sua empresa.\n\nSobre o que vc quer discutir hoje?'
        }
    ];

    // --- Components ---

    // 1. Floating Button (The Robot)
    const fab = document.createElement('button');
    fab.className = 'ai-fab';
    // User Request: Reduce size by 30% from previous 128px (~90px)
    fab.style.width = '90px';
    fab.style.height = '90px';
    fab.style.borderRadius = '50%';
    fab.style.border = 'none';
    fab.style.cursor = 'pointer';
    fab.style.backgroundColor = 'transparent';
    fab.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)';
    fab.style.transition = 'transform 0.2s';
    fab.style.overflow = 'hidden';
    fab.style.padding = '0';

    // Image
    const img = document.createElement('img');
    img.src = '/robot_icon.png';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.transform = 'scale(1.4) translateY(5px)'; // Adjusted translate for smaller size

    fab.appendChild(img);

    fab.onmouseenter = () => fab.style.transform = 'scale(1.05)';
    fab.onmouseleave = () => fab.style.transform = 'scale(1)';
    fab.onclick = () => {
        toggleChat();
    };

    // 2. Chat Window
    const chatWindow = document.createElement('div');
    chatWindow.className = 'ai-chat-window';
    chatWindow.style.position = 'absolute';
    chatWindow.style.bottom = '80px';
    chatWindow.style.right = '0';
    chatWindow.style.width = '320px'; // Slightly smaller width too
    chatWindow.style.height = '450px';
    chatWindow.style.backgroundColor = 'white';
    chatWindow.style.borderRadius = '12px';
    chatWindow.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
    chatWindow.style.display = 'none';
    chatWindow.style.flexDirection = 'column';
    chatWindow.style.overflow = 'hidden';
    chatWindow.style.border = '1px solid #e5e7eb';
    chatWindow.style.zIndex = '10000000'; // Ensure on top of modals

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
        <span style="font-weight: 600; font-size: 0.9rem;">EVA - Consultora IA</span>
    `;

    // Voice Toggle Button
    const voiceToggleBtn = document.createElement('button');
    voiceToggleBtn.style.cssText = 'background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; color: white; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;';

    const updateVoiceButton = () => {
        const user = getUser();
        const isEnabled = user?.eva_voice_enabled;
        voiceToggleBtn.innerHTML = isEnabled ? '🔊 Voz ON' : '🔇 Voz OFF';
        voiceToggleBtn.style.background = isEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        voiceToggleBtn.style.borderColor = isEnabled ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
    };

    updateVoiceButton();

    voiceToggleBtn.onclick = async () => {
        try {
            const user = getUser();
            const newState = !user?.eva_voice_enabled;

            const res = await fetch(`${API_BASE_URL}/auth/update-preference`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ evaVoiceEnabled: newState })
            });

            if (res.ok) {
                const data = await res.json();
                updateLocalUser(data.user);
                updateVoiceButton();

                if (newState) {
                    speak('Voz ativada!');
                }
            }
        } catch (e) {
            console.error('Error toggling voice:', e);
        }
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.color = 'white';
    closeBtn.style.fontSize = '1.5rem';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        toggleChat();
    };

    header.appendChild(headerTitle);
    header.appendChild(voiceToggleBtn);
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

    // Mic Button
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

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    if (Recognition) {
        recognition = new Recognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListening = true;
            micBtn.style.backgroundColor = '#ffcccc';
            micBtn.style.borderColor = 'red';
            input.placeholder = 'Ouvindo...';
        };

        recognition.onend = () => {
            isListening = false;
            micBtn.style.backgroundColor = 'transparent';
            micBtn.style.borderColor = '#d1d5db';
            input.placeholder = 'Digite aqui...';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            input.value = transcript;
        };

        micBtn.onmousedown = () => recognition.start();
        micBtn.onmouseup = () => recognition.stop();
    } else {
        micBtn.style.display = 'none';
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Digite aqui...';
    input.style.flex = '1';
    input.style.padding = '0.5rem';
    input.style.border = '1px solid #d1d5db';
    input.style.borderRadius = '6px';
    input.style.outline = 'none';
    input.style.fontSize = '0.9rem';

    input.onkeyup = (e) => {
        if (e.key === 'Enter') sendMessage();
    };

    const sendBtn = document.createElement('button');
    sendBtn.innerHTML = '➤';
    sendBtn.style.background = '#00425F';
    sendBtn.style.color = 'white';
    sendBtn.style.border = 'none';
    sendBtn.style.borderRadius = '6px';
    sendBtn.style.width = '36px';
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

    // --- Logic ---
    let pendingAction = null;
    let loanResolver = null; // Promise resolve function for loan flow
    let loanContext = null;  // Data for loan flow

    // Preferred Name Logic
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

    // --- EVA Introduction Modal (First Time) ---
    const showIntroductionModal = () => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 100000; display: flex; align-items: center; justify-content: center;';

            const modal = document.createElement('div');
            modal.style.cssText = 'background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);';

            modal.innerHTML = `
                <h2 style="margin: 0 0 1rem 0; color: var(--color-primary); font-size: 1.5rem;">👋 Olá! Sou a EVA</h2>
                <p style="margin: 0 0 1.5rem 0; line-height: 1.5; color: #555;">
                    Sua <strong>assistente financeira inteligente</strong>. Estou aqui para ajudar você a gerenciar suas finanças de forma mais eficiente.
                </p>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">Como você gostaria de ser chamado(a)?</label>
                    <input type="text" id="eva-intro-name" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; box-sizing: border-box;" placeholder="Digite seu nome preferido">
                </div>

                <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f0f9ff; border-radius: 6px; border: 1px solid #bfdbfe;">
                    <label style="display: flex; align-items: start; cursor: pointer; gap: 0.5rem;">
                        <input type="checkbox" id="eva-voice-toggle" style="margin-top: 0.25rem;">
                        <div>
                            <div style="font-weight: 500; color: #1e40af;">✓ Ativar comandos por voz</div>
                            <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem;">ℹ️ Você pode desativar a voz a qualquer momento se precisar de privacidade</div>
                        </div>
                    </label>
                </div>

                <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                    <button id="eva-intro-confirm" style="background: var(--color-primary); color: white; border: none; padding: 0.75rem 2rem; border-radius: 6px; font-size: 1rem; cursor: pointer; font-weight: 500;">Confirmar</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const nameInput = modal.querySelector('#eva-intro-name');
            const voiceCheckbox = modal.querySelector('#eva-voice-toggle');
            const confirmBtn = modal.querySelector('#eva-intro-confirm');

            // Default voice to checked
            voiceCheckbox.checked = true;

            // Get current user name as default
            const user = getUser();
            if (user?.name) {
                nameInput.value = user.preferred_name || user.name;
            }

            setTimeout(() => nameInput.focus(), 100);

            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') confirmBtn.click();
            });

            confirmBtn.onclick = async () => {
                const preferredName = nameInput.value.trim();
                const evaVoiceEnabled = voiceCheckbox.checked;

                if (!preferredName) {
                    nameInput.style.borderColor = 'red';
                    return;
                }

                // Save to server
                try {
                    const res = await fetch(`${API_BASE_URL}/auth/update-preference`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            preferredName,
                            evaIntroduced: true,
                            evaVoiceEnabled
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        updateLocalUser(data.user);
                        document.body.removeChild(overlay);
                        resolve({ preferredName, evaVoiceEnabled });
                    } else {
                        alert('Erro ao salvar preferências. Tente novamente.');
                    }
                } catch (e) {
                    console.error('Error saving EVA preferences:', e);
                    alert('Erro ao salvar preferências. Tente novamente.');
                }
            };
        });
    };

    const checkPreferredName = async () => {
        const user = getUser();
        // If we don't know the user or already have a preferred name, skip
        if (!user || user.preferred_name) return;

        // If we already asked or are in another flow, skip
        if (pendingAction) return;

        const msg = `Olá, ${user.name}! Notei que ainda não sei como você prefere ser chamado.\n\nComo devo me dirigir a você?`;
        messages.push({ sender: 'ai', text: msg });
        renderMessages();
        speak(msg);
        pendingAction = { type: 'ask_preferred_name' };
    };

    const setPreferredName = async (name) => {
        try {
            const res = await fetch(`${API_BASE_URL}/auth/update-preference`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ preferredName: name })
            });

            if (res.ok) {
                const data = await res.json();
                updateLocalUser(data.user);
                const msg = `Entendido, **${name}**. Vou me lembrar disso.`;
                messages.push({ sender: 'ai', text: msg });
                renderMessages();
                speak(`Entendido, ${name}. Vou me lembrar disso.`);
                pendingAction = null;
            } else {
                speak("Tive um problema ao salvar sua preferência.");
                pendingAction = null;
            }
        } catch (e) {
            console.error(e);
            pendingAction = null;
        }
    };

    const toggleChat = async () => {
        isOpen = !isOpen;
        chatWindow.style.display = isOpen ? 'flex' : 'none';
        if (isOpen) {
            // Check for first-time introduction
            const user = getUser();
            if (user && !user.eva_introduced) {
                const result = await showIntroductionModal();
                // After introduction, greet with voice if enabled
                const greeting = `Olá, ${result.preferredName}! Prazer em conhecê-lo. Como posso ajudar hoje?`;
                messages.push({ sender: 'ai', text: greeting });
                renderMessages();
                speak(greeting);
            } else {
                renderMessages();
                input.focus();
                // Check for preferred name if not busy and not introduced
                setTimeout(() => {
                    if (!pendingAction && user && !user.eva_introduced) checkPreferredName();
                }, 500);
            }
        }
    };

    const renderMessages = () => {
        messagesContainer.innerHTML = '';
        messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.style.maxWidth = '85%';
            msgDiv.style.padding = '0.8rem';
            msgDiv.style.borderRadius = '8px';
            msgDiv.style.fontSize = '0.85rem';
            msgDiv.style.lineHeight = '1.4';

            if (msg.sender === 'user') {
                msgDiv.style.alignSelf = 'flex-end';
                msgDiv.style.backgroundColor = '#00425F';
                msgDiv.style.color = 'white';
                msgDiv.style.borderBottomRightRadius = '0';
            } else {
                msgDiv.style.alignSelf = 'flex-start';
                msgDiv.style.backgroundColor = 'white';
                msgDiv.style.color = '#1f2937';
                msgDiv.style.border = '1px solid #e5e7eb';
                msgDiv.style.borderBottomLeftRadius = '0';
                msgDiv.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            }

            msgDiv.innerHTML = msg.text.replace(/\n/g, '<br>');
            messagesContainer.appendChild(msgDiv);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    // --- Public API logic for Loan ---
    const startLoanCategorization = async (data) => {
        return new Promise(async (resolve) => {
            loanResolver = resolve;
            loanContext = data; // { projectId, nominal, net, feeAmount }

            // Open Chat
            if (!isOpen) toggleChat();

            // Fetch Suggestions
            try {
                const [feeRes, intRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/loans/suggest-category?projectId=${data.projectId}&type=fees`, { headers: getHeaders() }),
                    fetch(`${API_BASE_URL}/loans/suggest-category?projectId=${data.projectId}&type=interest`, { headers: getHeaders() })
                ]);

                const feeSugg = await feeRes.json();
                const intSugg = await intRes.json();

                loanContext.suggestions = {
                    fees: feeSugg,    // { id, name }
                    interest: intSugg // { id, name }
                };

                const msg = `Olá! Vi que você está contratando um empréstimo com taxas de **${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.feeAmount)}**.\n\nPara as **Tarifas**, sugiro a categoria: **"${feeSugg.name}"**.\n\nPara os **Juros** das parcelas, sugiro: **"${intSugg.name}"**.\n\nVocê concorda com essas classificações? (Sim/Não)`;

                messages.push({ sender: 'ai', text: msg });
                renderMessages();
                speak(msg.replace(/\*\*/g, ''));

                // State: waiting for confirmation
                pendingAction = { type: 'loan_cat_confirm' };

            } catch (e) {
                console.error(e);
                // Fallback
                console.warn('EVA failed to get suggestions, resolving null to let backend handle auto');
                resolve(null);
            }
        });
    };

    // Global Exposure
    window.EVA = {
        startLoanCategorization
    };


    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        messages.push({ sender: 'user', text });
        input.value = '';
        renderMessages();

        // Simulate thinking
        const loadingDiv = document.createElement('div');
        loadingDiv.textContent = '...';
        loadingDiv.style.alignSelf = 'flex-start';
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        setTimeout(async () => {
            loadingDiv.remove();
            let responseText = '';
            const lowerText = text.toLowerCase();

            // --- Intent Handling ---

            if (pendingAction && pendingAction.type === 'ask_preferred_name') {
                await setPreferredName(text);
                return; // Stop processing
            }

            // LOAN CATEGORIZATION FLOW
            if (pendingAction && pendingAction.type === 'loan_cat_confirm') {
                if (lowerText === 'sim' || lowerText.includes('ok') || lowerText.includes('concordo')) {
                    responseText = "Perfeito! Classificações confirmadas. Finalizando o contrato...";
                    if (loanResolver) {
                        loanResolver({
                            feeCategoryId: loanContext.suggestions.fees.id,
                            interestCategoryId: loanContext.suggestions.interest.id
                        });
                        loanResolver = null;
                        pendingAction = null;
                        setTimeout(() => { if (isOpen) toggleChat(); }, 2000); // Close after success
                    }
                } else {
                    responseText = "Entendi. Para onde você gostaria de direcionar as **Tarifas Bancárias**? (Diga o nome da categoria)";
                    pendingAction = { type: 'loan_cat_ask_fees' };
                }
            }
            else if (pendingAction && pendingAction.type === 'loan_cat_ask_fees') {
                // User provided a name. We need to find or create.
                // For simplicity, we'll try to find it, or create under 'Despesas Financeiras'
                // But wait, the user instructions say "follow what user says, including creating folders".
                // Detailed implementation would require complex conversation.
                // Simplification: Assume user gives a name, we use 'getOrCreateType' logic via backend?
                // Current backend endpoint 'suggest' is read only mostly.
                // We don't have a generic "create by name" endpoint exposed easily for EVA without auth/context.
                // We'll simulate success for now or use the suggestion anyway if complex.

                // Better approach: Just ask "Qual nome?" and then create/find via a new simple API call or just use the name to search in list?
                // Let's assume we can map it.
                // For now, let's keep it robust:
                responseText = `Ok, vou procurar ou criar a categoria **"${text}"** para as Tarifas.\n\nE para os **Juros**? Onde devo alocar?`;

                // Store user's wish
                loanContext.customFeeName = text;
                pendingAction = { type: 'loan_cat_ask_interest' };
            }
            else if (pendingAction && pendingAction.type === 'loan_cat_ask_interest') {
                loanContext.customInterestName = text;
                responseText = "Combinado! Utilizarei suas definições personalizadas. Finalizando...";

                // TODO: Here we would actually need to Resolve IDs. 
                // Since we don't have the "Search/Create by Name" API handy here, 
                // we will pass the NAMES back to LoanModal? 
                // LoanModal currently expects IDs.
                // WE NEED TO RESOLVE IDS HERE.
                // Since we are in frontend, we can fetch all types and search?
                // Or call a 'create-type' endpoint.

                // Quick Fix: Let's assume we resolve to the suggested ones if too complex, 
                // OR implementation: Fetch all types, search, if not found POST /transaction-types

                // Let's implement the resolver logic in a helper function here inside EVA
                const resolveCustom = async (name, parentName = "Despesas Financeiras") => {
                    // 1. Fetch all
                    const res = await fetch(`${API_BASE_URL}/tipo_saida?projectId=${loanContext.projectId}`, { headers: getHeaders() });
                    const types = await res.json();
                    // 2. Search
                    const match = types.find(t => t.label.toLowerCase() === name.toLowerCase());
                    if (match) return match.id;

                    // 3. Create (Simple root or Find parent)
                    // Find parent
                    let parent = types.find(t => t.label.toLowerCase() === parentName.toLowerCase());
                    if (!parent) {
                        // Create parent
                        const resP = await fetch(`${API_BASE_URL}/transaction-types`, {
                            method: 'POST',
                            headers: getHeaders(),
                            body: JSON.stringify({ projectId: loanContext.projectId, label: parentName, type: 'saida', active: 1 })
                        });
                        const jsonP = await resP.json();
                        parent = { id: jsonP.id }; // approximate response
                    }

                    // Create Child
                    const resC = await fetch(`${API_BASE_URL}/transaction-types`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ projectId: loanContext.projectId, label: name, parentId: parent.id, type: 'saida', active: 1 })
                    });
                    const jsonC = await resC.json();
                    return jsonC.id || jsonC.insertId; // Adapt based on actual API
                };

                try {
                    const feeId = await resolveCustom(loanContext.customFeeName);
                    const intId = await resolveCustom(loanContext.customInterestName);

                    if (loanResolver) {
                        loanResolver({
                            feeCategoryId: feeId,
                            interestCategoryId: intId
                        });
                        loanResolver = null;
                        pendingAction = null;
                        setTimeout(() => { if (isOpen) toggleChat(); }, 2000);
                    }
                } catch (e) {
                    console.error(e);
                    responseText = "Tive um problema ao criar as categorias. Usarei as padrões por segurança.";
                    if (loanResolver) {
                        loanResolver({
                            feeCategoryId: loanContext.suggestions.fees.id,
                            interestCategoryId: loanContext.suggestions.interest.id
                        });
                        loanResolver = null;
                        pendingAction = null;
                    }
                }
            }

            // Normal EVA interactions (fallthrough)
            else if (lowerText.includes('olá') || lowerText.includes('oi')) {
                const user = getUser();
                const nameToUse = user?.preferred_name || user?.name || '';
                responseText = `Olá ${nameToUse}! Como posso ajudar sua empresa hoje?`;
            } else if (!pendingAction) {
                responseText = 'Não entendi bem. Tente perguntar sobre "lucro", "caixa" ou "contrato".';
            }

            // Send Response
            const formattedText = responseText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            messages.push({ sender: 'ai', text: formattedText });
            renderMessages();
            speak(responseText.replace(/\*\*/g, ''));

        }, 1000);
    };

    return container;
};
