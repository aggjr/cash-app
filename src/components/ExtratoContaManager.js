import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { MonthPicker } from './MonthPicker.js';

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
    const storedStartMonth = localStorage.getItem('extrato_startMonth');
    const storedEndMonth = localStorage.getItem('extrato_endMonth');
    const storedAcc = localStorage.getItem('extrato_accountId');

    // Default: Start = Current Year - Jan, End = Current Year - Dec
    let startMonth = storedStartMonth || `${today.getFullYear()}-01`;
    let endMonth = storedEndMonth || `${today.getFullYear()}-12`;
    let selectedAccountId = storedAcc || null;
    let accounts = [];
    let extratoData = null;

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

        // Date Pickers Group
        const dateGroup = document.createElement('div');
        dateGroup.style.display = 'flex';
        dateGroup.style.alignItems = 'center';
        dateGroup.style.gap = '0.5rem';

        const lblDe = document.createElement('span');
        lblDe.textContent = 'De:'; lblDe.style.fontSize = '0.9rem'; lblDe.style.color = '#4B5563';

        const startPicker = MonthPicker(startMonth, (val) => {
            startMonth = val;
            localStorage.setItem('extrato_startMonth', startMonth);
            triggerSearch();
        });

        const lblAte = document.createElement('span');
        lblAte.textContent = 'Até:'; lblAte.style.fontSize = '0.9rem'; lblAte.style.color = '#4B5563';

        const endPicker = MonthPicker(endMonth, (val) => {
            endMonth = val;
            localStorage.setItem('extrato_endMonth', endMonth);
            triggerSearch();
        });

        dateGroup.appendChild(lblDe);
        dateGroup.appendChild(startPicker);
        dateGroup.appendChild(lblAte);
        dateGroup.appendChild(endPicker);

        // Auto-Trigger Search Logic
        const triggerSearch = () => {
            selectedAccountId = accSelect.value;
            localStorage.setItem('extrato_accountId', selectedAccountId);
            loadExtrato();
        };

        // Attach listeners
        accSelect.addEventListener('change', triggerSearch);

        controls.appendChild(accDiv);
        controls.appendChild(dateGroup);

        return controls;
    };

    const renderTable = () => {
        const existingTable = container.querySelector('.extrato-table-wrapper');
        if (existingTable) existingTable.remove();

        const wrapper = document.createElement('div');
        wrapper.className = 'extrato-table-wrapper';
        wrapper.style.flex = '1';
        wrapper.style.overflow = 'auto';
        wrapper.style.backgroundColor = 'white';
        wrapper.style.borderRadius = '8px';
        wrapper.style.border = '1px solid var(--color-border-light)';
        wrapper.style.boxShadow = 'var(--shadow-sm)';

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        // --- THEAD ---
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.backgroundColor = '#00425F';
        headerRow.style.color = 'white';
        headerRow.style.textAlign = 'left';

        // Sticky Header Logic
        headerRow.style.position = 'sticky';
        headerRow.style.top = '0';
        headerRow.style.zIndex = '10'; // Ensure it stays on top

        // Headers (Added Fluxo)
        const headers = ['Data Execução', 'TIPO DE MOVIMENTAÇÃO', 'Descrição', 'Fluxo', 'Valor'];
        headers.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.padding = '1rem';
            th.style.fontWeight = '600';
            th.style.borderBottom = '2px solid #e5e7eb';
            if (text === 'Valor') th.style.textAlign = 'right';
            if (text === 'Fluxo') th.style.textAlign = 'center';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // --- TBODY ---
        const tbody = document.createElement('tbody');

        // Show empty state if no data or no account selected
        if (!extratoData || !selectedAccountId) {
            const trEmpty = document.createElement('tr');
            trEmpty.innerHTML = `
                <td colspan="5" style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                    <div style="font-size: 1.1rem;">${!selectedAccountId ? 'Selecione uma conta para ver o extrato' : 'Nenhuma movimentação encontrada'}</div>
                    <div style="font-size: 0.9rem; margin-top: 0.5rem;">Clique no botão de pesquisa após selecionar uma conta e período</div>
                </td>
            `;
            tbody.appendChild(trEmpty);
            table.appendChild(tbody);
            wrapper.appendChild(table);
            container.appendChild(wrapper);
            return;
        }

        let currentBalance = extratoData.initialBalance;

        // 1. Initial Balance Row
        const trInit = document.createElement('tr');
        trInit.style.backgroundColor = '#e0f2fe';
        trInit.style.fontWeight = 'bold';
        trInit.style.borderBottom = '2px solid #00425F';
        trInit.innerHTML = `
            <td style="padding: 0.32rem 1rem">-</td>
            <td style="padding: 0.32rem 1rem">SALDO ANTERIOR</td>
            <td style="padding: 0.32rem 1rem">-</td>
            <td style="padding: 0.32rem 1rem">-</td>
            <td style="padding: 0.32rem 1rem; text-align: right; color: ${currentBalance >= 0 ? '#10B981' : '#EF4444'}">
                ${formatCurrency(currentBalance)}
            </td>
        `;
        tbody.appendChild(trInit);

        // 2. Transactions
        extratoData.transactions.forEach((tx, index) => {
            const tr = document.createElement('tr');
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';

            tr.style.backgroundColor = bgColor;
            tr.style.borderBottom = '1px solid #e5e7eb';
            tr.style.transition = 'background 0.2s';

            // Hover effect
            tr.onmouseover = () => tr.style.backgroundColor = 'rgba(218, 177, 119, 0.5)';
            tr.onmouseout = () => tr.style.backgroundColor = bgColor;

            const isInput = tx.direction === 'IN';
            const val = parseFloat(tx.valor);

            // Balance Calc (Must be signed for math)
            const balanceChange = isInput ? val : -val;
            currentBalance += balanceChange;

            // Strict User Rule:
            // Flow IN (Entrada/Aporte/Transf-IN): Pos=Green, Neg=Red.
            // Flow OUT (Saida/Retirada/Transf-OUT): Neg=Green, Pos=Red.
            let color;
            if (isInput) {
                // IN: Normal(Pos)=Green, Reversal(Neg)=Red
                color = val >= 0 ? '#10B981' : '#EF4444';
            } else {
                // OUT: Normal(Pos)=Red, Reversal(Neg)=Green
                color = val >= 0 ? '#EF4444' : '#10B981';
            }

            // Badge Logic
            const badgeBg = isInput ? '#d1fae5' : '#fee2e2';
            const badgeColor = isInput ? '#065f46' : '#991b1b';
            const badgeText = isInput ? 'ENTRADA' : 'SAÍDA';

            tr.innerHTML = `
                <td style="padding: 0.32rem 1rem; color: #4B5563;">${formatDate(tx.data)}</td>
                <td style="padding: 0.32rem 1rem; font-weight: 500;">${tx.tipo_formatado}</td>
                <td style="padding: 0.32rem 1rem; color: #6B7280;">${tx.descricao || '-'}</td>
                <td style="padding: 0.32rem 1rem; text-align: center;">
                    <span style="background-color: ${badgeBg}; color: ${badgeColor}; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600;">
                        ${badgeText}
                    </span>
                </td>
                <td style="padding: 0.32rem 1rem; text-align: right; font-weight: 600; color: ${color};">
                    ${formatCurrency(val)}
                </td>
            `;

            tbody.appendChild(tr);
        });

        // 3. Final Balance Row
        const trFinal = document.createElement('tr');
        trFinal.style.backgroundColor = '#e0f2fe';
        trFinal.style.fontWeight = 'bold';
        trFinal.style.borderTop = '2px solid #00425F';
        trFinal.innerHTML = `
            <td style="padding: 0.32rem 1rem">-</td>
            <td style="padding: 0.32rem 1rem">SALDO FINAL</td>
            <td style="padding: 0.32rem 1rem">-</td>
            <td style="padding: 0.32rem 1rem">-</td>
            <td style="padding: 0.32rem 1rem; text-align: right; color: ${currentBalance >= 0 ? '#10B981' : '#EF4444'}">
                ${formatCurrency(currentBalance)}
            </td>
        `;
        tbody.appendChild(trFinal);

        table.appendChild(tbody);
        wrapper.appendChild(table);
        container.appendChild(wrapper);
    };

    // --- Loading ---

    const loadAccounts = async () => {
        try {
            const resp = await fetch(`${API_BASE_URL}/accounts?projectId=${project.id}`, { headers: getHeaders() });
            if (resp.ok) {
                accounts = await resp.json();

                // Auto-select first account if available
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
        if (!selectedAccountId) return;

        try {
            const wrapper = container.querySelector('.extrato-table-wrapper');
            if (wrapper) wrapper.style.opacity = '0.5';

            // Calculate full dates from Month YYYY-MM
            // Start: 1st day of startMonth
            const startDateFull = `${startMonth}-01`;

            // End: Last day of endMonth
            const [endY, endM] = endMonth.split('-').map(Number);
            const endDateDate = new Date(endY, endM, 0); // Day 0 of next month = last day of current
            const endDateFull = endDateDate.toISOString().substring(0, 10);

            const resp = await fetch(`${API_BASE_URL}/extrato?projectId=${project.id}&accountId=${selectedAccountId}&startDate=${startDateFull}&endDate=${endDateFull}`, { headers: getHeaders() });

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
    container.appendChild(renderControls());

    // Render empty table structure immediately
    renderTable();

    // Init
    loadAccounts();

    return container;
};
