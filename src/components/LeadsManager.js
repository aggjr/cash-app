import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { LeadModal } from './LeadModal.js';

export const LeadsManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '1rem';
    container.style.margin = '0.5rem';
    container.style.height = 'calc(100vh - 60px)';
    container.style.width = 'calc(100% - 1rem)';
    container.style.maxWidth = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    let leads = [];
    let sharedTable = null;

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Define Columns for SharedTable
    const columns = [
        {
            key: 'actions',
            label: 'Ações',
            width: '80px',
            align: 'center',
            noFilter: true,
            render: (item) => {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.gap = '0.5rem';
                div.style.justifyContent = 'center';

                const btnEdit = document.createElement('button');
                btnEdit.innerHTML = '✏️';
                btnEdit.title = 'Editar';
                btnEdit.style.background = 'none';
                btnEdit.style.border = 'none';
                btnEdit.style.cursor = 'pointer';
                btnEdit.style.fontSize = '1.1rem';
                btnEdit.onclick = (e) => { e.stopPropagation(); updateLead(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteLead(item.id, item.nome); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        { key: 'nome', label: 'Nome', width: 'auto', align: 'left', type: 'text' },
        { key: 'email', label: 'E-mail', width: '200px', align: 'left', type: 'text' },
        { key: 'telefone', label: 'Telefone', width: '150px', align: 'left', type: 'text' },
        { key: 'grupo_nome', label: 'Grupo', width: '150px', align: 'left', type: 'text' }
    ];

    const loadLeads = async () => {
        try {
            // Show loading state if table exists
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.add('loading');
            }

            const response = await fetch(`${API_BASE_URL}/marketing/leads`, {
                headers: getHeaders()
            });

            if (!response.ok) throw new Error('Falha ao carregar leads');

            leads = await response.json();
            renderLeads();

        } catch (error) {
            console.error('Error loading leads:', error);
            showToast(error.message, 'error');
        } finally {
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.remove('loading');
            }
        }
    };

    const renderLeads = () => {
        if (sharedTable) {
            sharedTable.render(leads);
        }
        updateFooter();
    };

    const updateFooter = () => {
        const totalCount = container.querySelector('#total-count');
        if (totalCount) {
            totalCount.textContent = leads.length;
        }
    };

    const createLead = async () => {
        await LeadModal.show({
            lead: null,
            onSave: async (leadData) => {
                const response = await fetch(`${API_BASE_URL}/marketing/leads`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(leadData)
                });

                if (response.ok) {
                    showToast('Lead criado com sucesso!', 'success');
                    loadLeads();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao criar lead');
                }
            }
        });
    };

    const updateLead = async (lead) => {
        await LeadModal.show({
            lead: lead,
            onSave: async (leadData) => {
                const response = await fetch(`${API_BASE_URL}/marketing/leads/${lead.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(leadData)
                });

                if (response.ok) {
                    showToast('Lead atualizado com sucesso!', 'success');
                    loadLeads();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao atualizar lead');
                }
            }
        });
    };

    const deleteLead = async (id, nome) => {
        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir "${nome}"?`,
            'Sim, Excluir'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/leads/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Lead excluído com sucesso!', 'success');
                loadLeads();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir lead', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    // Custom confirmation dialog
    const showCustomConfirm = (message, confirmText = 'Sim') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.background = 'rgba(0,0,0,0.4)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '100000';

            const box = document.createElement('div');
            box.style.background = 'white';
            box.style.padding = '24px';
            box.style.borderRadius = '12px';
            box.style.maxWidth = '400px';
            box.style.width = '90%';
            box.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
            box.style.textAlign = 'center';

            box.innerHTML = `
                <h3 style="margin: 0 0 16px 0; color: var(--color-primary); font-size: 1.25rem;">Confirmação</h3>
                <p style="margin: 0 0 24px 0; color: #555; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="confirm-no" style="
                        background: transparent; border: 1px solid #ccc; padding: 8px 16px; 
                        border-radius: 6px; cursor: pointer; color: #555; font-weight: 500;">
                        Não
                    </button>
                    <button id="confirm-yes" style="
                        background: var(--color-primary); border: none; padding: 8px 16px; 
                        border-radius: 6px; cursor: pointer; color: white; font-weight: 500;">
                        ${confirmText}
                    </button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const cleanup = (result) => {
                document.body.removeChild(overlay);
                resolve(result);
            };

            box.querySelector('#confirm-yes').onclick = () => cleanup(true);
            box.querySelector('#confirm-no').onclick = () => cleanup(false);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
        });
    };

    // Build UI
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>🎯 Leads</h2>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new-lead" class="btn-primary">+ Novo Lead</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden;"></div>
        
        <div id="footer-summary" style="margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted);">
            Total: <span id="total-count">0</span> lead(s)
        </div>
    `;

    // Event Listeners
    container.querySelector('#btn-new-lead').addEventListener('click', createLead);

    // Initialize SharedTable
    const tableContainer = container.querySelector('#table-container');
    const footerElement = container.querySelector('#footer-summary');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        data: [],
        footer: footerElement
    });

    // Load data
    loadLeads();

    return container;
};
