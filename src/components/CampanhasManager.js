import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { CampanhaModal } from './CampanhaModal.js';

import { CampanhaWizard } from './CampanhaWizard.js';

export const CampanhasManager = (project) => {
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

    let campanhas = [];
    let sharedTable = null;

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        // Ajuste para timezone local se necessário ou apenas split
        // Vamos usar split para pegar a data YYYY-MM-DD e mostrar DD/MM/YYYY
        // Supondo que venha como string ISO
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        } catch (e) {
            return dateString;
        }
    };

    const columns = [
        {
            key: 'actions',
            label: 'Ações',
            width: '80px',
            align: 'center',
            noFilter: true,
            sticky: true,
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
                btnEdit.onclick = (e) => { e.stopPropagation(); updateCampanha(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteCampanha(item); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        { key: 'nome', label: 'Nome', width: 'auto', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: '25%', align: 'left', type: 'text' },
        {
            key: 'data_inicio',
            label: 'Início',
            width: '100px',
            align: 'center',
            type: 'date',
            render: (item) => {
                const span = document.createElement('span');
                span.textContent = formatDate(item.data_inicio);
                return span;
            }
        },
        {
            key: 'data_fim',
            label: 'Fim',
            width: '100px',
            align: 'center',
            type: 'date',
            render: (item) => {
                const span = document.createElement('span');
                span.textContent = formatDate(item.data_fim);
                return span;
            }
        },
        {
            key: 'status',
            label: 'Status',
            width: '120px',
            align: 'center',
            type: 'text',
            render: (item) => {
                const statusMap = {
                    'planejamento': { label: 'Planejamento', class: 'badge-info', color: '#3b82f6', bg: '#eff6ff' },
                    'ativa': { label: 'Ativa', class: 'badge-success', color: '#10b981', bg: '#ecfdf5' },
                    'pausada': { label: 'Pausada', class: 'badge-warning', color: '#f59e0b', bg: '#fffbeb' },
                    'concluida': { label: 'Concluída', class: 'badge-secondary', color: '#6b7280', bg: '#f3f4f6' },
                    'cancelada': { label: 'Cancelada', class: 'badge-danger', color: '#ef4444', bg: '#fef2f2' }
                };
                const status = statusMap[item.status] || statusMap['planejamento'];
                const badge = document.createElement('span');
                // Custom styles for better look
                badge.style.backgroundColor = status.bg;
                badge.style.color = status.color;
                badge.style.padding = '4px 10px';
                badge.style.borderRadius = '20px';
                badge.style.fontSize = '0.8rem';
                badge.style.fontWeight = '600';
                badge.style.display = 'inline-block';
                badge.textContent = status.label;
                return badge;
            }
        },
        {
            key: 'total_leads',
            label: 'Leads',
            width: '80px',
            align: 'center',
            type: 'number',
            render: (item) => {
                const badge = document.createElement('span');
                badge.className = 'badge-info';
                badge.textContent = item.total_leads || 0;
                // Reuse style from GruposLeads for consistency
                badge.style.backgroundColor = 'var(--color-primary-light)';
                badge.style.color = 'var(--color-primary)';
                badge.style.padding = '2px 8px';
                badge.style.borderRadius = '12px';
                badge.style.fontSize = '0.85rem';
                return badge;
            }
        }
    ];

    const loadCampanhas = async () => {
        try {
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.add('loading');
            }

            const response = await fetch(`${API_BASE_URL}/marketing/campanhas`, {
                headers: getHeaders()
            });

            if (response.ok) {
                campanhas = await response.json();
                if (sharedTable) {
                    sharedTable.render(campanhas);
                }
                updateFooter();
            } else {
                throw new Error('Falha ao carregar campanhas');
            }
        } catch (error) {
            console.error('Error loading campanhas:', error);
            showToast('Erro de conexão', 'error');
        } finally {
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.remove('loading');
            }
        }
    };

    const updateFooter = () => {
        const totalCount = container.querySelector('#total-count');
        if (totalCount) {
            totalCount.textContent = campanhas.length;
        }
    };

    const createCampanha = async () => {
        // Use Wizard for creation
        await CampanhaWizard.show({
            onSave: async (data) => {
                // Determine API endpoint and payload
                // Wizard sends { ...config, leadsIds, message }
                // Controller expects this flat structure (leadsIds inside body) which Wizard provides

                const response = await fetch(`${API_BASE_URL}/marketing/campanhas`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showToast('Campanha criada com sucesso!', 'success');
                    loadCampanhas();
                    return await response.json(); // Return created campaign data
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao criar campanha');
                }
            }
        });
    };

    const updateCampanha = async (campanha) => {
        await CampanhaModal.show({
            campanha: campanha,
            onSave: async (data) => {
                const response = await fetch(`${API_BASE_URL}/marketing/campanhas/${campanha.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showToast('Campanha atualizada com sucesso!', 'success');
                    loadCampanhas();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao atualizar campanha');
                }
            }
        });
    };

    const deleteCampanha = async (campanha) => {
        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir a campanha "${campanha.nome}"?`,
            'Sim, Excluir'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/campanhas/${campanha.id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Campanha excluída com sucesso!', 'success');
                loadCampanhas();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir campanha', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    // Standard Custom Confirm
    const showCustomConfirm = (message, confirmText = 'Sim') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.position = 'fixed';
            overlay.id = 'confirm-dialog-overlay'; // Unique ID to avoid conflicts if needed
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
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
                resolve(result);
            };

            box.querySelector('#confirm-yes').onclick = () => cleanup(true);
            box.querySelector('#confirm-no').onclick = () => cleanup(false);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
        });
    };

    // State for selection
    let selectedItems = new Set();
    let selectedItemsData = [];

    const handleBulkDelete = async () => {
        if (selectedItems.size === 0) return;

        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir ${selectedItems.size} campanhas?`,
            'Sim, Excluir'
        );

        if (!confirmed) return;

        try {
            // Sequential delete for now as API might not have bulk endpoint
            // Or use Promise.all
            container.querySelector('#table-container').classList.add('loading');

            const promises = Array.from(selectedItems).map(id =>
                fetch(`${API_BASE_URL}/marketing/campanhas/${id}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                })
            );

            await Promise.all(promises);

            showToast(`${selectedItems.size} campanhas excluídas com sucesso!`, 'success');
            selectedItems.clear();
            selectedItemsData = [];
            if (sharedTable) sharedTable.clearSelection();
            loadCampanhas();
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir campanhas', 'error');
        } finally {
            container.querySelector('#table-container').classList.remove('loading');
        }
    };

    const handleBulkEdit = async () => {
        if (selectedItems.size === 0) return;
        showToast('Edição em massa de campanhas será implementada em breve.', 'info');
    };

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>📢 Campanhas</h2>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new" class="btn-primary">+ Nova Campanha</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;"></div>
    `;

    container.querySelector('#btn-new').addEventListener('click', createCampanha);

    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        projectId: project.id, // Ensure projectId is passed if needed
        enableSelection: true,
        onSelectionChange: (items, ids) => {
            selectedItems = Array.isArray(ids) ? new Set(ids) : ids;
            selectedItemsData = items;
        },
        onBulkDelete: handleBulkDelete,
        onBulkEdit: handleBulkEdit
    });

    loadCampanhas();

    return container;
};
