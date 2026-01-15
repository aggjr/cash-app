import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { Dialogs } from './Dialogs.js';

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
    let grupos = [];
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
        { key: 'email', label: 'E-mail', width: '200px', align: 'left', type: 'text' },
        { key: 'telefone', label: 'Telefone', width: '150px', align: 'left', type: 'text' },
        { key: 'grupo_nome', label: 'Grupo', width: '150px', align: 'left', type: 'text' },
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
                btnEdit.onclick = (e) => { e.stopPropagation(); editLead(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteLead(item); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        }
    ];

    const loadData = async () => {
        try {
            const [leadsRes, gruposRes] = await Promise.all([
                fetch(`${API_BASE_URL}/marketing/leads`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: getHeaders() })
            ]);

            if (leadsRes.ok && gruposRes.ok) {
                leads = await leadsRes.json();
                grupos = await gruposRes.json();
                if (sharedTable) {
                    sharedTable.render(leads);
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
            totalCount.textContent = leads.length;
        }
    };

    const showLeadModal = (lead = null) => {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>${lead ? '✏️ Editar' : '➕ Novo'} Lead</h3>
                        <button class="modal-close" id="modal-close">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="nome">Nome <span style="color: red;">*</span></label>
                            <input type="text" id="nome" class="form-control" value="${lead?.nome || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="email">E-mail</label>
                            <input type="email" id="email" class="form-control" value="${lead?.email || ''}">
                        </div>
                        <div class="form-group">
                            <label for="telefone">Telefone</label>
                            <input type="tel" id="telefone" class="form-control" value="${lead?.telefone || ''}">
                        </div>
                        <div class="form-group">
                            <label for="grupoId">Grupo</label>
                            <select id="grupoId" class="form-control">
                                <option value="">Sem grupo</option>
                                ${grupos.map(g => `<option value="${g.id}" ${lead?.grupo_id == g.id ? 'selected' : ''}>${g.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="observacoes">Observações</label>
                            <textarea id="observacoes" class="form-control" rows="3">${lead?.observacoes || ''}</textarea>
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
            const emailInput = modal.querySelector('#email');
            const telefoneInput = modal.querySelector('#telefone');
            const grupoIdSelect = modal.querySelector('#grupoId');
            const observacoesInput = modal.querySelector('#observacoes');

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
                    email: emailInput.value.trim() || null,
                    telefone: telefoneInput.value.trim() || null,
                    grupoId: grupoIdSelect.value || null,
                    observacoes: observacoesInput.value.trim() || null
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

    const createLead = async () => {
        const data = await showLeadModal();
        if (!data) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/leads`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Lead criado com sucesso!', 'success');
                loadData();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao criar lead', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const editLead = async (lead) => {
        const data = await showLeadModal(lead);
        if (!data) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/leads/${lead.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Lead atualizado com sucesso!', 'success');
                loadData();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao atualizar lead', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const deleteLead = async (lead) => {
        const confirmed = await Dialogs.confirm(
            `Tem certeza que deseja excluir o lead "${lead.nome}"?`,
            'Confirmar Exclusão'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/leads/${lead.id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Lead excluído com sucesso!', 'success');
                loadData();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir lead', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>🎯 Leads</h2>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new" class="btn-primary">+ Novo Lead</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden;"></div>
        
        <div id="footer-summary" style="margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted);">
            Total: <span id="total-count">0</span> lead(s)
        </div>
    `;

    container.querySelector('#btn-new').addEventListener('click', createLead);

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
