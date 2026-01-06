import { CompanyModal } from './CompanyModal.js';
import { SharedTable } from './SharedTable.js';
import { Dialogs } from './Dialogs.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { PrintHelper } from '../utils/printHelper.js';

export const CompanyManager = (project) => {
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

    // State
    let companies = [];
    let sharedTable = null;

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Date formatter
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    // CNPJ formatter
    const formatCNPJ = (cnpj) => {
        if (!cnpj) return '-';
        return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    };

    // Column Definitions for SharedTable
    const columns = [
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
        { key: 'description', label: 'Descrição', width: '250px', align: 'left', type: 'text' },
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
                btnEdit.onclick = (e) => { e.stopPropagation(); updateCompany(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteCompany(item.id, item.name); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        }
    ];

    const loadCompanies = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/companies?projectId=${project.id}`, {
                headers: getHeaders()
            });
            companies = await response.json();

            if (sharedTable) {
                sharedTable.render(companies);
            }
        } catch (error) {
            console.error('Error loading companies:', error);
            showToast('Erro ao carregar empresas', 'error');
        }
    };

    const createCompany = async () => {
        const data = await CompanyModal.show({
            company: null,
            onSave: async (companyData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/companies`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            name: companyData.name,
                            cnpj: companyData.cnpj,
                            description: companyData.description,
                            projectId: project.id
                        })
                    });

                    if (response.ok) {
                        showToast('Empresa criada com sucesso!', 'success');
                        loadCompanies();
                    } else {
                        const error = await response.json();
                        showToast(error.error?.message || error.error || 'Erro ao criar empresa', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const updateCompany = async (company) => {
        const data = await CompanyModal.show({
            company: company,
            onSave: async (companyData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/companies/${company.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            name: companyData.name,
                            cnpj: companyData.cnpj,
                            description: companyData.description,
                            active: companyData.active
                        })
                    });

                    if (response.ok) {
                        showToast('Empresa atualizada com sucesso!', 'success');
                        loadCompanies();
                    } else {
                        const error = await response.json();
                        showToast(error.error?.message || error.error || 'Erro ao atualizar empresa', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const deleteCompany = async (id, name) => {
        const confirmed = await Dialogs.confirm(`Tem certeza que deseja processar a empresa "${name}"?`);
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/companies/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Empresa excluída com sucesso!', 'success');
                loadCompanies();
            } else {
                const data = await response.json();

                // Check if it's a dependency error (Smart Delete Flow)
                if (response.status === 409 && data.error?.code === 'DEPENDENCY_EXISTS') {
                    const inactivate = await Dialogs.confirm(
                        `Esta empresa não pode ser excluída pois possui ${data.error.counts?.accounts || 0} contas e ${data.error.counts?.incomes + data.error.counts?.expenses || 0} lançamentos vinculados.\n\nDeseja INATIVAR a empresa para manter o histórico?`,
                        'Atenção: Vínculos Encontrados'
                    );

                    if (inactivate) {
                        // Proceed to inactivate
                        try {
                            const updateResponse = await fetch(`${API_BASE_URL}/companies/${id}`, {
                                method: 'PUT',
                                headers: getHeaders(),
                                body: JSON.stringify({ active: false })
                            });

                            if (updateResponse.ok) {
                                showToast('Empresa inativada com sucesso!', 'success');
                                loadCompanies();
                            } else {
                                showToast('Erro ao inativar empresa.', 'error');
                            }
                        } catch (err) {
                            showToast('Erro de conexão ao tentar inativar.', 'error');
                        }
                    }
                } else {
                    const errorMessage = data.error?.message || data.error || 'Erro ao excluir empresa';
                    showToast(errorMessage, 'error');
                }
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const exportToExcel = async () => {
        const exportColumns = [
            { header: 'Nome', key: 'name', width: 30 },
            { header: 'CNPJ', key: 'cnpj_formatted', width: 20 },
            { header: 'Descrição', key: 'description', width: 40 },
            { header: 'Status', key: 'active', width: 15, type: 'center' }
        ];

        // Prepare data for export
        const exportData = companies.map(c => ({
            ...c,
            cnpj_formatted: formatCNPJ(c.cnpj),
            created_at_formatted: formatDate(c.created_at)
        }));

        await ExcelExporter.exportTable(exportData, exportColumns, 'Empresas', 'empresas_export');
    };

    // Initial UI Setup
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>🏢 Empresas</h2>
            <div style="display: flex; gap: 0.5rem;">
                <button id="btn-print-pdf" class="btn-secondary" title="Imprimir / Salvar PDF">🖨️ PDF</button>
                <button id="btn-export-excel" class="btn-secondary" title="Exportar Excel">📊 Excel</button>
            </div>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new-company" class="btn-primary">+ Nova Empresa</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden;"></div>
        
        <div id="footer-summary" style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--color-text-muted);">
            <div>Total: <span id="total-count">0</span> empresa(s)</div>
        </div>
    `;

    // Event Listeners
    container.querySelector('#btn-new-company').addEventListener('click', createCompany);
    container.querySelector('#btn-print-pdf').addEventListener('click', () => {
        PrintHelper.autoConfigureOrientation('#table-container table');
        window.print();
    });
    container.querySelector('#btn-export-excel').addEventListener('click', exportToExcel);

    // Initialize SharedTable
    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        data: [],
        onFilterChange: (filters) => {
            // Optional: Handle filter changes if needed
        },
        onSortChange: (key, direction) => {
            // Optional: Handle sort changes if needed
        }
    });

    // Initial Load
    loadCompanies().then(() => {
        const totalCount = container.querySelector('#total-count');
        if (totalCount) {
            totalCount.textContent = companies.length;
        }
    });

    return container;
};
