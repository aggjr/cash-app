
export const AIConsultant = () => {
    // Container
    const container = document.createElement('div');
    container.id = 'ai-consultant-wrapper';
    container.style.position = 'fixed';
    container.style.bottom = '80px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.fontFamily = 'var(--font-main, sans-serif)';

    // State
    let isOpen = false;
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
    fab.style.width = '160px'; // increased from 60px (approx 2.6x, close to 3x visually with the zoom)
    fab.style.height = '160px';
    fab.style.borderRadius = '50%';
    fab.style.border = 'none';
    fab.style.cursor = 'pointer';
    fab.style.backgroundColor = 'transparent'; // Transparent to let the image "float"
    fab.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)'; // Enhanced shadow for bigger element
    fab.style.transition = 'transform 0.2s';
    fab.style.overflow = 'hidden'; // Clips the zoomed image to the circle
    fab.style.padding = '0';

    // Image
    const img = document.createElement('img');
    img.src = '/robot_icon.png';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover'; // Fills the circle
    img.style.transform = 'scale(1.4) translateY(10px)'; // Zoom in (crop) and slight adjust to center face

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
    chatWindow.style.display = 'none'; // Hidden by default
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
    closeBtn.onclick = () => toggleChat();

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

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputArea);

    container.appendChild(chatWindow); // Window first (so z-index logic works if needed, though they are separate)
    container.appendChild(fab);

    // --- Logic ---

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

        // Simulate API delay
        setTimeout(() => {
            loadingDiv.remove();
            let responseText = '';
            let action = null;

            // --- Scripted Logic ---
            const lowerText = text.toLowerCase();

            if (lowerText.includes('andamento da minha empresa') || lowerText.includes('andamento') || lowerText.includes('como está minha empresa')) {
                responseText = `A empresa não tem muitos dados, mas é importante olharmos na tela de **CONSOLIDADA** que os valores de **Entrada Opercional** estão muito baixos frente às despesas.\n\nA empresa hoje está operando realmente com o **APORTE** feito pelo sócio.`;
                responseText += `\n\n vou abrir a tela de Consolidadas para analisarmos juntos.`

                // Set Action to Open Screen
                action = () => {
                    const menuItem = document.querySelector('.menu-item[data-id="consolidadas"]');
                    if (menuItem) {
                        menuItem.click();
                        // Optional simple highlight effect after opening
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

            // Bold verification for markdown simulation
            responseText = responseText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

            messages.push({ sender: 'ai', text: responseText });
            renderMessages();

            if (action) {
                setTimeout(action, 1000); // Wait 1s so user sees the message first
            }

        }, 1500);
    };

    return container;
};
