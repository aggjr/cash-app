import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { GrupoModal } from './GrupoModal.js';

export const GruposLeadsManager = (project) => {
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

    let grupos = [];
    let sharedTable = null;

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Columns Configuration
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
                btnEdit.onclick = (e) => { e.stopPropagation(); updateGrupo(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteGrupo(item); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        { key: 'nome', label: 'Nome', width: 'auto', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: '30%', align: 'left', type: 'text' },
        {
            key: 'total_leads_diretos',
            label: 'Leads',
            width: '100px',
            align: 'center',
            type: 'number',
            render: (item) => {
                const badge = document.createElement('span');
                badge.className = 'badge-info';
                badge.style.backgroundColor = 'var(--color-primary-light)';
                badge.style.color = 'var(--color-primary)';
                badge.style.padding = '2px 8px';
                badge.style.borderRadius = '12px';
                badge.style.fontSize = '0.85rem';
                badge.innerHTML = `👤 ${item.total_leads_diretos || 0}`;
                return badge;
            }
        },
        {
            key: 'total_caracteristicas',
            label: 'Características',
            width: '120px',
            align: 'center',
            type: 'number',
            render: (item) => {
                const badge = document.createElement('span');
                badge.className = 'badge-success';
                badge.style.backgroundColor = '#10b98120';
                badge.style.color = '#059669';
                badge.style.padding = '2px 8px';
                badge.style.borderRadius = '12px';
                badge.style.fontSize = '0.85rem';
                badge.innerHTML = `🏷️ ${item.total_caracteristicas || 0}`;
                return badge;
            }
        }
    ];

    const loadData = async () => {
        try {
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.add('loading');
            }

            const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads`, {
                headers: getHeaders()
            });

            if (!response.ok) throw new Error('Falha ao carregar grupos');

            grupos = await response.json();

            if (sharedTable) {
                sharedTable.render(grupos);
            }
            updateFooter();

        } catch (error) {
            console.error('Error loading groups:', error);
            showToast(error.message, 'error');
        } finally {
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.remove('loading');
            }
        }
    };

    const updateFooter = () => {
        const totalCount = container.querySelector('#total-count');
        if (totalCount) {
            totalCount.textContent = grupos.length;
        }
    };

    const createGrupo = async () => {
        await GrupoModal.show({
            grupo: null,
            onSave: async (grupoData) => {
                const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(grupoData)
                });

                if (response.ok) {
                    showToast('Grupo criado com sucesso!', 'success');
                    loadData();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao criar grupo');
                }
            }
        });
    };

    const updateGrupo = async (grupo) => {
        await GrupoModal.show({
            grupo: grupo,
            onSave: async (grupoData) => {
                const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${grupo.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(grupoData)
                });

                if (response.ok) {
                    showToast('Grupo atualizado com sucesso!', 'success');
                    loadData();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao atualizar grupo');
                }
            }
        });
    };

    const deleteGrupo = async (grupo) => {
        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir o grupo "${grupo.nome}"?`,
            'Sim, Excluir'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${grupo.id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Grupo excluído com sucesso!', 'success');
                loadData();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir grupo: ' + error.error, 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    // Custom confirmation dialog (Standardized)
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
            <h2>👥 Grupos de Leads</h2>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new-grupo" class="btn-primary">+ Novo Grupo</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden;"></div>
        
        <div id="footer-summary" style="margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted);">
            Total: <span id="total-count">0</span> grupo(s)
        </div>
    `;

    // Event Listeners
    container.querySelector('#btn-new-grupo').addEventListener('click', createGrupo);

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
    loadData();

    return container;
};
