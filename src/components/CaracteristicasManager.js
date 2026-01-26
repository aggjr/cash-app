import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { CaracteristicaModal } from './CaracteristicaModal.js';

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
                btnEdit.onclick = (e) => { e.stopPropagation(); updateCaracteristica(item); };

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
        },
        { key: 'nome', label: 'Nome', width: '20%', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: '25%', align: 'left', type: 'text' },
        {
            key: 'valores',
            label: 'Valores Possíveis',
            width: 'auto',
            align: 'left',
            render: (item) => {
                if (!item.valores || !Array.isArray(item.valores)) return '-';
                // Handle both object {valor: ...} and string formats
                return item.valores.map(v => v.valor || v).join(' | ');
            }
        }
    ];

    const loadCaracteristicas = async () => {
        try {
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.add('loading');
            }

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
                throw new Error('Erro ao carregar características');
            }
        } catch (error) {
            console.error('Error loading características:', error);
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
            totalCount.textContent = caracteristicas.length;
        }
    };

    const createCaracteristica = async () => {
        await CaracteristicaModal.show({
            caracteristica: null,
            onSave: async (data) => {
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
                    throw new Error(error.error || 'Erro ao criar característica');
                }
            }
        });
    };

    const updateCaracteristica = async (caracteristica) => {
        await CaracteristicaModal.show({
            caracteristica: caracteristica,
            onSave: async (data) => {
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
                    throw new Error(error.error || 'Erro ao atualizar característica');
                }
            }
        });
    };

    const deleteCaracteristica = async (caracteristica) => {
        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir a característica "${caracteristica.nome}"?`,
            'Sim, Excluir'
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
            showToast('Erro de conexão', 'error');
        }
    };

    const showCustomConfirm = (message, confirmText = 'Sim') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.position = 'fixed';
            overlay.id = 'confirm-dialog-overlay';
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

    const handleBulkDelete = async () => {
        if (selectedItems.size === 0) return;

        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir ${selectedItems.size} características?`,
            'Sim, Excluir'
        );

        if (!confirmed) return;

        try {
            // Check usage before delete? Use API.
            // Assuming strict delete or API handles integrity.

            container.querySelector('#table-container').classList.add('loading');

            const promises = Array.from(selectedItems).map(id =>
                fetch(`${API_BASE_URL}/marketing/caracteristicas/${id}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                })
            );

            await Promise.all(promises);

            showToast(`${selectedItems.size} características excluídas com sucesso!`, 'success');
            selectedItems.clear();
            if (sharedTable) sharedTable.clearSelection();
            loadCaracteristicas();
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir características', 'error');
        } finally {
            container.querySelector('#table-container').classList.remove('loading');
        }
    };

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>🏷️ Características</h2>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new" class="btn-primary">+ Nova Característica</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;"></div>
    `;

    container.querySelector('#btn-new').addEventListener('click', createCaracteristica);

    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        data: [],
        enableSelection: true,
        onSelectionChange: (items, ids) => {
            selectedItems = Array.isArray(ids) ? new Set(ids) : ids;
        },
        onBulkDelete: handleBulkDelete
    });

    loadCaracteristicas();

    return container;
};
