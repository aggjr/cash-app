import { FornecedorModal } from './FornecedorModal.js';
import { SharedTable } from './SharedTable.js';
import { Dialogs } from './Dialogs.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { PrintHelper } from '../utils/printHelper.js';

export const FornecedorManager = (project) => {
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

    let fornecedores = [];
    let sharedTable = null;
    let selectedItems = new Set();

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const formatCNPJ = (cnpj) => {
        if (!cnpj) return '-';
        return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
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
                btnEdit.onclick = (e) => { e.stopPropagation(); updateFornecedor(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteFornecedor(item.id, item.name); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        { key: 'name', label: 'Nome', width: 'auto', align: 'left', type: 'text' },
        {
            key: 'cnpj',
            label: 'CNPJ',
            width: '180px',
            align: 'left',
            type: 'text',
            render: (item) => {
                const span = document.createElement('span');
                span.textContent = formatCNPJ(item.cnpj);
                span.style.fontFamily = 'monospace';
                return span;
            }
        },
        { key: 'contato', label: 'Contato', width: '180px', align: 'left', type: 'text' },
        { key: 'telefone', label: 'Telefone', width: '140px', align: 'left', type: 'text' },
        { key: 'email', label: 'E-mail', width: '200px', align: 'left', type: 'text' },
        { key: 'observacoes', label: 'Observações', width: '220px', align: 'left', type: 'text' },
        {
            key: 'active',
            label: 'Status',
            width: '100px',
            align: 'center',
            type: 'text',
            render: (item) => {
                const badge = document.createElement('span');
                badge.className = `badge-${item.active ? 'active' : 'inactive'}`;
                badge.textContent = item.active ? '✓ Ativo' : '✕ Inativo';
                return badge;
            }
        },
        {
            key: 'created_at',
            label: 'Criado em',
            width: '120px',
            align: 'center',
            type: 'date',
            render: (item) => {
                const span = document.createElement('span');
                span.textContent = formatDate(item.created_at);
                return span;
            }
        }
    ];

    const loadFornecedores = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/fornecedores?projectId=${project.id}`, {
                headers: getHeaders()
            });
            const json = await response.json();
            fornecedores = Array.isArray(json) ? json : [];

            if (sharedTable) sharedTable.render(fornecedores);
        } catch (error) {
            console.error('Error loading fornecedores:', error);
            showToast('Erro ao carregar fornecedores', 'error');
        }
    };

    const createFornecedor = async () => {
        await FornecedorModal.show({
            fornecedor: null,
            onSave: async (data) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/fornecedores`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ ...data, projectId: project.id })
                    });

                    if (response.ok) {
                        showToast('Fornecedor criado com sucesso!', 'success');
                        loadFornecedores();
                    } else {
                        const error = await response.json();
                        showToast(error.error?.message || error.error || 'Erro ao criar fornecedor', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const updateFornecedor = async (fornecedor) => {
        await FornecedorModal.show({
            fornecedor,
            onSave: async (data) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/fornecedores/${fornecedor.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify(data)
                    });

                    if (response.ok) {
                        showToast('Fornecedor atualizado com sucesso!', 'success');
                        loadFornecedores();
                    } else {
                        const error = await response.json();
                        showToast(error.error?.message || error.error || 'Erro ao atualizar fornecedor', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const deleteFornecedor = async (id, name) => {
        const confirmed = await Dialogs.confirm(`Tem certeza que deseja excluir o fornecedor "${name}"?`);
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/fornecedores/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Fornecedor excluído com sucesso!', 'success');
                loadFornecedores();
                return;
            }

            const data = await response.json();

            // Purchases keep the supplier that actually sold the item, so offer to inactivate.
            if (response.status === 409 && data.error?.code === 'DEPENDENCY_EXISTS') {
                const inactivate = await Dialogs.confirm(
                    `Este fornecedor não pode ser excluído pois possui ${data.error.counts?.purchases || 0} compra(s) vinculada(s).\n\nDeseja INATIVAR o fornecedor para manter o histórico?`,
                    'Atenção: Vínculos Encontrados'
                );

                if (inactivate) {
                    const updateResponse = await fetch(`${API_BASE_URL}/fornecedores/${id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({ active: false })
                    });

                    if (updateResponse.ok) {
                        showToast('Fornecedor inativado com sucesso!', 'success');
                        loadFornecedores();
                    } else {
                        showToast('Erro ao inativar fornecedor.', 'error');
                    }
                }
            } else {
                showToast(data.error?.message || data.error || 'Erro ao excluir fornecedor', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedItems.size === 0) return;

        const confirmed = await Dialogs.confirm(`Tem certeza que deseja excluir ${selectedItems.size} fornecedores?`);
        if (!confirmed) return;

        container.querySelector('#table-container').classList.add('loading');
        let successCount = 0;
        let failCount = 0;
        let dependencyCount = 0;

        await Promise.all(Array.from(selectedItems).map(async (id) => {
            try {
                const response = await fetch(`${API_BASE_URL}/fornecedores/${id}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                });
                if (response.ok) {
                    successCount++;
                } else {
                    const data = await response.json();
                    if (response.status === 409 && data.error?.code === 'DEPENDENCY_EXISTS') dependencyCount++;
                    else failCount++;
                }
            } catch (e) {
                failCount++;
            }
        }));

        container.querySelector('#table-container').classList.remove('loading');

        if (successCount > 0) showToast(`${successCount} fornecedores excluídos.`, 'success');
        if (dependencyCount > 0) showToast(`${dependencyCount} fornecedores não excluídos por terem compras. Exclua individualmente para inativar.`, 'warning');
        if (failCount > 0) showToast(`${failCount} falhas ao excluir.`, 'error');

        selectedItems.clear();
        if (sharedTable) sharedTable.clearSelection();
        loadFornecedores();
    };

    const exportToExcel = async () => {
        const exportColumns = [
            { header: 'Nome', key: 'name', width: 30 },
            { header: 'CNPJ', key: 'cnpj_formatted', width: 20 },
            { header: 'Contato', key: 'contato', width: 25 },
            { header: 'Telefone', key: 'telefone', width: 18 },
            { header: 'E-mail', key: 'email', width: 28 },
            { header: 'Observações', key: 'observacoes', width: 40 },
            { header: 'Status', key: 'active', width: 12, type: 'center' },
            { header: 'Criado em', key: 'created_at_formatted', width: 15, type: 'center' }
        ];

        const exportData = fornecedores.map(f => ({
            ...f,
            cnpj_formatted: formatCNPJ(f.cnpj),
            created_at_formatted: formatDate(f.created_at)
        }));

        await ExcelExporter.exportTable(exportData, exportColumns, 'Fornecedores', 'fornecedores_export');
    };

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>🚚 Fornecedores</h2>
            <div style="display: flex; gap: 0.5rem;">
                <button id="btn-print-pdf" class="btn-secondary" title="Imprimir / Salvar PDF">🖨️ PDF</button>
                <button id="btn-export-excel" class="btn-secondary" title="Exportar Excel">📊 Excel</button>
            </div>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new-fornecedor" class="btn-primary">+ Novo Fornecedor</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;"></div>
    `;

    container.querySelector('#btn-new-fornecedor').addEventListener('click', createFornecedor);
    container.querySelector('#btn-print-pdf').addEventListener('click', () => {
        PrintHelper.autoConfigureOrientation('#table-container table');
        window.print();
    });
    container.querySelector('#btn-export-excel').addEventListener('click', exportToExcel);

    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        projectId: project.id,
        endpointPrefix: null,
        enableSelection: true,
        onSelectionChange: (items, ids) => {
            selectedItems = Array.isArray(ids) ? new Set(ids) : ids;
        },
        onBulkDelete: handleBulkDelete
    });

    loadFornecedores();

    return container;
};
