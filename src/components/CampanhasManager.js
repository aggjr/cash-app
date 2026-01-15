import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { Dialogs } from './Dialogs.js';

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
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    const columns = [
        { key: 'nome', label: 'Nome', width: 'auto', align: 'left', type: 'text' },
        { key: 'descricao', label: 'Descrição', width: '200px', align: 'left', type: 'text' },
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
                    'planejamento': { label: 'Planejamento', class: 'badge-info' },
                    'ativa': { label: 'Ativa', class: 'badge-success' },
                    'pausada': { label: 'Pausada', class: 'badge-warning' },
                    'concluida': { label: 'Concluída', class: 'badge-secondary' },
                    'cancelada': { label: 'Cancelada', class: 'badge-danger' }
                };
                const status = statusMap[item.status] || statusMap['planejamento'];
                const badge = document.createElement('span');
                badge.className = status.class;
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
                btnEdit.onclick = (e) => { e.stopPropagation(); editCampanha(item); };

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
        }
    ];

    const loadCampanhas = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/marketing/campanhas`, {
                headers: getHeaders()
            });

            if (response.ok) {
                campanhas = await response.json();
                if (sharedTable) {
                    sharedTable.render(campanhas);
                }
                updateFooter();
            }
        } catch (error) {
            console.error('Error loading campanhas:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    const updateFooter = () => {
        const totalCount = container.querySelector('#total-count');
        if (totalCount) {
            totalCount.textContent = campanhas.length;
        }
    };

    const showCampanhaModal = (campanha = null) => {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>${campanha ? '✏️ Editar' : '➕ Nova'} Campanha</h3>
                        <button class="modal-close" id="modal-close">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="nome">Nome <span style="color: red;">*</span></label>
                            <input type="text" id="nome" class="form-control" value="${campanha?.nome || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="descricao">Descrição</label>
                            <textarea id="descricao" class="form-control" rows="3">${campanha?.descricao || ''}</textarea>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label for="dataInicio">Data Início</label>
                                <input type="date" id="dataInicio" class="form-control" value="${campanha?.data_inicio || ''}">
                            </div>
                            <div class="form-group">
                                <label for="dataFim">Data Fim</label>
                                <input type="date" id="dataFim" class="form-control" value="${campanha?.data_fim || ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="status">Status</label>
                            <select id="status" class="form-control">
                                <option value="planejamento" ${campanha?.status === 'planejamento' ? 'selected' : ''}>Planejamento</option>
                                <option value="ativa" ${campanha?.status === 'ativa' ? 'selected' : ''}>Ativa</option>
                                <option value="pausada" ${campanha?.status === 'pausada' ? 'selected' : ''}>Pausada</option>
                                <option value="concluida" ${campanha?.status === 'concluida' ? 'selected' : ''}>Concluída</option>
                                <option value="cancelada" ${campanha?.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
                            </select>
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
            const dataInicioInput = modal.querySelector('#dataInicio');
            const dataFimInput = modal.querySelector('#dataFim');
            const statusSelect = modal.querySelector('#status');

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

                const data = {
                    nome,
                    descricao: descricaoInput.value.trim() || null,
                    dataInicio: dataInicioInput.value || null,
                    dataFim: dataFimInput.value || null,
                    status: statusSelect.value
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

    const createCampanha = async () => {
        const data = await showCampanhaModal();
        if (!data) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/campanhas`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Campanha criada com sucesso!', 'success');
                loadCampanhas();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao criar campanha', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const editCampanha = async (campanha) => {
        const data = await showCampanhaModal(campanha);
        if (!data) return;

        try {
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
                showToast(error.error || 'Erro ao atualizar campanha', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const deleteCampanha = async (campanha) => {
        const confirmed = await Dialogs.confirm(
            `Tem certeza que deseja excluir a campanha "${campanha.nome}"?`,
            'Confirmar Exclusão'
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

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>📢 Campanhas</h2>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new" class="btn-primary">+ Nova Campanha</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden;"></div>
        
        <div id="footer-summary" style="margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted);">
            Total: <span id="total-count">0</span> campanha(s)
        </div>
    `;

    container.querySelector('#btn-new').addEventListener('click', createCampanha);

    const tableContainer = container.querySelector('#table-container');
    const footerElement = container.querySelector('#footer-summary');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        data: [],
        footer: footerElement
    });

    loadCampanhas();

    return container;
};
