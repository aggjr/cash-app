import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { Dialogs } from './Dialogs.js';

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
        { key: 'descricao', label: 'Descrição', width: '250px', align: 'left', type: 'text' },
        {
            key: 'total_leads_diretos',
            label: 'Leads',
            width: '100px',
            align: 'center',
            type: 'number',
            render: (item) => {
                const badge = document.createElement('span');
                badge.className = 'badge-info';
                badge.textContent = `${item.total_leads_diretos || 0}`;
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
                badge.textContent = `${item.total_caracteristicas || 0}`;
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
                btnEdit.onclick = (e) => { e.stopPropagation(); editGrupo(item); };

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
        }
    ];

    const loadData = async () => {
        try {
            const [gruposRes, caracRes] = await Promise.all([
                fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/marketing/caracteristicas`, { headers: getHeaders() })
            ]);

            if (gruposRes.ok && caracRes.ok) {
                grupos = await gruposRes.json();
                caracteristicas = await caracRes.json();
                if (sharedTable) {
                    sharedTable.render(grupos);
                }
                updateFooter();
            }
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    const updateFooter = () => {
        const totalCount = container.querySelector('#total-count');
        if (totalCount) {
            totalCount.textContent = grupos.length;
        }
    };

    const showGrupoModal = (grupo = null) => {
        return new Promise(async (resolve) => {
            // Carregar características do grupo se estiver editando
            let grupoCaracteristicas = [];
            if (grupo) {
                try {
                    const res = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${grupo.id}/caracteristicas`, {
                        headers: getHeaders()
                    });
                    if (res.ok) {
                        const data = await res.json();
                        grupoCaracteristicas = data.filter(c => c.origem === 'direto').map(c => c.id);
                    }
                } catch (error) {
                    console.error('Error loading group characteristics:', error);
                }
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>${grupo ? '✏️ Editar' : '➕ Novo'} Grupo de Leads</h3>
                        <button class="modal-close" id="modal-close">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="nome">Nome <span style="color: red;">*</span></label>
                            <input type="text" id="nome" class="form-control" value="${grupo?.nome || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="descricao">Descrição</label>
                            <textarea id="descricao" class="form-control" rows="2">${grupo?.descricao || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Características</label>
                            <div id="caracteristicas-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 4px; padding: 0.5rem;">
                                ${caracteristicas.map(c => `
                                    <label style="display: block; padding: 0.25rem;">
                                        <input type="checkbox" value="${c.id}" ${grupoCaracteristicas.includes(c.id) ? 'checked' : ''}>
                                        ${c.nome}
                                    </label>
                                `).join('')}
                                ${caracteristicas.length === 0 ? '<p style="color: var(--color-text-muted); font-style: italic;">Nenhuma característica cadastrada</p>' : ''}
                            </div>
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
            const caracteristicasList = modal.querySelector('#caracteristicas-list');

            const close = () => {
                document.body.removeChild(modal);
                resolve(null);
            };

            const save = () => {
                const nome = nomeInput.value.trim();

                if (!nome) {
                    nomeInput.style.borderColor = 'red';
                    showToast('Nome é obrigatório', 'error');
                    return;
                }

                const selectedCaracteristicas = Array.from(caracteristicasList.querySelectorAll('input[type="checkbox"]:checked'))
                    .map(cb => parseInt(cb.value));

                const data = {
                    nome,
                    descricao: descricaoInput.value.trim() || null,
                    caracteristicas: selectedCaracteristicas
                };

                document.body.removeChild(modal);
                resolve(data);
            };

            modal.querySelector('#modal-close').onclick = close;
            modal.querySelector('#btn-cancel').onclick = close;
            modal.querySelector('#btn-save').onclick = save;
            modal.onclick = (e) => { if (e.target === modal) close(); };

            setTimeout(() => nomeInput.focus(), 100);
        });
    };

    const createGrupo = async () => {
        const data = await showGrupoModal();
        if (!data) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Grupo criado com sucesso!', 'success');
                loadData();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao criar grupo', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const editGrupo = async (grupo) => {
        const data = await showGrupoModal(grupo);
        if (!data) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${grupo.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Grupo atualizado com sucesso!', 'success');
                loadData();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao atualizar grupo', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const deleteGrupo = async (grupo) => {
        const confirmed = await Dialogs.confirm(
            `Tem certeza que deseja excluir o grupo "${grupo.nome}"?`,
            'Confirmar Exclusão'
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
                showToast(error.error || 'Erro ao excluir grupo', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>👥 Grupos de Leads</h2>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new" class="btn-primary">+ Novo Grupo</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden;"></div>
        
        <div id="footer-summary" style="margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted);">
            Total: <span id="total-count">0</span> grupo(s)
        </div>
    `;

    container.querySelector('#btn-new').addEventListener('click', createGrupo);

    const tableContainer = container.querySelector('#table-container');
    const footerElement = container.querySelector('#footer-summary');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        data: [],
        footer: footerElement
    });

    loadData();

    return container;
};
