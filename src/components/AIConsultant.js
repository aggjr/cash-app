
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
    fab.style.width = '160px';
    fab.style.height = '160px';
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
    img.style.transform = 'scale(1.4) translateY(10px)';

    fab.appendChild(img);

    fab.onmouseenter = () => fab.style.transform = 'scale(1.05)';
    fab.onmouseleave = () => fab.style.transform = 'scale(1)';
    fab.onclick = () => {
        toggleChat();
        // Speak greeting on first open if silent? Or always?
        // Let's speak only if opening.
        if (isOpen && messages.length === 1) {
            speak(messages[0].text);
        }
    };

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
        <span style="font-weight: 600;">EVA - Consultora IA</span>
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

    // Mic Button
    const micBtn = document.createElement('button');
    micBtn.innerHTML = '🎤'; // Generic icon
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
    micBtn.title = 'Segure para falar';

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
            input.placeholder = 'Pergunte sobre seus números...';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            input.value = transcript;
            // Auto send? Maybe wait for user confirmation.
            // User requested "falar mesmo", so maybe auto send makes sense, 
            // but safer let them check.
        };

        micBtn.onmousedown = () => recognition.start();
        micBtn.onmouseup = () => recognition.stop();
        // Also support click toggle
        // micBtn.onclick = () => { if (isListening) recognition.stop(); else recognition.start(); };
    } else {
        micBtn.style.display = 'none';
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Pergunte sobre seus números...';
    input.style.flex = '1';
    input.style.padding = '0.5rem';
    input.style.border = '1px solid #d1d5db';
    input.style.borderRadius = '6px';
    input.style.outline = 'none';

    input.onkeyup = (e) => {
        if (e.key === 'Enter') sendMessage();
    };

    const sendBtn = document.createElement('button');
    sendBtn.textContent = '➤';
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
    let pendingAction = null; // Stores { type: 'create_contract', data: {...} }

    const toggleChat = () => {
        isOpen = !isOpen;
        chatWindow.style.display = isOpen ? 'flex' : 'none';
        if (isOpen) {
            renderMessages();
            input.focus();
        }
    };

    const renderMessages = () => {
        messagesContainer.innerHTML = '';
        messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.style.maxWidth = '80%';
            msgDiv.style.padding = '0.8rem';
            msgDiv.style.borderRadius = '8px';
            msgDiv.style.fontSize = '0.9rem';
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

            // Allow newlines
            msgDiv.innerHTML = msg.text.replace(/\n/g, '<br>');
            messagesContainer.appendChild(msgDiv);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const executeContractCreation = async (data) => {
        try {
            const loadingMsg = { sender: 'ai', text: 'Processando lançamento... Aguarde um momento.' };
            messages.push(loadingMsg);
            renderMessages();
            speak(loadingMsg.text);

            // 1. Get Project ID
            const projectStr = localStorage.getItem('currentProject');
            if (!projectStr) throw new Error('Projeto não selecionado');
            const project = JSON.parse(projectStr);
            const projectId = project.id;

            // 2. Fetch Dependencies (Companies, Accounts, Types)
            const [companyRes, accountRes, typeRes] = await Promise.all([
                fetch(`${API_BASE_URL}/companies?projectId=${projectId}`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/accounts?projectId=${projectId}`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/tipo_entrada?projectId=${projectId}`, { headers: getHeaders() })
            ]);

            const companies = await companyRes.json();
            const accounts = await accountRes.json();
            const types = await typeRes.json();

            // Safe Defaults (pick first available)
            const companyId = companies.length > 0 ? companies[0].id : null;
            const accountId = accounts.length > 0 ? accounts[0].id : null;
            const typeId = types.length > 0 ? types[0].id : null;

            if (!companyId || !typeId) throw new Error('Dados incompletos (Empresa ou Tipo) para cadastro automático.');

            // 3. Create Income Payload
            const today = new Date().toISOString().split('T')[0];
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const datePrev = nextMonth.toISOString().split('T')[0]; // Start repayment next month? Or today? Let's say next month.

            const payload = {
                projectId,
                descricao: "Consultoria Nova - Contrato 12 Meses",
                valor: data.value,
                data_fato: today,
                data_prevista_recebimento: datePrev,
                company_id: companyId,
                account_id: accountId,
                tipo_entrada_id: typeId,

                // Installment Logic
                installment_total: 12,
                installment_interval: 'mensal',
                installment_custom_days: null
            };

            // 4. Call API
            const response = await fetch(`${API_BASE_URL}/incomes`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Falha ao criar registros.');

            // 5. Success
            const successMsg = 'Pronto! O contrato foi registrado e as 12 parcelas geradas com sucesso. Abrindo a tela de Entradas para você conferir.';
            messages.push({ sender: 'ai', text: successMsg });
            renderMessages();
            speak(successMsg);

            // 6. Navigation
            const menuItem = document.querySelector('.menu-item[data-id="income"]'); // ID for "Entradas"
            if (menuItem) {
                menuItem.click();
                setTimeout(() => {
                    const table = document.querySelector('#table-container');
                    if (table) table.style.border = "4px solid #10B981"; // Green highlight
                }, 800);
            }

        } catch (error) {
            console.error(error);
            const errorMsg = 'Desculpe, ocorreu um erro ao tentar registrar o contrato Automaticamente.';
            messages.push({ sender: 'ai', text: errorMsg });
            renderMessages();
            speak(errorMsg);
        }
    };

    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        // Add User Message
        messages.push({ sender: 'user', text });
        input.value = '';
        renderMessages();

        // Simulate AI Thinking
        const loadingDiv = document.createElement('div');
        loadingDiv.textContent = 'EVA está analisando...';
        loadingDiv.style.alignSelf = 'flex-start';
        loadingDiv.style.fontSize = '0.8rem';
        loadingDiv.style.color = '#6B7280';
        loadingDiv.style.marginLeft = '0.5rem';
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        setTimeout(async () => {
            loadingDiv.remove();
            let responseText = '';
            let action = null;
            const lowerText = text.toLowerCase();

            // --- Intent Handling ---

            // 1. Confirm Pending Action
            if (pendingAction && (lowerText === 'sim' || lowerText.includes('confirmo') || lowerText.includes('pode') || lowerText.includes('ok'))) {
                if (pendingAction.type === 'create_contract') {
                    await executeContractCreation(pendingAction.data);
                    pendingAction = null; // Clear
                    return; // Stop further processing
                }
            } else if (pendingAction && (lowerText.includes('não') || lowerText.includes('cancelar'))) {
                responseText = 'Tudo bem, operação cancelada.';
                pendingAction = null;
            }

            // 2. New Contract Intent
            else if ((lowerText.includes('contrato') || lowerText.includes('fechei')) && lowerText.includes('12') && lowerText.includes('consultoria')) {

                // Extract value
                let value = 4000; // Default fallback
                // Try match "X mil" or "X reais"
                const milMatch = text.match(/(\d+)\s*mil/i);
                if (milMatch) {
                    value = parseInt(milMatch[1]) * 1000;
                } else {
                    const numMatch = text.match(/R\$\s*([\d\.,]+)/) || text.match(/(\d+)\s*reais/);
                    if (numMatch) value = parseFloat(numMatch[1].replace('.', '').replace(',', '.'));
                }

                responseText = `Entendido. Parabéns pelo novo contrato!\n\nVou cadastrar agora mesmo o novo **Tipo de Entrada** "Consultoria Nova" e já lançar as **12 parcelas recorrentes** de **${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}** para os próximos meses.\n\nDeseja confirmar o lançamento?`;

                pendingAction = {
                    type: 'create_contract',
                    data: { value }
                };
            }
            // 3. Status Inquiry
            else if (lowerText.includes('andamento da minha empresa') || lowerText.includes('andamento') || lowerText.includes('como está minha empresa')) {
                responseText = `A empresa não tem muitos dados, mas é importante olharmos na tela de **CONSOLIDADA** que os valores de **Entrada Operacional** estão muito baixos frente às despesas.\n\nA empresa hoje está operando realmente com o **APORTE** feito pelo sócio.`;
                responseText += `\n\n vou abrir a tela de Consolidadas para analisarmos juntos.`

                action = () => {
                    const menuItem = document.querySelector('.menu-item[data-id="consolidadas"]');
                    if (menuItem) {
                        menuItem.click();
                        setTimeout(() => {
                            const table = document.querySelector('#consolidadas-table-container');
                            if (table) table.style.border = "4px solid #DAB177";
                        }, 500);
                    }
                };
            } else if (lowerText.includes('lucro') || lowerText.includes('resultado')) {
                responseText = 'Com base no Resultado Final deste mês, sua margem de lucro está positiva. Recomendo focar em reduzir as Despesas Operacionais para maximizar o ganho.';
            } else if (lowerText.includes('caixa')) {
                responseText = 'O Fluxo de Caixa mostra entradas consistentes, mas fique atento aos dias 15 e 20, onde há picos de saídas previstas.';
            } else {
                responseText = 'Interessante. Como seu consultor, estou cruzando esses dados com o histórico da empresa para te dar uma resposta mais precisa. Em breve estarei conectado à API real!';
            }

            // Send Response
            const formattedText = responseText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            messages.push({ sender: 'ai', text: formattedText });
            renderMessages();
            speak(responseText.replace(/\*\*/g, ''));

            if (action) {
                setTimeout(action, 1000);
            }

        }, 1500);
    };

    return container;
};
