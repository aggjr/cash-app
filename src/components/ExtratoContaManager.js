import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { SharedTable } from './SharedTable.js';
import { PrintHelper } from '../utils/printHelper.js';

export const ExtratoContaManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '1rem';
    container.style.margin = '0.5rem';
    container.style.height = 'calc(100vh - 40px)'; // Maximized height
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // State
    // State - Persistence
    const today = new Date();
    const storedStart = localStorage.getItem('extrato_startDate');
    const storedEnd = localStorage.getItem('extrato_endDate');
    const storedAcc = localStorage.getItem('extrato_accountId');
    const storedCompany = localStorage.getItem('extrato_companyId');

    let startDate = storedStart || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().substring(0, 10);
    let endDate = storedEnd || new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().substring(0, 10);
    let selectedAccountId = storedAcc || null;
    let selectedCompanyId = storedCompany ? parseInt(storedCompany) : null;
    let companies = [];
    let accounts = [];
    let allAccounts = []; // Store all accounts for filtering
    let extratoData = null;
    let sharedTable = null; // SharedTable instance

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const [year, month, day] = dateStr.substring(0, 10).split('-');
        return `${day}/${month}/${year}`;
    };

    // --- Render Functions ---

    const renderControls = () => {
        const controls = document.createElement('div');
        controls.className = 'extrato-controls animate-float-in';
        controls.style.display = 'flex';
        controls.style.gap = '1.5rem'; // Reduced gap
        controls.style.marginBottom = '0.5rem'; // Reduced margin
        controls.style.alignItems = 'flex-end';

        // Company Select
        const companyDiv = document.createElement('div');
        const companyLabel = document.createElement('label');
        companyLabel.textContent = 'Empresa';
        companyLabel.style.display = 'block';
        companyLabel.style.marginBottom = '0.2rem';
        companyLabel.style.fontWeight = '500';
        companyLabel.style.color = '#374151';

        const companySelect = document.createElement('select');
        companySelect.id = 'extrato-company-select';
        companySelect.className = 'form-input';
        companySelect.style.width = '250px';
        companySelect.style.height = '38px';
        companySelect.style.padding = '0 0.5rem';

        companies.forEach(comp => {
            const opt = document.createElement('option');
            opt.value = comp.id;
            opt.textContent = comp.name;
            if (comp.id === selectedCompanyId) opt.selected = true;
            companySelect.appendChild(opt);
        });

        companyDiv.appendChild(companyLabel);
        companyDiv.appendChild(companySelect);

        // Account Select
        const accDiv = document.createElement('div');
        const accLabel = document.createElement('label');
        accLabel.textContent = 'Conta Bancária';
        accLabel.style.display = 'block';
        accLabel.style.marginBottom = '0.2rem'; // Compact label
        accLabel.style.fontWeight = '500';
        accLabel.style.color = '#374151';

        const accSelect = document.createElement('select');
        accSelect.id = 'extrato-account-select';
        accSelect.className = 'form-input';
        accSelect.style.width = '250px';
        accSelect.style.height = '38px'; // Reduced height
        accSelect.style.padding = '0 0.5rem';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Selecione uma conta';
        accSelect.appendChild(placeholder);

        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = acc.name;
            if (acc.id === parseInt(selectedAccountId)) opt.selected = true;
            accSelect.appendChild(opt);
        });

        accDiv.appendChild(accLabel);
        accDiv.appendChild(accSelect);

        // Start Date
        const startDiv = document.createElement('div');
        const startLabel = document.createElement('label');
        startLabel.textContent = 'Data Início';
        startLabel.setAttribute('translate', 'no'); // Prevent translation
        startLabel.style.display = 'block';
        startLabel.style.marginBottom = '0.2rem';
        startLabel.style.fontWeight = '500';
        startLabel.style.color = '#374151';

        const startInput = document.createElement('input');
        startInput.type = 'date';
        startInput.id = 'extrato-start-date';
        startInput.className = 'form-input';
        startInput.style.height = '38px';
        startInput.value = startDate;

        startDiv.appendChild(startLabel);
        startDiv.appendChild(startInput);

        // End Date
        const endDiv = document.createElement('div');
        const endLabel = document.createElement('label');
        endLabel.textContent = 'Data Fim'; // Correct label
        endLabel.setAttribute('translate', 'no'); // Prevent translation
        endLabel.style.display = 'block';
        endLabel.style.marginBottom = '0.2rem';
        endLabel.style.fontWeight = '500';
        endLabel.style.color = '#374151';

        const endInput = document.createElement('input');
        endInput.type = 'date';
        endInput.id = 'extrato-end-date';
        endInput.className = 'form-input';
        endInput.style.height = '38px';
        endInput.value = endDate;

        endDiv.appendChild(endLabel);
        endDiv.appendChild(endInput);

        // Company Filter Logic
        const filterAccountsByCompany = () => {
            selectedCompanyId = parseInt(companySelect.value);

            accounts = allAccounts.filter(acc => acc.company_id === selectedCompanyId);

            // Persist company selection
            localStorage.setItem('extrato_companyId', selectedCompanyId);

            // Auto-select first account if available after filtering
            if (accounts.length > 0) {
                selectedAccountId = accounts[0].id;
                localStorage.setItem('extrato_accountId', selectedAccountId);
            } else {
                selectedAccountId = null;
                localStorage.removeItem('extrato_accountId');
            }

            // Re-render controls to update account dropdown
            const oldControls = container.querySelector('.extrato-controls');
            if (oldControls) {
                oldControls.replaceWith(renderControls());
            }

            // Reload extrato with new account selection
            loadExtrato();
        };

        // Auto-Trigger Search Logic
        const triggerSearch = () => {
            selectedAccountId = accSelect.value;
            startDate = startInput.value;
            endDate = endInput.value;

            // Persist
            localStorage.setItem('extrato_accountId', selectedAccountId);
            localStorage.setItem('extrato_startDate', startDate);
            localStorage.setItem('extrato_endDate', endDate);

            loadExtrato();
        };

        // Attach listeners
        companySelect.addEventListener('change', filterAccountsByCompany);
        accSelect.addEventListener('change', triggerSearch);
        startInput.addEventListener('change', triggerSearch);
        endInput.addEventListener('change', triggerSearch);

        controls.appendChild(companyDiv);
        controls.appendChild(accDiv);
        controls.appendChild(startDiv);
        controls.appendChild(endDiv);

        // Export Buttons
        const exportDiv = document.createElement('div');
        exportDiv.style.display = 'flex';
        exportDiv.style.gap = '0.5rem';
        exportDiv.style.marginLeft = 'auto';

        const btnExcel = document.createElement('button');
        btnExcel.id = 'btn-excel-extrato';
        btnExcel.className = 'btn-outline';
        btnExcel.textContent = '📊 Excel';
        exportDiv.appendChild(btnExcel);

        const btnPdf = document.createElement('button');
        btnPdf.id = 'btn-pdf-extrato';
        btnPdf.className = 'btn-outline';
        btnPdf.textContent = '🖨️ PDF';
        exportDiv.appendChild(btnPdf);

        controls.appendChild(exportDiv);

        // Export Handlers
        btnExcel.onclick = async () => {
            try {
                if (!extratoData || !extratoData.transactions) {
                    showToast('Sem dados para exportar', 'warning');
                    return;
                }

                const accountName = accounts.find(a => a.id === parseInt(selectedAccountId))?.name || 'Conta';

                // Prepare Data
                const exportData = extratoData.transactions.map(tx => ({
                    data: tx.data, // format in exporter
                    tipo_formatado: tx.tipo_formatado,
                    descricao: tx.descricao || '-',
                    fluxo: tx.direction === 'IN' ? 'ENTRADA' : 'SAÍDA',
                    valor: tx.valor
                }));

                // Define Columns (matching table structure)
                const columns = [
                    { header: 'Data Execução', key: 'data', width: 18, type: 'date' },
                    { header: 'Tipo de Movimentação', key: 'tipo_formatado', width: 40 },
                    { header: 'Descrição', key: 'descricao', width: 40 },
                    { header: 'Fluxo', key: 'fluxo', width: 15, type: 'center' },
                    { header: 'Valor', key: 'valor', width: 18, type: 'currency' }
                ];

                // Calculations for special rows (redundant but safe)
                let currentBalance = extratoData.initialBalance;
                extratoData.transactions.forEach(tx => {
                    const isInput = tx.direction === 'IN';
                    const val = parseFloat(tx.valor);
                    currentBalance += (isInput ? val : -val);
                });
                const finalBalance = currentBalance;

                // Header/Footer Options
                const options = {
                    freezeHeader: true,
                    headerRow: {
                        data: {
                            data: '-',
                            tipo_formatado: 'SALDO ANTERIOR',
                            descricao: '-',
                            fluxo: '-',
                            valor: extratoData.initialBalance
                        },
                        style: {
                            backgroundColor: '#e0f2fe',
                            fontWeight: 'bold',
                            borderBottom: '2px solid #00425F'
                        }
                    },
                    footerRow: {
                        data: {
                            data: '-',
                            tipo_formatado: 'SALDO FINAL',
                            descricao: '-',
                            fluxo: '-',
                            valor: finalBalance
                        },
                        style: {
                            backgroundColor: '#e0f2fe',
                            fontWeight: 'bold',
                            borderTop: '2px solid #00425F'
                        }
                    }
                };

                await ExcelExporter.exportTable(
                    exportData,
                    columns,
                    `Extrato - ${accountName}`,
                    'extrato_conta',
                    options
                );

            } catch (error) {
                console.error('Error during Excel export:', error);
                showToast(`Erro ao exportar: ${error.message}`, 'error');
            }
        };

        btnPdf.onclick = () => {
            // SharedTable renders table inside .table-wrapper
            PrintHelper.autoConfigureOrientation('.extrato-table-wrapper table');
            window.print();
        };

        return controls;
    };

    const renderTable = () => {
        const existingTable = container.querySelector('.extrato-table-wrapper');
        if (existingTable) existingTable.remove();

        const wrapper = document.createElement('div');
        wrapper.className = 'extrato-table-wrapper';
        wrapper.style.flex = '1';
        wrapper.style.overflow = 'hidden'; // SharedTable handles internal scroll
        wrapper.style.backgroundColor = 'white';
        wrapper.style.borderRadius = '8px';
        wrapper.style.border = '1px solid var(--color-border-light)';
        wrapper.style.boxShadow = 'var(--shadow-sm)';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';

        container.appendChild(wrapper);

        // Show empty state if no data or no account selected
        if (!extratoData || !selectedAccountId) {
            wrapper.style.overflow = 'auto'; // Re-enable for empty state content
            wrapper.innerHTML = `
                <div style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                    <div style="font-size: 1.1rem;">${!selectedAccountId ? 'Selecione uma conta para ver o extrato' : 'Nenhuma movimentação encontrada'}</div>
                    <div style="font-size: 0.9rem; margin-top: 0.5rem;">Clique no botão de pesquisa após selecionar uma conta e período</div>
                </div>
            `;
            return;
        }

        // Calculate Final Balance
        let currentBalance = extratoData.initialBalance;
        extratoData.transactions.forEach(tx => {
            const isInput = tx.direction === 'IN';
            const val = parseFloat(tx.valor);
            const balanceChange = isInput ? val : -val;
            currentBalance += balanceChange;
        });
        const finalBalance = currentBalance;

        // Configuration
        const columns = [
            {
                label: 'Data Execução',
                key: 'data',
                type: 'date',
                render: (item) => formatDate(item.data)
            },
            { label: 'Tipo de Movimentação', key: 'tipo_formatado' },
            {
                label: 'Descrição',
                key: 'descricao',
                render: (item) => item.descricao || '-'
            },
            {
                label: 'Fluxo',
                key: 'fluxo',
                align: 'center',
                render: (item) => {
                    const isInput = item.direction === 'IN';
                    const badgeBg = isInput ? '#d1fae5' : '#fee2e2';
                    const badgeColor = isInput ? '#065f46' : '#991b1b';
                    const badgeText = isInput ? 'ENTRADA' : 'SAÍDA';
                    return `<span style="background-color: ${badgeBg}; color: ${badgeColor}; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600;">${badgeText}</span>`;
                }
            },
            {
                label: 'Valor',
                key: 'valor',
                type: 'currency',
                align: 'right',
                render: (item) => {
                    const isInput = item.direction === 'IN';
                    const val = parseFloat(item.valor);
                    let color;
                    if (isInput) {
                        color = val >= 0 ? '#10B981' : '#EF4444';
                    } else {
                        color = val >= 0 ? '#EF4444' : '#10B981';
                    }
                    const span = document.createElement('span');
                    span.style.color = color;
                    span.style.fontWeight = '600';
                    span.textContent = formatCurrency(val);
                    return span;
                }
            }
        ];

        sharedTable = new SharedTable({
            container: wrapper,
            columns: columns,
            enableSelection: false, // Extrato typically readonly
            onFilterChange: () => { }, // Optional
            onSortChange: () => { },   // Optional
            headerRow: {
                data: {
                    data: '-',
                    tipo_formatado: 'SALDO ANTERIOR',
                    descricao: '-',
                    fluxo: '-',
                    valor: extratoData.initialBalance
                },
                style: {
                    backgroundColor: '#e0f2fe',
                    fontWeight: 'bold',
                    borderBottom: '2px solid #00425F'
                },
                className: 'extrato-header-row'
            },
            footerRow: {
                data: {
                    data: '-',
                    tipo_formatado: 'SALDO FINAL',
                    descricao: '-',
                    fluxo: '-',
                    valor: finalBalance
                },
                style: {
                    backgroundColor: '#e0f2fe',
                    fontWeight: 'bold',
                    borderTop: '2px solid #00425F'
                },
                className: 'extrato-footer-row'
            }
        });

        sharedTable.render(extratoData.transactions);
    };

    // --- Loading ---

    const loadAccounts = async () => {
        try {
            // Fetch companies
            const companiesResp = await fetch(`${API_BASE_URL}/companies?projectId=${project.id}`, { headers: getHeaders() });
            if (companiesResp.ok) {
                companies = await companiesResp.json();
            }

            // Fetch accounts with company info
            const resp = await fetch(`${API_BASE_URL}/accounts?projectId=${project.id}`, { headers: getHeaders() });
            if (resp.ok) {
                allAccounts = await resp.json();

                // Auto-select first company if no company selected
                if (!selectedCompanyId && companies.length > 0) {
                    selectedCompanyId = companies[0].id;
                    localStorage.setItem('extrato_companyId', selectedCompanyId);
                }

                // Filter accounts by selected company
                if (selectedCompanyId) {
                    accounts = allAccounts.filter(acc => acc.company_id === selectedCompanyId);
                } else {
                    accounts = [...allAccounts];
                }

                // Auto-select first account if available and none selected
                if (accounts.length > 0 && !selectedAccountId) {
                    selectedAccountId = accounts[0].id;
                }

                // Re-render controls to populate options
                const oldControls = container.querySelector('.extrato-controls');
                if (oldControls) {
                    oldControls.replaceWith(renderControls());
                } else {
                    container.appendChild(renderControls());
                }

                // Helper: Trigger initial load if we have an account
                if (selectedAccountId) {
                    loadExtrato();
                }
            }
        } catch (e) {
            console.error(e);
            showToast('Erro ao carregar contas', 'error');
        }
    };

    const loadExtrato = async () => {
        if (!selectedAccountId) {
            // Show empty table logic via renderTable
            extratoData = null; // Clear data
            renderTable();
            return;
        }

        try {
            const wrapper = container.querySelector('.extrato-table-wrapper');
            if (wrapper) wrapper.style.opacity = '0.5';

            const resp = await fetch(`${API_BASE_URL}/extrato?projectId=${project.id}&accountId=${selectedAccountId}&startDate=${startDate}&endDate=${endDate}`, { headers: getHeaders() });

            if (resp.ok) {
                extratoData = await resp.json();
                renderTable();
            } else {
                // Parse detailed error
                const errorData = await resp.json().catch(() => ({}));
                let errorMsg = errorData.error?.message || 'Erro ao carregar extrato';
                if (errorData.error?.sqlError) {
                    const sql = errorData.error.sqlError;
                    errorMsg += ` [SQL: ${sql.sqlCode || 'N/A'} - ${sql.sqlMessage || ''}]`;
                    console.error('SQL Error Details:', sql);
                }
                if (errorData.error?.code) {
                    errorMsg = `[${errorData.error.code}] ${errorMsg}`;
                }
                showToast(errorMsg, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Erro de conexão: ' + e.message, 'error');
        }
    };

    // Initial HTML Structure
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>🧾 Extrato de Conta</h2>
             <div style="display: flex; gap: 0.5rem;">
                 <a href="#" style="font-size: 0.9rem; color: var(--color-primary);">Lar</a>
                 <span style="color: var(--color-text-muted);">/</span>
                 <span style="font-size: 0.9rem; color: var(--color-text-muted);">extrato</span>
            </div>
        </div>
    `;

    // Render initial empty controls (will be repopulated after loadAccounts)
    const controlsElement = renderControls();
    container.appendChild(controlsElement);

    // Export Handlers


    // Render empty table structure immediately
    renderTable();

    // Init
    loadAccounts();

    return container;
};

