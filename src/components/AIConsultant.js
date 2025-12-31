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
    let pendingAction = null; // null | 'intro_ask_name' | 'intro_ask_voice' | ...
    let loanResolver = null;
    let loanContext = null;

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

    // --- Voice Logic (TTS) ---
    const speak = (text) => {
        if (!window.speechSynthesis) return;

        // Check if voice is enabled
        const user = getUser();
        if (!user?.eva_voice_enabled) return;

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.1;

        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang === 'pt-BR' && v.name.includes('Google')) || voices.find(v => v.lang === 'pt-BR');
        if (ptVoice) utterance.voice = ptVoice;

        window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }

    const messages = []; // Start empty, populate on init

    // --- Components ---

    // 1. Floating Button
    const fab = document.createElement('button');
    fab.className = 'ai-fab';
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

    const img = document.createElement('img');
    img.src = '/robot_icon.png'; // Reverted to EVA icon
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';

    fab.appendChild(img);

    fab.onmouseenter = () => fab.style.transform = 'scale(1.05)';
    fab.onmouseleave = () => fab.style.transform = 'scale(1)';
    fab.onclick = () => toggleChat();

    // 2. Chat Window
    const chatWindow = document.createElement('div');
    chatWindow.className = 'ai-chat-window';
    chatWindow.style.position = 'absolute';
    chatWindow.style.bottom = '80px';
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
        <span style="font-weight: 600; font-size: 1rem;">EVA - Assistente Virtual</span>
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
            // Auto submit on voice? User prefers manual send usually, leaving as text input fill
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
        const msg = `Olá "${suggestedName}". Seja ${welcomeGender}. Eu sou a EVA, sua assistente virtual.\n\nPara que nossa interação seja mais adequada, como ${pronoun} gostaria de ser ${called}?`

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
                const msg = "Desculpe, não entendi. Prefere **áudio** ou **somente texto**?";
                addMessage('ai', msg);
                speak(msg);
                return;
            }

            // Save Voice Preference & Mark Introduced
            await savePreferences({
                evaVoiceEnabled: enableVoice,
                evaIntroduced: true
            });

            pendingAction = null;
            const msg = enableVoice
                ? "Perfeito. Responderei por áudio sempre que possível."
                : "Combinado. Manterei nossa comunicação apenas por texto.";

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

            // Detect gender
            const detectGender = (name) => {
                if (!name) return 'M';
                const lastChar = name.toLowerCase().slice(-1);
                const lastTwo = name.toLowerCase().slice(-2);
                const femaleEndings = ['a', 'as'];
                const maleEndings = ['o', 'os', 'el', 'eu', 'au'];
                if (femaleEndings.includes(lastChar) && !maleEndings.includes(lastTwo)) {
                    return 'F';
                }
                return 'M';
            };

            const response = await fetch(`${API_BASE_URL}/eva/chat`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    message: userMessage,
                    conversationHistory: messages.slice(-5).map(msg => ({
                        sender: msg.sender,
                        text: msg.text
                    })),
                    context: {
                        gender: detectGender(user?.name),
                        userName: user?.name,
                        suggestedName: getSuggestedName(user?.name, detectGender(user?.name))
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
            if (extracted && extracted.preferredName) {
                await savePreferences({ preferredName: extracted.preferredName });
            }

            if (extracted && extracted.voicePreference) {
                const voiceEnabled = extracted.voicePreference === 'audio' || extracted.voicePreference === 'both';
                await savePreferences({
                    evaVoiceEnabled: voiceEnabled ? 1 : 0,
                    evaIntroduced: 1
                });

                pendingAction = null; // End introduction

                // Process pending loan categorization if exists
                if (loanContext && loanResolver) {
                    setTimeout(() => processPendingLoanCategorization(), 2000);
                }
            }

        } catch (error) {
            console.error('Introduction LLM Error:', error);
            // Fallback to rules-based
            await handleIntroductionResponse(userMessage);
        }
    };


    const toggleChat = async () => {
        isOpen = !isOpen;
        chatWindow.style.display = isOpen ? 'flex' : 'none';

        if (isOpen) {
            const user = getUser();

            // Check if messages empty (first open)
            if (messages.length === 0) {
                if (user && !user.eva_introduced) {
                    await startIntroductionFlow();
                } else {
                    // Standard greeting
                    const preferredName = user?.preferred_name || user?.name || '';
                    const greeting = `Olá, ${preferredName}. Em que posso auxiliar?`;
                    addMessage('ai', greeting);
                    speak(greeting);
                }
            } else {
                // Just scroll to bottom
                renderMessages();
                input.focus();
            }
        }
    };

    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        addMessage('user', text);
        input.value = '';

        // Simulate thinking
        const loadingDiv = document.createElement('div');
        loadingDiv.textContent = '...';
        loadingDiv.style.alignSelf = 'flex-start';
        loadingDiv.style.marginLeft = '1rem';
        loadingDiv.style.color = '#6b7280';
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        setTimeout(async () => {
            loadingDiv.remove();

            // Intercept Introduction Flow
            if (pendingAction && pendingAction.startsWith('intro_')) {
                if (pendingAction === 'intro_llm') {
                    await handleIntroductionLLM(text);
                } else {
                    await handleIntroductionResponse(text);
                }
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

            // NOVA LÓGICA: Chamar LLM para conversação geral
            try {
                const user = getUser();

                // Detect gender from name
                const detectGender = (name) => {
                    if (!name) return 'M';
                    const lastChar = name.toLowerCase().slice(-1);
                    const lastTwo = name.toLowerCase().slice(-2);
                    const femaleEndings = ['a', 'as'];
                    const maleEndings = ['o', 'os', 'el', 'eu', 'au'];
                    if (femaleEndings.includes(lastChar) && !maleEndings.includes(lastTwo)) {
                        return 'F';
                    }
                    return 'M';
                };

                const response = await fetch(`${API_BASE_URL}/eva/chat`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        message: text,
                        conversationHistory: messages.slice(-10).map(msg => ({
                            sender: msg.sender,
                            text: msg.text
                        })),
                        context: {
                            preferredName: user?.preferred_name || user?.name || 'senhor/senhora',
                            gender: detectGender(user?.name),
                            projectName: 'CASH'
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error('Erro ao comunicar com EVA');
                }

                const { reply } = await response.json();
                addMessage('ai', reply);
                speak(reply);

            } catch (error) {
                console.error('EVA Error:', error);
                const fallback = "Desculpe, tive um problema ao processar sua mensagem. Pode tentar novamente?";
                addMessage('ai', fallback);
                speak(fallback);
            }

        }, 800);
    };

    // Public API
    const startLoanCategorization = async (data) => {
        return new Promise(async (resolve) => {
            const user = getUser();

            // Check if user has completed introduction
            if (!user?.eva_introduced) {
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

    window.EVA = {
        startLoanCategorization
    };

    // Alias for backward compatibility if needed, temporary
    window.FOCCUS = window.EVA;

    return container;
};
