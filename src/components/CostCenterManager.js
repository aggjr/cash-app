import { CostCenterModal } from './CostCenterModal.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { Dialogs } from './Dialogs.js';

export const CostCenterManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.height = 'calc(100vh - 150px)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    const loadItems = async () => {
        try {
            container.querySelector('.table-wrapper')?.classList.add('loading');
            const token = localStorage.getItem('token');

            const response = await fetch(`${API_BASE_URL}/cost-centers?projectId=${project.id}`, { headers: getHeaders() });
            const items = await response.json();

            renderItems(items);
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Erro ao carregar dados', 'error');
        }
    };

    const createItem = async () => {
        CostCenterModal.show({
            costCenter: null,
            onSave: async (data) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/cost-centers`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            ...data,
                            projectId: project.id
                        })
                    });

                    if (response.ok) {
                        showToast('Centro de Custo criado com sucesso!', 'success');
                        loadItems();
                    } else {
                        showToast('Erro ao criar centro de custo', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const updateItem = async (item) => {
        CostCenterModal.show({
            costCenter: item,
            onSave: async (data) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/cost-centers/${item.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify(data)
                    });

                    if (response.ok) {
                        showToast('Atualizado com sucesso!', 'success');
                        loadItems();
                    } else {
                        showToast('Erro ao atualizar', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const deleteItem = async (id, name) => {
        if (!await Dialogs.confirm(`Tem certeza que deseja excluir "${name}"?`, 'Excluir Centro de Custo')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/cost-centers/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            const result = await response.json();

            if (response.ok) {
                if (result.type === 'soft') {
                    showToast('Centro de Custo inativado (já utilizado).', 'info');
                } else {
                    showToast('Centro de Custo excluído.', 'success');
                }
                loadItems();
            } else {
                showToast('Erro ao excluir', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const renderItems = (items) => {
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>🏢 Centros de Custo</h2>
                <div style="display: flex; gap: 0.5rem;">
                     <a href="#" style="font-size: 0.9rem; color: var(--color-primary);">Cadastros</a>
                     <span style="color: var(--color-text-muted);">/</span>
                     <span style="font-size: 0.9rem; color: var(--color-text-muted);">Centros de Custo</span>
                </div>
            </div>

            <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
                <button id="btn-new" class="btn-primary">+ Novo Centro de Custo</button>
            </div>

            <div class="table-wrapper" style="flex: 1; overflow: auto; border: 1px solid var(--color-border-light); border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead class="sticky-header">
                        <tr>
                            <th style="text-align: left; padding: var(--table-row-padding); font-size: 1rem;">Nome</th>
                            <th style="text-align: left; padding: var(--table-row-padding); font-size: 1rem;">Descrição</th>
                            <th style="text-align: center; padding: var(--table-row-padding); font-size: 1rem;">Status</th>
                            <th style="text-align: center; padding: var(--table-row-padding); font-size: 1rem;">Criado em</th>
                            <th style="text-align: center; padding: var(--table-row-padding); font-size: 1rem;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
            return `
                            <tr class="hoverable-row" style="border-bottom: 1px solid var(--color-border-light); background-color: ${bgColor}; transition: background 0.2s;">
                                <td style="padding: var(--table-row-padding); font-size: 0.9rem; font-weight: 500;">
                                    ${item.name}
                                </td>
                                <td style="padding: var(--table-row-padding); font-size: 0.9rem; color: var(--color-text-muted);">
                                    ${item.description || '-'}
                                </td>
                                <td style="padding: var(--table-row-padding); text-align: center;">
                                    <span class="badge-${item.active ? 'active' : 'inactive'}">
                                        ${item.active ? '✓ Ativo' : '✕ Inativo'}
                                    </span>
                                </td>
                                <td style="padding: var(--table-row-padding); font-size: 0.85rem; text-align: center; color: var(--color-text-muted);">
                                    ${formatDate(item.created_at)}
                                </td>
                                <td style="padding: var(--table-row-padding); text-align: center;">
                                    <div style="display: flex; gap: 0.5rem; justify-content: center;">
                                        <button class="btn-edit" data-id="${item.id}" style="color: #10B981; font-size: 1.2rem; background: none; border: none; cursor: pointer; transition: transform 0.2s;" 
                                            onmouseover="this.style.transform='scale(1.2)'" 
                                            onmouseout="this.style.transform='scale(1)'">✏️</button>
                                        <button class="btn-delete" data-id="${item.id}" style="color: #EF4444; font-size: 1.2rem; background: none; border: none; cursor: pointer; transition: transform 0.2s;" 
                                            onmouseover="this.style.transform='scale(1.2)'" 
                                            onmouseout="this.style.transform='scale(1)'">🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                        ${items.length === 0 ? `
                            <tr>
                                <td colspan="5" style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                                    <div style="font-size: 1.1rem;">Nenhum centro de custo cadastrado</div>
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--color-text-muted);">
                <div>Total: ${items.length}</div>
            </div>
        `;

        container.querySelector('#btn-new').addEventListener('click', createItem);

        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = items.find(i => i.id == btn.dataset.id);
                updateItem(item);
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = items.find(i => i.id == btn.dataset.id);
                deleteItem(item.id, item.name);
            });
        });
    };

    loadItems();

    return container;
};
