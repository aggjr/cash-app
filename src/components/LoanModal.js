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
                modal.style.maxWidth = '700px';
                modal.style.width = '95%';

                modal.innerHTML = `
                    <div class="account-modal-body" style="padding: 1rem; overflow-y: auto; max-height: 85vh;">
                        <h3 style="margin: 0 0 1rem 0; color: var(--color-primary); font-size: 1.1rem;">🏦 Contratar Empréstimo</h3>
                        
                        <div class="form-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
                            
                            <!-- Description -->
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="loan-description">Descrição *</label>
                                <input type="text" id="loan-description" class="form-input" required placeholder="Ex: Capital de Giro Safra 2024">
                            </div>

                            <!-- Company and Account -->
                            <div class="form-group">
                                <label for="loan-company">Banco/Instituição *</label>
                                <select id="loan-company" class="form-input" required>
                                    <option value="">Selecione...</option>
                                    ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="loan-account">Conta (Recebimento/Pagamento) *</label>
                                <select id="loan-account" class="form-input" required>
                                    <option value="">Selecione...</option>
                                </select>
                            </div>

                            <!-- Financial Details -->
                            <div class="form-group">
                                <label for="loan-principal">Valor do Empréstimo *</label>
                                <input type="text" id="loan-principal" class="form-input input-currency" required placeholder="R$ 0,00">
                                <small style="color: var(--color-text-muted);">Valor que será creditado</small>
                            </div>

                            <div class="form-group">
                                <label for="loan-interest">Taxa de Juros (% a.a.)</label>
                                <input type="number" id="loan-interest" class="form-input" step="0.01" min="0" placeholder="0,00" style="text-align: right;">
                                <small style="color: var(--color-text-muted);">Informativo</small>
                            </div>

                            <div class="form-group">
                                <label for="loan-installments">Nº de Parcelas *</label>
                                <input type="number" id="loan-installments" class="form-input" min="1" value="12" required>
                            </div>

                            <div class="form-group">
                                <label for="loan-installment-value">Valor da Parcela *</label>
                                <input type="text" id="loan-installment-value" class="form-input input-currency" required placeholder="R$ 0,00">
                                <small style="color: var(--color-text-muted);">Valor mensal fixo</small>
                            </div>

                            <!-- Total -->
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="loan-total">Total a Pagar</label>
                                <input type="text" id="loan-total" class="form-input" readonly style="background: var(--bg-secondary); font-weight: bold; font-size: 1.1rem; text-align: right; color: var(--color-primary);">
                            </div>

                            <!-- Dates -->
                            <div class="form-group">
                                <label for="loan-contract-date">Data da Contratação *</label>
                                <input type="date" id="loan-contract-date" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
                            </div>

                            <div class="form-group">
                                <label for="loan-first-due">Vencimento 1ª Parcela *</label>
                                <input type="date" id="loan-first-due" class="form-input" required>
                            </div>

                            <!-- Register Entry Option -->
                            <div class="form-group" style="grid-column: span 2; background: var(--bg-hover); padding: 0.75rem; border-radius: 8px;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <input type="checkbox" id="loan-register-entry" checked style="width: auto; margin: 0;">
                                    <label for="loan-register-entry" style="margin: 0; cursor: pointer; flex: 1;">
                                        <strong>Registrar Entrada do Dinheiro</strong>
                                        <br>
                                        <small style="color: var(--color-text-muted);">Cria um lançamento de entrada com o valor do empréstimo</small>
                                    </label>
                                </div>
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
                const principalInput = modal.querySelector('#loan-principal');
                const interestInput = modal.querySelector('#loan-interest');
                const installmentsInput = modal.querySelector('#loan-installments');
                const installmentValueInput = modal.querySelector('#loan-installment-value');
                const totalInput = modal.querySelector('#loan-total');
                const contractDateInput = modal.querySelector('#loan-contract-date');
                const firstDueInput = modal.querySelector('#loan-first-due');
                const registerEntryCheck = modal.querySelector('#loan-register-entry');
                const saveBtn = modal.querySelector('#loan-btn-save');
                const cancelBtn = modal.querySelector('#loan-btn-cancel');

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

                // Currency masks
                [principalInput, installmentValueInput].forEach(input => {
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
                        updateTotal();
                    });

                    input.addEventListener('input', updateTotal);
                });

                installmentsInput.addEventListener('input', updateTotal);

                // Auto-calculate total
                function updateTotal() {
                    const parcels = parseInt(installmentsInput.value) || 0;
                    const parcelVal = parseCurrencyValue(installmentValueInput.value);
                    const total = parcels * parcelVal;
                    totalInput.value = formatFloat(total);
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
                        !parseCurrencyValue(principalInput.value) || !parseCurrencyValue(installmentValueInput.value) ||
                        !installmentsInput.value || !contractDateInput.value || !firstDueInput.value) {
                        alert('Por favor, preencha todos os campos obrigatórios.');
                        return;
                    }

                    const data = {
                        projectId,
                        description: descriptionInput.value,
                        companyId: companySelect.value,
                        accountId: accountSelect.value,
                        principalValue: parseCurrencyValue(principalInput.value),
                        totalValue: parseCurrencyValue(totalInput.value),
                        interestRate: interestInput.value || null,
                        installments: installmentsInput.value,
                        contractDate: contractDateInput.value,
                        firstDueDate: firstDueInput.value,
                        registerEntry: registerEntryCheck.checked
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
