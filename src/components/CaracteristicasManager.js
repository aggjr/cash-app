import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { Dialogs } from './Dialogs.js';

export const CaracteristicasManager = (project) => {
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

    let caracteristicas = [];
    let sharedTable = null;

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const columns = [
        { key: 'nome', label: 'Nome', width: 'auto', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: '300px', align: 'left', type: 'text' },
        {
            key: 'total_grupos',
            label: 'Grupos',
            width: '100px',
            align: 'center',
            type: 'number',
            render: (item) => {
                const badge = document.createElement('span');
                badge.className = 'badge-info';
                badge.textContent = `${item.total_grupos || 0} grupo(s)`;
                badge.style.padding = '0.25rem 0.5rem';
                badge.style.borderRadius = '4px';
                badge.style.fontSize = '0.85rem';
                return badge;
            }
        },
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
                btnEdit.onclick = (e) => { e.stopPropagation(); editCaracteristica(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteCaracteristica(item); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        }
    ];

    const loadCaracteristicas = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/marketing/caracteristicas`, {
                headers: getHeaders()
            });

            if (response.ok) {
                caracteristicas = await response.json();
                if (sharedTable) {
                    sharedTable.render(caracteristicas);
                }
                updateFooter();
            } else {
                showToast('Erro ao carregar características', 'error');
            }
        } catch (error) {
            console.error('Error loading características:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    const updateFooter = () => {
        const totalCount = container.querySelector('#total-count');
        if (totalCount) {
            totalCount.textContent = caracteristicas.length;
        }
    };

    const showCaracteristicaModal = (caracteristica = null) => {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>${caracteristica ? '✏️ Editar' : '➕ Nova'} Característica</h3>
                        <button class="modal-close" id="modal-close">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="nome">Nome <span style="color: red;">*</span></label>
                            <input type="text" id="nome" class="form-control" value="${caracteristica?.nome || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="descricao">Descrição</label>
                            <textarea id="descricao" class="form-control" rows="3">${caracteristica?.descricao || ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" id="btn-cancel">Cancelar</button>
                        <button class="btn-primary" id="btn-save">Salvar</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const nomeInput = modal.querySelector('#nome');
            const descricaoInput = modal.querySelector('#descricao');

            const close = () => {
                document.body.removeChild(modal);
                resolve(null);
            };

            const save = () => {
                const nome = nomeInput.value.trim();

                // Validação
                if (!nome) {
                    nomeInput.style.borderColor = 'red';
                    showToast('Nome é obrigatório', 'error');
                    return;
                }

                const data = {
                    nome,
                    descricao: descricaoInput.value.trim() || null
                };

                document.body.removeChild(modal);
                resolve(data);
            };

            modal.querySelector('#modal-close').onclick = close;
            modal.querySelector('#btn-cancel').onclick = close;
            modal.querySelector('#btn-save').onclick = save;
            modal.onclick = (e) => { if (e.target === modal) close(); };

            // Focus no primeiro campo
            setTimeout(() => nomeInput.focus(), 100);
        });
    };

    const createCaracteristica = async () => {
        const data = await showCaracteristicaModal();
        if (!data) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/caracteristicas`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Característica criada com sucesso!', 'success');
                loadCaracteristicas();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao criar característica', 'error');
            }
        } catch (error) {
            console.error('Error creating característica:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    const editCaracteristica = async (caracteristica) => {
        const data = await showCaracteristicaModal(caracteristica);
        if (!data) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/caracteristicas/${caracteristica.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Característica atualizada com sucesso!', 'success');
                loadCaracteristicas();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao atualizar característica', 'error');
            }
        } catch (error) {
            console.error('Error updating característica:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    const deleteCaracteristica = async (caracteristica) => {
        const confirmed = await Dialogs.confirm(
            `Tem certeza que deseja excluir a característica "${caracteristica.nome}"?`,
            'Confirmar Exclusão'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/caracteristicas/${caracteristica.id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Característica excluída com sucesso!', 'success');
                loadCaracteristicas();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir característica', 'error');
            }
        } catch (error) {
            console.error('Error deleting característica:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    // UI Setup
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>🏷️ Características</h2>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new" class="btn-primary">+ Nova Característica</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden;"></div>
        
        <div id="footer-summary" style="margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted);">
            Total: <span id="total-count">0</span> característica(s)
        </div>
    `;

    // Event Listeners
    container.querySelector('#btn-new').addEventListener('click', createCaracteristica);

    // Initialize SharedTable
    const tableContainer = container.querySelector('#table-container');
    const footerElement = container.querySelector('#footer-summary');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        data: [],
        footer: footerElement
    });

    // Initial Load
    loadCaracteristicas();

    return container;
};
