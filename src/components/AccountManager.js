import { AccountModal } from './AccountModal.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const AccountManager = (project) => {
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

    // Account type icons and labels
    const accountTypeInfo = {
        'caixa': { icon: '💰', label: 'Caixa' },
        'banco': { icon: '🏦', label: 'Banco' },
        'cartao': { icon: '💳', label: 'Cartão' },
        'digital': { icon: '📱', label: 'Digital' },
        'outros': { icon: '🏪', label: 'Outros' }
    };

    const getAccountTypeDisplay = (type) => {
        const info = accountTypeInfo[type] || accountTypeInfo['outros'];
        return `<span class="account-type-badge">${info.icon} ${info.label}</span>`;
    };

    const loadAccounts = async () => {
        try {
            container.querySelector('.accounts-table-wrapper')?.classList.add('loading');

            const token = localStorage.getItem('token');
            const currentProject = JSON.parse(localStorage.getItem('currentProject'));

            const [accountsResponse, companiesResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/accounts?projectId=${project.id}`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/companies?projectId=${project.id}`, { headers: getHeaders() })
            ]);

            const accounts = await accountsResponse.json();
            const companies = await companiesResponse.json();

            renderAccounts(accounts, companies);
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Erro ao carregar dados', 'error');
        }
    };

    const createAccount = async () => {
        // First check if there are companies
        const token = localStorage.getItem('token');
        const currentProject = JSON.parse(localStorage.getItem('currentProject'));

        try {
            const response = await fetch(`${API_BASE_URL}/companies?projectId=${currentProject.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const companies = await response.json();

            if (companies.length === 0) {
                showToast('Cadastre uma empresa primeiro na tela "Empresa"', 'error');
                return;
            }
        } catch (error) {
            console.error('Error checking companies:', error);
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

    const renderAccounts = (accounts, companies = []) => {
        const hasCompanies = companies && companies.length > 0;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>💰 Contas</h2>
                <div style="display: flex; gap: 0.5rem;">
                     <a href="#" style="font-size: 0.9rem; color: var(--color-primary);">Lar</a>
                     <span style="color: var(--color-text-muted);">/</span>
                     <span style="font-size: 0.9rem; color: var(--color-text-muted);">Contas</span>
                </div>
            </div>

            <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
                <button id="btn-new-account" class="btn-primary" ${!hasCompanies ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>+ Nova Conta</button>
                ${!hasCompanies ? '<span style="color: var(--color-text-muted); font-size: 0.9rem; font-style: italic;">⚠️ É obrigatório cadastrar uma empresa antes de criar uma conta.</span>' : ''}
            </div>

            <div class="accounts-table-wrapper" style="flex: 1; overflow: auto; border: 1px solid var(--color-border-light); border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead class="sticky-header">
                        <tr>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Nome</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Tipo</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Descrição</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Saldo</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Status</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Criado em</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${accounts.map((account, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
            return `
                            <tr style="border-bottom: 1px solid var(--color-border-light); background-color: ${bgColor}; transition: background 0.2s;" 
                                onmouseover="this.style.background='rgba(218, 177, 119, 0.5)'" 
                                onmouseout="this.style.background='${bgColor}'">
                                <td style="padding: 0.32rem 1rem; font-size: 0.9rem; font-weight: 500;">
                                    ${account.name}
                                </td>
                                <td style="padding: 0.32rem 1rem; font-size: 0.9rem;">
                                    ${getAccountTypeDisplay(account.account_type || 'outros')}
                                </td>
                                <td style="padding: 0.32rem 1rem; font-size: 0.9rem; color: var(--color-text-muted);">
                                    ${account.description || '-'}
                                </td>
                                <td style="padding: 0.32rem 1rem; font-size: 0.9rem; text-align: right; font-weight: 600; color: ${(account.current_balance || 0) >= 0 ? '#10B981' : '#EF4444'};">
                                    ${formatCurrency(account.current_balance)}
                                </td>
                                <td style="padding: 0.32rem 1rem; text-align: center;">
                                    <span class="badge-${account.active ? 'active' : 'inactive'}">
                                        ${account.active ? '✓ Ativo' : '✕ Inativo'}
                                    </span>
                                </td>
                                <td style="padding: 0.32rem 1rem; font-size: 0.85rem; text-align: center; color: var(--color-text-muted);">
                                    ${formatDate(account.created_at)}
                                </td>
                                <td style="padding: 0.32rem 1rem; text-align: right;">
                                    <button class="btn-edit" data-id="${account.id}" style="color: #10B981; margin-right: 0.5rem; font-size: 1.2rem; background: none; border: none; cursor: pointer; transition: transform 0.2s;" 
                                        onmouseover="this.style.transform='scale(1.2)'" 
                                        onmouseout="this.style.transform='scale(1)'">✏️</button>
                                    <button class="btn-delete" data-id="${account.id}" style="color: #EF4444; font-size: 1.2rem; background: none; border: none; cursor: pointer; transition: transform 0.2s;" 
                                        onmouseover="this.style.transform='scale(1.2)'" 
                                        onmouseout="this.style.transform='scale(1)'">🗑️</button>
                                </td>
                            </tr>
                        `}).join('')}
                        ${accounts.length === 0 ? `
                            <tr>
                                <td colspan="7" style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                                    <div style="font-size: 1.1rem;">Nenhuma conta cadastrada</div>
                                    <div style="font-size: 0.9rem; margin-top: 0.5rem;">Clique em "Nova Conta" para começar</div>
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--color-text-muted);">
                <div>Total: ${accounts.length} conta${accounts.length !== 1 ? 's' : ''}</div>
                <div>Saldo Total: <span style="font-weight: 600; color: var(--color-primary);">${formatCurrency(accounts.reduce((sum, acc) => sum + parseFloat(acc.current_balance || 0), 0))}</span></div>
            </div>
        `;

        container.querySelector('#btn-new-account').addEventListener('click', createAccount);

        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const account = accounts.find(a => a.id == btn.dataset.id);
                updateAccount(account);
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const account = accounts.find(a => a.id == btn.dataset.id);
                deleteAccount(account.id, account.name);
            });
        });
    };

    loadAccounts();

    return container;
};
