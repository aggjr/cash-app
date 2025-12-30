import { formatCurrency, parseCurrency } from '../utils/formatters.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const LoanModal = {
    show({ projectId, onSave }) {
        return new Promise(async (resolve) => {
            try {
                const API_BASE_URL = getApiBaseUrl();
                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                // Fetch data
                const token = localStorage.getItem('token');
                let companies = [];
                let accounts = [];

                try {
                    const [companyResponse, accountResponse] = await Promise.all([
                        fetch(`${API_BASE_URL}/companies?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${API_BASE_URL}/accounts?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } })
                    ]);

                    if (companyResponse.ok) {
                        const json = await companyResponse.json();
                        companies = Array.isArray(json) ? json : [];
                    }
                    if (accountResponse.ok) {
                        const json = await accountResponse.json();
                        accounts = Array.isArray(json) ? json : [];
                    }
                } catch (error) {
                    console.error('Error loading data:', error);
                    alert('Erro ao carregar dados do servidor: ' + error.message);
                }

                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';

                const modal = document.createElement('div');
                modal.className = 'account-modal animate-float-in';
                modal.style.maxWidth = '1000px';
                modal.style.width = '95%';

                modal.innerHTML = `
                    <div class="account-modal-body" style="padding: 1rem; overflow-y: auto; max-height: 85vh;">
                        <h3 style="margin: 0 0 1rem 0; color: var(--color-primary); font-size: 1.1rem;">🏦 Contratar Empréstimo</h3>
                        
                        <div class="form-grid" style="display: grid; grid-template-columns: 2fr 1.5fr 1.5fr; gap: 0.4rem;">
                            
                            <!-- Row 1: Description, Company, Account -->
                            <div class="form-group">
                                <label for="loan-description">Descrição *</label>
                                <input type="text" id="loan-description" class="form-input" required placeholder="Ex: Capital de Giro Safra 2024">
                            </div>

                            <div class="form-group">
                                <label for="loan-company">Empresa *</label>
                                <select id="loan-company" class="form-input" required>
                                    <option value="">Selecione...</option>
                                    ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="loan-account">Conta *</label>
                                <select id="loan-account" class="form-input" required>
                                    <option value="">Selecione...</option>
                                </select>
                            </div>

                            <!-- Financial Details Section -->
                            <div class="form-group" style="grid-column: span 3; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--color-border-light);">
                                <strong style="color: var(--color-primary);">💰 Valores do Empréstimo</strong>
                            </div>

                            <!-- Row 2: Nominal, Fees, Net Value -->
                            <div class="form-group">
                                <label for="loan-nominal">Valor Nominal (Contrato) *</label>
                                <input type="text" id="loan-nominal" class="form-input input-currency" required placeholder="R$ 0,00">
                                <small style="color: var(--color-text-muted);">Valor no contrato</small>
                            </div>

                            <div class="form-group">
                                <label for="loan-fees">Taxas/Impostos (TAC, IOF, etc)</label>
                                <input type="text" id="loan-fees" class="form-input input-currency" placeholder="R$ 0,00">
                                <small style="color: var(--color-text-muted);">Descontado do valor</small>
                            </div>

                            <div class="form-group">
                                <label for="loan-net">💵 Valor Líquido que CAI na Conta</label>
                                <input type="text" id="loan-net" class="form-input" readonly style="background: #E1F5FE; font-weight: bold; font-size: 1.1rem; text-align: right; color: var(--color-dark-teal); border: 1px solid var(--color-teal);">
                            </div>

                            <!-- Warning message -->
                            <div style="grid-column: span 3;">
                                <small style="color: #f57c00; font-weight: 500;">⚠️ Você recebe MENOS, mas paga sobre o valor nominal → Taxa Real AUMENTA!</small>
                            </div>

                            <!-- Payment Row with Total and Dates -->
                            <div class="form-group" style="grid-column: span 3; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--color-border-light);">
                                <strong style="color: var(--color-primary);">📊 Pagamento</strong>
                            </div>

                            <!-- Row 1: 4 Fields in one line using Flexbox -->
                            <div style="grid-column: span 3; display: flex; flex-direction: row; gap: 10px; align-items: flex-end; margin-bottom: 0.5rem;">
                                <div style="flex: 0 0 80px;"> <!-- Fixed small width -->
                                    <label for="loan-installments" style="display: block; margin-bottom: 0.25rem; color: var(--color-text-medium); font-size: 0.85rem; font-weight: 500; white-space: nowrap;">Nº Parcelas <span class="required">*</span></label>
                                    <input type="number" id="loan-installments" class="form-input" min="1" value="12" required style="width: 100%;">
                                </div>

                                <div style="flex: 0 0 100px;"> <!-- Fixed small width -->
                                    <label for="loan-grace-period" style="display: block; margin-bottom: 0.25rem; color: var(--color-text-medium); font-size: 0.85rem; font-weight: 500; white-space: nowrap;">Carência <span class="required">*</span></label>
                                    <input type="number" id="loan-grace-period" class="form-input" min="0" max="60" value="0" placeholder="0" required style="width: 100%;">
                                </div>

                                <div style="flex: 1;"> <!-- Flexible width -->
                                    <label for="loan-installment-value" style="display: block; margin-bottom: 0.25rem; color: var(--color-text-medium); font-size: 0.85rem; font-weight: 500; white-space: nowrap;">Valor Parcela <span class="required">*</span></label>
                                    <input type="text" id="loan-installment-value" class="form-input input-currency" required placeholder="R$ 0,00" style="width: 100%;">
                                </div>

                                <div style="flex: 1;"> <!-- Flexible width -->
                                    <label for="loan-real-rate" style="display: block; margin-bottom: 0.25rem; color: var(--color-text-medium); font-size: 0.85rem; font-weight: 500; white-space: nowrap;">Taxa Real</label>
                                    <input type="text" id="loan-real-rate" class="form-input" readonly style="background: #fff3e0; font-weight: bold; text-align: center; color: #e65100; font-size: 1.1rem; width: 100%;">
                                </div>
                            </div>
                            
                            <div style="grid-column: span 3;">
                                <small style="color: var(--color-text-muted); float: right; margin-top: -5px;">Taxa calculada sobre valor líquido recebido</small>
                            </div>

                            <!-- Row 2: Total, Contract Date, First Due Date (3 columns standard grid) -->
                            <div class="form-group">
                                <label for="loan-total">Total a Pagar</label>
                                <input type="text" id="loan-total" class="form-input" readonly style="background: var(--bg-secondary); font-weight: bold; text-align: right;">
                            </div>

                            <div class="form-group">
                                <label for="loan-contract-date">Data Contratação *</label>
                                <input type="date" id="loan-contract-date" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
                            </div>

                            <div class="form-group">
                                <label for="loan-first-due">Vencimento 1ª Parcela *</label>
                                <input type="date" id="loan-first-due" class="form-input" required>
                                <small style="color: var(--color-text-muted);">Auto-calculado (editável)</small>
                            </div>



                        </div>
                    </div>
                    <div class="account-modal-footer" style="padding: 1rem;">
                        <button class="btn-secondary" id="loan-btn-cancel" type="button">Cancelar</button>
                        <button class="btn-primary" id="loan-btn-save" type="button">Contratar</button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // Elements
                const descriptionInput = modal.querySelector('#loan-description');
                const companySelect = modal.querySelector('#loan-company');
                const accountSelect = modal.querySelector('#loan-account');
                const nominalInput = modal.querySelector('#loan-nominal');
                const feesInput = modal.querySelector('#loan-fees');
                const netInput = modal.querySelector('#loan-net');
                const installmentsInput = modal.querySelector('#loan-installments');
                const installmentValueInput = modal.querySelector('#loan-installment-value');
                const totalInput = modal.querySelector('#loan-total');
                const realRateInput = modal.querySelector('#loan-real-rate');
                const contractDateInput = modal.querySelector('#loan-contract-date');
                const gracePeriodInput = modal.querySelector('#loan-grace-period');
                const firstDueInput = modal.querySelector('#loan-first-due');
                const saveBtn = modal.querySelector('#loan-btn-save');
                const cancelBtn = modal.querySelector('#loan-btn-cancel');

                // Auto-calculate first due date based on contract date + grace period
                const updateFirstDueDate = () => {
                    const contractDate = contractDateInput.value;
                    const gracePeriod = parseInt(gracePeriodInput.value) || 0;

                    if (!contractDate) return;

                    const date = new Date(contractDate + 'T00:00:00');
                    date.setMonth(date.getMonth() + gracePeriod);

                    // Format as YYYY-MM-DD for date input
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');

                    firstDueInput.value = `${year}-${month}-${day}`;
                };

                // Initialize first due date
                updateFirstDueDate();

                // Listen for changes to contract date and grace period
                contractDateInput.addEventListener('change', updateFirstDueDate);
                gracePeriodInput.addEventListener('input', updateFirstDueDate);


                // Currency formatting
                const formatFloat = (num) => {
                    let str = Number(num).toFixed(2).replace('.', ',');
                    str = str.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                    return 'R$ ' + str;
                };

                const parseCurrencyValue = (str) => {
                    if (!str) return 0;
                    let clean = str.replace(/[^0-9,-]+/g, "");
                    clean = clean.replace(',', '.');
                    return parseFloat(clean) || 0;
                };

                // Calculate real monthly interest rate using Newton-Raphson method
                // INCLUDING grace period capitalization effect
                const calculateRealRate = (pv, pmt, n, gracePeriod = 0) => {
                    // Validate inputs
                    if (!pv || pv <= 0 || !pmt || pmt <= 0 || !n || n <= 0) {
                        return null;
                    }

                    // If payment equals present value divided by periods, it's zero interest
                    if (Math.abs(pmt * n - pv) < 0.01) {
                        return 0;
                    }

                    // Initial guess
                    let rate = ((pmt * n) / pv - 1) / (n + gracePeriod);

                    // Ensure initial rate is positive and reasonable
                    if (rate <= 0 || rate > 1) {
                        rate = 0.05;
                    }

                    // Newton-Raphson iterations
                    // CORRECT Formula: PV × (1+i)^g × i × (1+i)^n = PMT × [(1+i)^n - 1]
                    // Rearranged: PV × (1+i)^g × i × (1+i)^n - PMT × [(1+i)^n - 1] = 0

                    for (let iter = 0; iter < 50; iter++) {
                        const exp_g = Math.pow(1 + rate, gracePeriod);
                        const exp_n = Math.pow(1 + rate, n);

                        // f(i) = PV × (1+i)^g × i × (1+i)^n - PMT × [(1+i)^n - 1]
                        const f = pv * exp_g * rate * exp_n - pmt * (exp_n - 1);

                        // f'(i) = PV × (1+i)^(g+n-1) × [1 + i×(g + 1 + n)] - PMT × n × (1+i)^(n-1)
                        const exp_gn_minus1 = Math.pow(1 + rate, gracePeriod + n - 1);
                        const df = pv * exp_gn_minus1 * (1 + rate * (gracePeriod + 1 + n)) - pmt * n * Math.pow(1 + rate, n - 1);

                        if (Math.abs(df) < 0.0000001) break;

                        const newRate = rate - f / df;

                        // Check convergence
                        if (Math.abs(newRate - rate) < 0.00000001) {
                            return newRate * 100;
                        }

                        // Keep rate reasonable
                        rate = Math.max(0.00001, Math.min(newRate, 0.5));
                    }

                    return rate * 100;
                };

                // Currency masks
                [nominalInput, feesInput, installmentValueInput].forEach(input => {
                    input.addEventListener('focus', (e) => {
                        let val = e.target.value;
                        val = val.replace('R$', '').trim();
                        val = val.replace(/\./g, '');
                        e.target.value = val;
                    });

                    input.addEventListener('blur', (e) => {
                        let val = e.target.value;
                        if (val === '' || val === '-') {
                            e.target.value = '';
                        } else {
                            let num = parseCurrencyValue(val);
                            e.target.value = formatFloat(num);
                        }
                        updateCalculations();
                    });

                    input.addEventListener('input', updateCalculations);
                });

                // Also recalculate when installments or grace period changes
                installmentsInput.addEventListener('input', updateCalculations);
                gracePeriodInput.addEventListener('input', updateCalculations);

                // Auto-calculate net value, total, and real rate
                function updateCalculations() {
                    const nominal = parseCurrencyValue(nominalInput.value);
                    const fees = parseCurrencyValue(feesInput.value);
                    const net = nominal - fees;

                    netInput.value = formatFloat(net);

                    const parcels = parseInt(installmentsInput.value) || 0;
                    const parcelVal = parseCurrencyValue(installmentValueInput.value);
                    const gracePeriod = parseInt(gracePeriodInput.value) || 0;
                    const total = parcels * parcelVal;

                    totalInput.value = formatFloat(total);

                    // Calculate real monthly rate WITH grace period
                    const monthlyRate = calculateRealRate(net, parcelVal, parcels, gracePeriod);

                    if (monthlyRate === null) {
                        realRateInput.value = '-';
                    } else if (monthlyRate === 0) {
                        realRateInput.value = '0,00 % a.m. (Sem Juros)';
                    } else {
                        realRateInput.value = monthlyRate.toFixed(4).replace('.', ',') + ' % a.m.';
                    }
                }

                // Account filtering
                const updateAccountList = () => {
                    const selectedCompanyId = parseInt(companySelect.value);
                    accountSelect.innerHTML = '<option value="">Selecione...</option>';

                    if (selectedCompanyId) {
                        const filteredAccounts = accounts.filter(acc => acc.company_id === selectedCompanyId);
                        filteredAccounts.forEach(acc => {
                            const option = document.createElement('option');
                            option.value = acc.id;
                            option.textContent = acc.name;
                            accountSelect.appendChild(option);
                        });
                    }
                };

                companySelect.addEventListener('change', updateAccountList);

                // Close logic
                const close = (result) => {
                    modal.classList.add('animate-float-out');
                    overlay.classList.add('fade-out');
                    setTimeout(() => {
                        if (container.contains(overlay)) container.removeChild(overlay);
                        resolve(result);
                    }, 200);
                };

                cancelBtn.onclick = () => close(null);

                // Save logic
                saveBtn.onclick = async () => {
                    if (!descriptionInput.value || !companySelect.value || !accountSelect.value ||
                        !parseCurrencyValue(nominalInput.value) || !parseCurrencyValue(installmentValueInput.value) ||
                        !installmentsInput.value || !contractDateInput.value || !firstDueInput.value) {
                        alert('Por favor, preencha todos os campos obrigatórios.');
                        return;
                    }

                    const nominal = parseCurrencyValue(nominalInput.value);
                    const fees = parseCurrencyValue(feesInput.value);
                    const net = nominal - fees;
                    const parcels = parseInt(installmentsInput.value);
                    const parcelVal = parseCurrencyValue(installmentValueInput.value);
                    const gracePeriod = parseInt(gracePeriodInput.value) || 0;
                    const realMonthlyRate = calculateRealRate(net, parcelVal, parcels, gracePeriod);

                    const data = {
                        projectId,
                        description: descriptionInput.value,
                        companyId: companySelect.value,
                        accountId: accountSelect.value,
                        nominalValue: nominal,                  // Valor do contrato
                        fees: fees,                             // TAC, IOF, etc
                        netValue: net,                          // Valor que cai na conta
                        totalValue: parcels * parcelVal,        // Total a pagar
                        monthlyInterestRate: realMonthlyRate || 0,   // Taxa real calculada (% a.m.)
                        installments: parcels,
                        installmentValue: parcelVal,
                        contractDate: contractDateInput.value,
                        gracePeriod: parseInt(gracePeriodInput.value) || 0,  // Prazo de carência
                        firstDueDate: firstDueInput.value,
                        registerEntry: true                     // Sempre registra entrada
                    };

                    await onSave(data);
                    close(data);
                };

                setTimeout(() => descriptionInput.focus(), 100);

            } catch (error) {
                console.error('[LoanModal] Error:', error);
                alert('Erro ao abrir formulário: ' + error.message);
                resolve(null);
            }
        });
    }
};
