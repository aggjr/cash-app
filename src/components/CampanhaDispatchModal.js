// CampanhaDispatchModal.js
// Novo componente para exibir detalhes de disparo de uma campanha
// Salvar em: src/components/CampanhaDispatchModal.js

import { SharedTable } from './SharedTable.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const CampanhaDispatchModal = {
    show({ campanhaId, campanhaNome }) {
        return new Promise((resolve) => {
            const API_BASE_URL = getApiBaseUrl();

            // Create overlay
            let container = document.getElementById('dispatch-modal-container');
            if (container) document.body.removeChild(container);

            container = document.createElement('div');
            container.id = 'dispatch-modal-container';
            container.className = 'wizard-overlay';
            Object.assign(container.style, {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 9999,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            });

            // Create modal content
            const content = document.createElement('div');
            content.className = 'wizard-content animate-float-in';
            Object.assign(content.style, {
                width: '90%',
                maxWidth: '1200px',
                height: '85vh',
                backgroundColor: 'white',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            });

            // Header
            const header = document.createElement('div');
            Object.assign(header.style, {
                padding: '1.5rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f9fafb'
            });

            header.innerHTML = `
                <div>
                    <h2 style="margin:0; color:var(--color-primary); font-size:1.5rem;">📊 Detalhes de Disparo</h2>
                    <p style="margin:0.5rem 0 0 0; color:#6b7280; font-size:0.9rem;">${campanhaNome}</p>
                </div>
                <button id="close-modal-btn" style="
                    background:transparent; border:none; font-size:1.5rem; 
                    cursor:pointer; color:#6b7280; padding:0.5rem;
                    transition: color 0.2s;">✕</button>
            `;

            // Table container
            const tableContainer = document.createElement('div');
            tableContainer.id = 'dispatch-details-table';
            Object.assign(tableContainer.style, {
                flex: '1',
                overflow: 'hidden',
                padding: '1rem'
            });

            // Footer with refresh info
            const footer = document.createElement('div');
            Object.assign(footer.style, {
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            });

            footer.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem; color:#6b7280; font-size:0.85rem;">
                    <span id="auto-refresh-indicator">🔄 Atualizando automaticamente a cada 5 segundos...</span>
                </div>
                <button id="manual-refresh-btn" class="btn-secondary" style="padding:0.5rem 1rem;">
                    🔄 Atualizar Agora
                </button>
            `;

            content.appendChild(header);
            content.appendChild(tableContainer);
            content.appendChild(footer);
            container.appendChild(content);
            document.body.appendChild(container);

            // Define columns for dispatch details table
            const columns = [
                {
                    key: 'nome',
                    label: 'Nome',
                    width: '30%',
                    sortable: true
                },
                {
                    key: 'email',
                    label: 'E-mail',
                    width: '25%',
                    sortable: true
                },
                {
                    key: 'telefone',
                    label: 'Telefone',
                    width: '15%',
                    sortable: true
                },
                {
                    key: 'status_email',
                    label: '📧 Status E-mail',
                    width: '15%',
                    render: (value) => {
                        if (value === 'sucesso') return '<span style="color:#10b981; font-weight:600;">✓ OK</span>';
                        if (value === 'falha') return '<span style="color:#ef4444; font-weight:600;">✗ Falha</span>';
                        return '<span style="color:#9ca3af;">○ Pendente</span>';
                    }
                },
                {
                    key: 'status_whatsapp',
                    label: '💬 Status WhatsApp',
                    width: '15%',
                    render: (value) => {
                        if (value === 'sucesso') return '<span style="color:#10b981; font-weight:600;">✓ OK</span>';
                        if (value === 'falha') return '<span style="color:#ef4444; font-weight:600;">✗ Falha</span>';
                        return '<span style="color:#9ca3af;">○ Pendente</span>';
                    }
                }
            ];

            // Load dispatch details
            let dispatchTable = null;
            let refreshInterval = null;

            const loadDispatchDetails = async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/marketing/campanhas/${campanhaId}/dispatch-details`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });

                    if (!response.ok) throw new Error('Erro ao carregar detalhes');

                    const leads = await response.json();

                    if (!dispatchTable) {
                        // Initialize table first time
                        dispatchTable = SharedTable.create({
                            containerId: 'dispatch-details-table',
                            data: leads,
                            columns: columns,
                            pageSize: 20,
                            showSearch: true,
                            searchPlaceholder: 'Buscar leads...',
                            emptyMessage: 'Nenhum lead encontrado para esta campanha'
                        });
                    } else {
                        // Update existing table
                        dispatchTable.updateData(leads);
                    }

                    console.log('✅ Detalhes de disparo carregados:', leads.length, 'leads');
                } catch (error) {
                    console.error('Erro ao carregar detalhes de disparo:', error);
                }
            };

            // Event handlers
            const closeModal = () => {
                if (refreshInterval) clearInterval(refreshInterval);
                if (document.body.contains(container)) {
                    document.body.removeChild(container);
                }
                resolve();
            };

            header.querySelector('#close-modal-btn').onclick = closeModal;
            footer.querySelector('#manual-refresh-btn').onclick = loadDispatchDetails;
            container.onclick = (e) => {
                if (e.target === container) closeModal();
            };

            // Initial load
            loadDispatchDetails();

            // Auto-refresh every 5 seconds
            refreshInterval = setInterval(loadDispatchDetails, 5000);

            console.log('📊 Modal de detalhes de disparo aberto para campanha:', campanhaId);
        });
    }
};
