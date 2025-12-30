import { formatCurrency, parseCurrency } from '../utils/formatters.js';

export const LoanModal = {
    show: ({ projectId, onSave }) => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';

            const modal = document.createElement('div');
            modal.className = 'modal-content';
            modal.style.maxWidth = '600px';

            // HTML Structure
            modal.innerHTML = `
                <div class="modal-header">
                    <h2>🏦 Contratar Empréstimo</h2>
                    <button class="btn-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="loan-form" class="form-grid">
                        
                        <!-- Description -->
                        <div class="form-group full-width">
                            <label>Descrição *</label>
                            <input type="text" name="description" required placeholder="Ex: Capital de Giro Safra 2024">
                        </div>

                        <!-- Lender -->
                        <div class="form-group">
                            <label>Banco/Instituição Financeira *</label>
                            <select name="companyId" required id="loan-company-select">
                                <option value="">Carregando...</option>
                            </select>
                        </div>

                        <!-- Account -->
                        <div class="form-group">
                            <label>Conta (Recebimento/Pagamentos) *</label>
                            <select name="accountId" required id="loan-account-select">
                                <option value="">Carregando...</option>
                            </select>
                        </div>

                        <!-- Financial Details Section -->
                        <div class="form-group full-width" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border-light);">
                            <strong style="color: var(--color-primary);">💰 Detalhes Financeiros</strong>
                        </div>

                        <!-- Principal Value -->
                        <div class="form-group">
                            <label>Valor do Empréstimo *</label>
                            <input type="text" name="principalValue" class="input-currency" required placeholder="R$ 0,00">
                            <small style="color: var(--color-text-muted);">Valor que será creditado</small>
                        </div>

                        <!-- Interest Rate -->
                        <div class="form-group">
                            <label>Taxa de Juros (% a.a.)</label>
                            <input type="number" name="interestRate" step="0.01" min="0" placeholder="0,00" style="text-align: right;">
                            <small style="color: var(--color-text-muted);">Informativo</small>
                        </div>

                        <!-- Installments Row -->
                        <div class="form-group">
                            <label>Nº de Parcelas *</label>
                            <input type="number" name="installments" min="1" value="12" required>
                        </div>

                        <div class="form-group">
                            <label>Valor da Parcela *</label>
                            <input type="text" name="installmentValue" class="input-currency" required placeholder="R$ 0,00">
                            <small style="color: var(--color-text-muted);">Valor mensal fixo</small>
                        </div>

                        <!-- Total to Pay (Auto) -->
                        <div class="form-group full-width">
                            <label>Total a Pagar (Calculado Automaticamente)</label>
                            <input type="text" name="totalValue" readonly style="background: var(--bg-secondary); cursor: not-allowed; font-weight: bold; font-size: 1.1rem; text-align: right; color: var(--color-primary);">
                        </div>

                        <!-- Dates Section -->
                        <div class="form-group full-width" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border-light);">
                            <strong style="color: var(--color-primary);">📅 Datas e Prazos</strong>
                        </div>

                        <div class="form-group">
                            <label>Data da Contratação *</label>
                            <input type="date" name="contractDate" required value="${new Date().toISOString().split('T')[0]}">
                        </div>

                        <div class="form-group">
                            <label>Vencimento 1ª Parcela *</label>
                            <input type="date" name="firstDueDate" required>
                        </div>

                        <!-- Options Section -->
                        <div class="form-group full-width" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border-light);">
                            <strong style="color: var(--color-primary);">⚙️ Opções</strong>
                        </div>

                        <!-- Toggle Entry -->
                        <div class="form-group full-width" style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-hover); padding: 0.75rem; border-radius: 8px;">
                            <input type="checkbox" name="registerEntry" id="reg-entry" checked style="width: auto; margin: 0;">
                            <label for="reg-entry" style="margin: 0; cursor: pointer; flex: 1;">
                                <strong>Registrar Entrada do Dinheiro</strong>
                                <br>
                                <small style="color: var(--color-text-muted);">Cria um lançamento de entrada com o valor do empréstimo na conta selecionada</small>
                            </label>
                        </div>


                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="btn-cancel">Cancelar</button>
                    <button class="btn-primary" id="btn-save">Contratar</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Helpers
            const getHeaders = () => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            });

            // Load Data (Companies/Accounts)
            const loadData = async () => {
                try {
                    const [companiesRes, accountsRes] = await Promise.all([
                        fetch(`/api/companies?projectId=${projectId}`, { headers: getHeaders() }),
                        fetch(`/api/accounts?projectId=${projectId}`, { headers: getHeaders() })
                    ]);

                    if (companiesRes.ok) {
                        const companies = await companiesRes.json();
                        const compSelect = modal.querySelector('#loan-company-select');
                        compSelect.innerHTML = '<option value="">Selecione...</option>' +
                            (Array.isArray(companies) ? companies : []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                    }

                    if (accountsRes.ok) {
                        const accounts = await accountsRes.json();
                        const accSelect = modal.querySelector('#loan-account-select');
                        accSelect.innerHTML = '<option value="">Selecione...</option>' +
                            (Array.isArray(accounts) ? accounts : []).map(a => `<option value="${a.id}">${a.name}</option>`).join('');
                    }

                } catch (err) {
                    console.error('[LoanModal] Load data error:', err);
                    alert('Erro ao carregar dados: ' + err.message);
                }
            };
            loadData();

            // Currency Masks
            const currencyInputs = modal.querySelectorAll('.input-currency');
            currencyInputs.forEach(input => {
                input.addEventListener('input', (e) => {
                    let value = e.target.value.replace(/\D/g, '');
                    value = (parseInt(value) / 100).toFixed(2);
                    e.target.value = formatCurrency(parseFloat(value));
                    updateTotal();
                });
            });

            // Auto-Calculate Total
            const updateTotal = () => {
                const parcels = parseInt(modal.querySelector('[name="installments"]').value) || 0;
                const parcelVal = parseCurrency(modal.querySelector('[name="installmentValue"]').value);
                const total = parcels * parcelVal;
                modal.querySelector('[name="totalValue"]').value = formatCurrency(total);
            };

            modal.querySelector('[name="installments"]').addEventListener('input', updateTotal);

            // Close Logic
            const close = () => {
                if (document.body.contains(overlay)) document.body.removeChild(overlay);
                resolve(null);
            };

            modal.querySelector('.btn-close').onclick = close;
            modal.querySelector('#btn-cancel').onclick = close;

            // Save Logic
            modal.querySelector('#btn-save').onclick = async () => {
                const form = modal.querySelector('form');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }

                const data = {
                    projectId,
                    description: form.description.value,
                    companyId: form.companyId.value,
                    accountId: form.accountId.value,
                    principalValue: parseCurrency(form.principalValue.value),
                    totalValue: parseCurrency(form.totalValue.value),
                    interestRate: form.interestRate.value || null,
                    installments: form.installments.value,
                    contractDate: form.contractDate.value,
                    firstDueDate: form.firstDueDate.value,
                    registerEntry: form.registerEntry.checked
                };

                await onSave(data);
                close();
            };
        });
    }
};
