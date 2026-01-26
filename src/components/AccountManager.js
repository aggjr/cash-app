import { AccountModal } from './AccountModal.js';
import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { PrintHelper } from '../utils/printHelper.js';

export const AccountManager = (project) => {
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
    let accounts = [];
    let companies = [];
    let sharedTable = null;

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Currency formatter
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    // Date formatter
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };


    // Column Definitions for SharedTable
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
                btnEdit.onclick = (e) => { e.stopPropagation(); updateAccount(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteAccount(item.id, item.name); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        { key: 'name', label: 'Nome', width: 'auto', align: 'left', type: 'text' },
        {
            key: 'company_name',
            label: 'Empresa',
            width: '200px',
            align: 'left',
            type: 'text',
            render: (item) => {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.flexDirection = 'column';

                const nameSpan = document.createElement('span');
                nameSpan.textContent = item.company_name || '-';
                nameSpan.style.fontWeight = '500';

                div.appendChild(nameSpan);

                if (item.company_cnpj) {
                    const cnpjSpan = document.createElement('span');
                    cnpjSpan.textContent = item.company_cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
                    cnpjSpan.style.fontSize = '0.75rem';
                    cnpjSpan.style.color = 'var(--color-text-muted)';
                    div.appendChild(cnpjSpan);
                }

                return div;
            }
        },
        { key: 'description', label: 'Descrição', width: '200px', align: 'left', type: 'text' },
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

    const loadAccounts = async () => {
        try {
            const [accountsResponse, companiesResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/accounts?projectId=${project.id}`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/companies?projectId=${project.id}`, { headers: getHeaders() })
            ]);

            accounts = await accountsResponse.json();
            companies = await companiesResponse.json();

            if (sharedTable) {
                sharedTable.render(accounts);
            }

            // Update footer
            updateFooter();
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Erro ao carregar dados', 'error');
        }
    };

    const updateFooter = () => {
        const totalCount = container.querySelector('#total-count');
        const totalBalance = container.querySelector('#total-balance');

        if (totalCount) {
            totalCount.textContent = accounts.length;
        }

        if (totalBalance) {
            const balance = accounts.reduce((sum, acc) => sum + parseFloat(acc.current_balance || 0), 0);
            totalBalance.textContent = formatCurrency(balance);
        }
    };

    const createAccount = async () => {
        // First check if there are companies
        if (companies.length === 0) {
            showToast('Cadastre uma empresa primeiro na tela "Empresa"', 'error');
            return;
        }

        const data = await AccountModal.show({
            account: null,
            onSave: async (accountData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/accounts`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            name: accountData.name,
                            description: accountData.description,
                            accountType: accountData.accountType,
                            initialBalance: accountData.initialBalance,
                            projectId: project.id,
                            companyId: accountData.companyId
                        })
                    });

                    if (response.ok) {
                        showToast('Conta criada com sucesso!', 'success');
                        loadAccounts();
                    } else {
                        showToast('Erro ao criar conta', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const updateAccount = async (account) => {
        const data = await AccountModal.show({
            account: account,
            onSave: async (accountData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/accounts/${account.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            name: accountData.name,
                            description: accountData.description,
                            accountType: accountData.accountType,
                            initialBalance: accountData.initialBalance,
                            active: accountData.active
                        })
                    });

                    if (response.ok) {
                        showToast('Conta atualizada com sucesso!', 'success');
                        loadAccounts();
                    } else {
                        showToast('Erro ao atualizar conta', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const deleteAccount = async (id, name) => {
        if (!confirm(`Tem certeza que deseja excluir a conta "${name}"?`)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/accounts/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Conta excluída com sucesso!', 'success');
                loadAccounts();
            } else {
                showToast('Erro ao excluir conta', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const exportToExcel = async () => {
        const exportColumns = [
            { header: 'Nome', key: 'name', width: 30 },
            { header: 'Tipo', key: 'type_display', width: 20 },
            { header: 'Descrição', key: 'description', width: 30 },
            { header: 'Empresa', key: 'company_name', width: 30 },
            { header: 'Status', key: 'active', width: 15, type: 'center' },
            { header: 'Criado em', key: 'created_at_formatted', width: 15, type: 'center' }
        ];

        // Prepare data
        const exportData = accounts.map(a => {
            const company = companies.find(c => c.id === a.company_id);
            const typeInfo = accountTypeInfo[a.account_type] || accountTypeInfo['outros'];

            return {
                ...a,
                type_display: typeInfo.label,
                balance_formatted: formatCurrency(a.current_balance),
                company_name: company ? company.name : '-',
                created_at_formatted: formatDate(a.created_at)
            };
        });

        await ExcelExporter.exportTable(exportData, exportColumns, 'Contas', 'contas_export');
    };

    // Initial UI Setup
    const hasCompanies = companies && companies.length > 0;

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>💰 Contas</h2>
            <div style="display: flex; gap: 0.5rem;">
                <button id="btn-print-pdf" class="btn-secondary" title="Imprimir / Salvar PDF">🖨️ PDF</button>
                <button id="btn-export-excel" class="btn-secondary" title="Exportar Excel">📊 Excel</button>
            </div>
        </div>

        <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
            <button id="btn-new-account" class="btn-primary">+ Nova Conta</button>
            <span id="company-warning" style="color: var(--color-text-muted); font-size: 0.9rem; font-style: italic; display: none;">⚠️ É obrigatório cadastrar uma empresa antes de criar uma conta.</span>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden;"></div>
        
        <div id="footer-summary" style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--color-text-muted);">
            <div>Total: <span id="total-count">0</span> conta(s)</div>
        </div>
    `;

    // Event Listeners
    container.querySelector('#btn-new-account').addEventListener('click', createAccount);
    container.querySelector('#btn-print-pdf').addEventListener('click', () => {
        PrintHelper.autoConfigureOrientation('#table-container table');
        window.print();
    });
    container.querySelector('#btn-export-excel').addEventListener('click', exportToExcel);

    // Initialize SharedTable
    const tableContainer = container.querySelector('#table-container');
    const footerElement = container.querySelector('#footer-summary');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        data: [],
        footer: footerElement,
        onFilterChange: (filters) => {
            // Optional: Handle filter changes if needed
        },
        onSortChange: (key, direction) => {
            // Optional: Handle sort changes if needed
        }
    });

    // Initial Load
    loadAccounts();

    return container;
};
