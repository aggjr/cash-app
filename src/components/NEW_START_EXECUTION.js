// MODIFICAÇÕES NA FUNÇÃO startExecution
// Localização: CampanhaWizard.js, função startExecution (linha ~784-900)

// ENCONTRE a função startExecution e SUBSTITUA por esta versão:

const startExecution = async () => {
    try {
        console.log('🚀 Iniciando execução da campanha...');

        // Validate
        if (!state.config.nome) {
            showToast('Por favor, preencha o nome da campanha', 'error');
            return;
        }

        if (state.leads.length === 0) {
            showToast('Selecione pelo menos um lead', 'error');
            return;
        }

        // Prepare payload
        const payload = {
            nome: state.config.nome,
            descricao: state.config.descricao || '',
            dataInicio: state.config.dataInicio,
            dataFim: state.config.dataFim,
            status: 'ativa',
            dispatchIntervalSeconds: state.config.dispatchIntervalSeconds || 120,
            leadsIds: state.leads.map(l => l.id),
            message: {
                emailSubject: state.config.useEmail ? state.message.emailSubject : null,
                emailBody: state.config.useEmail ? state.message.emailBody : null,
                whatsappText: state.config.useWhatsapp ? state.message.whatsappText : null,
                mediaUrl: state.message.mediaUrl || null
            }
        };

        console.log('📦 Payload:', payload);

        // Save campaign
        const API_BASE_URL = getApiBaseUrl();
        const response = await fetch(`${API_BASE_URL}/marketing/campanhas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao criar campanha');
        }

        const campanha = await response.json();
        console.log('✅ Campanha criada:', campanha);

        // Start async dispatch
        const dispatchResponse = await fetch(`${API_BASE_URL}/marketing/campanhas/${campanha.id}/disparar-async`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!dispatchResponse.ok) {
            throw new Error('Erro ao iniciar disparos');
        }

        showToast('✅ Disparos iniciados! Acompanhe o progresso abaixo.', 'success');

        // Change button to "Fechar"
        const executeBtn = footer.querySelector('.btn-primary');
        if (executeBtn) {
            executeBtn.textContent = 'Fechar';
            executeBtn.onclick = () => {
                if (window.dispatchPollingInterval) {
                    clearInterval(window.dispatchPollingInterval);
                }
                if (onSave) onSave(campanha);
                resolve(campanha);
                document.body.removeChild(container);
            };
        }

        // Start polling for status updates (every 3 seconds)
        window.dispatchPollingInterval = setInterval(() => {
            refreshDispatchStatuses(campanha.id);
        }, 3000);

        console.log('🔄 Polling iniciado para atualização de status');

    } catch (error) {
        console.error('❌ Erro na execução:', error);
        showToast('Erro: ' + error.message, 'error');
    }
};
