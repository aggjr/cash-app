import { TransferenciaModal } from './TransferenciaModal.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const TransferenciaManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.height = 'calc(100vh - 150px)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    let transferencias = [];
    let pagination = { page: 1, limit: 50, total: 0 };
    let activeFilters = {};

    const columns = [
        { key: 'data_prevista', label: 'Prevista', width: '100px', align: 'center', type: 'date' },
        { key: 'data_real', label: 'Real', width: '100px', align: 'center', type: 'date' },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        { key: 'source_account_name', label: 'Origem (Sai)', width: '200px', align: 'left', type: 'text' },
        { key: 'destination_account_name', label: 'Destino (Entra)', width: '200px', align: 'left', type: 'text' },
        { key: 'valor', label: 'Valor', width: '120px', align: 'right', type: 'currency' },
        { key: 'actions', label: 'Ações', width: '100px', align: 'center', noFilter: true }
    ];

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('pt-BR');
    };

    const loadTransferencias = async (page = 1) => {
        try {
            container.querySelector('.transf-table-wrapper')?.classList.add('loading');
            const params = new URLSearchParams({ projectId: project.id, page, limit: pagination.limit });

            const response = await fetch(`${API_BASE_URL}/transferencias?${params.toString()}`, { headers: getHeaders() });
            const result = await response.json();

            if (result.meta) {
                transferencias = result.data;
                pagination = result.meta;
            } else {
                transferencias = Array.isArray(result) ? result : [];
            }
            renderTable(transferencias);
        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar transferências', 'error');
        } finally {
            container.querySelector('.transf-table-wrapper')?.classList.remove('loading');
        }
    };

    const createTransferencia = async () => {
        await TransferenciaModal.show({
            transferencia: null,
            projectId: project.id,
            onSave: async (data) => {
                const res = await fetch(`${API_BASE_URL}/transferencias`, {
                    method: 'POST', headers: getHeaders(), body: JSON.stringify({ ...data, projectId: project.id })
                });
                if (res.ok) { showToast('Criado com sucesso!', 'success'); loadTransferencias(); }
                else { const err = await res.json(); showToast(err.error || 'Erro', 'error'); }
            }
        });
    };

    const updateTransferencia = async (item) => {
        await TransferenciaModal.show({
            transferencia: item,
            projectId: project.id,
            onSave: async (data) => {
                const res = await fetch(`${API_BASE_URL}/transferencias/${item.id}`, {
                    method: 'PUT', headers: getHeaders(), body: JSON.stringify(data)
                });
                if (res.ok) { showToast('Atualizado com sucesso!', 'success'); loadTransferencias(); }
                else { const err = await res.json(); showToast(err.error || 'Erro', 'error'); }
            }
        });
    };

    const deleteTransferencia = async (id) => {
        if (!confirm('Deseja excluir esta transferência e reverter os saldos?')) return;
        const res = await fetch(`${API_BASE_URL}/transferencias/${id}`, { method: 'DELETE', headers: getHeaders() });
        if (res.ok) { showToast('Excluído com sucesso!', 'success'); loadTransferencias(); }
        else { const err = await res.json(); showToast(err.error || 'Erro', 'error'); }
    };

    const renderTable = (items) => {
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>↔️ Transferências</h2>
                <div style="display: flex; gap: 0.5rem; color: var(--color-text-muted);">
                     <span>Movimentações</span> / <span>Transferências</span>
                </div>
            </div>
            <div style="margin-bottom: 1rem;">
                <button id="btn-new-transf" class="btn-primary">+ Nova Transferência</button>
            </div>
            <div class="transf-table-wrapper" style="flex: 1; overflow: auto; border: 1px solid var(--color-border-light); border-radius: 8px; box-shadow: var(--shadow-sm);">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead class="sticky-header">
                        <tr>
                            ${columns.map(col => `<th style="padding:0.75rem; text-align:${col.align}; border-bottom:2px solid #0c4a6e; background:#0c4a6e; color:white; font-weight:600;">${col.label}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => {
            const bgColor = index % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
            return `
                                <tr style="background-color:${bgColor}; border-bottom:1px solid #eee;">
                                    <td style="padding:0.75rem; text-align:center;">${formatDate(item.data_prevista)}</td>
                                    <td style="padding:0.75rem; text-align:center;">${formatDate(item.data_real)}</td>
                                    <td style="padding:0.75rem;">${item.descricao || '-'}</td>
                                    <td style="padding:0.75rem;">${item.source_account_name}</td>
                                    <td style="padding:0.75rem;">${item.destination_account_name}</td>
                                    <td style="padding:0.75rem; text-align:right; font-weight:600; color:#3B82F6;">${formatCurrency(item.valor)}</td>
                                    <td style="padding:0.75rem; text-align:center;">
                                         <button class="btn-edit" data-id="${item.id}" style="color: #10B981; margin-right: 0.5rem; background:none; border:none; cursor:pointer;">✏️</button>
                                         <button class="btn-delete" data-id="${item.id}" style="color: #EF4444; background:none; border:none; cursor:pointer;">🗑️</button>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
             <div style="margin-top: 1rem; text-align: right; color: var(--color-text-muted); font-size: 0.9rem;">
                 <b>Total Movimentado:</b> <b style="color: #3B82F6;">${formatCurrency(items.reduce((acc, i) => acc + parseFloat(i.valor), 0))}</b>
            </div>
        `;

        container.querySelector('#btn-new-transf').onclick = createTransferencia;
        container.querySelectorAll('.btn-edit').forEach(b => b.onclick = () => updateTransferencia(items.find(i => i.id == b.dataset.id)));
        container.querySelectorAll('.btn-delete').forEach(b => b.onclick = () => deleteTransferencia(b.dataset.id));
    };

    loadTransferencias();
    return container;
};
