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
                            <input type="text" name="description" required placeholder="Ex: Capital de Giro Safra">
                        </div>

                        <!-- Lender -->
                        <div class="form-group">
                            <label>Fornecedor (Banco/Credor) *</label>
                            <select name="companyId" required id="loan-company-select">
                                <option value="">Carregando...</option>
                            </select>
                        </div>

                        <!-- Account -->
                        <div class="form-group">
                            <label>Conta (Entrada/Pagamentos) *</label>
                            <select name="accountId" required id="loan-account-select">
                                <option value="">Carregando...</option>
                            </select>
                        </div>

                        <!-- Values Row -->
                        <div class="form-group">
                            <label>Valor Tomado (Entrada) *</label>
                            <input type="text" name="principalValue" class="input-currency" required placeholder="R$ 0,00">
                        </div>

                        <div class="form-group">
                            <label>Valor da Parcela *</label>
                            <input type="text" name="installmentValue" class="input-currency" required placeholder="R$ 0,00">
                        </div>

                        <!-- Installments Row -->
                        <div class="form-group">
                            <label>Nº Parcelas *</label>
                            <input type="number" name="installments" min="1" value="12" required>
                        </div>

                        <div class="form-group">
                            <label>Total a Pagar (Auto)</label>
                            <input type="text" name="totalValue" readonly style="background: var(--bg-secondary); cursor: not-allowed; font-weight: bold;">
                        </div>

                        <!-- Dates Row -->
                        <div class="form-group">
                            <label>Data Contratação *</label>
                            <input type="date" name="contractDate" required value="${new Date().toISOString().split('T')[0]}">
                        </div>

                        <div class="form-group">
                            <label>Vencimento 1ª Parcela *</label>
                            <input type="date" name="firstDueDate" required>
                        </div>

                        <!-- Toggle Entry -->
                        <div class="form-group full-width" style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-hover); padding: 0.75rem; border-radius: 8px; margin-top: 1rem;">
                            <input type="checkbox" name="registerEntry" id="reg-entry" checked style="width: auto; margin: 0;">
                            <label for="reg-entry" style="margin: 0; cursor: pointer;">Registrar Entrada do Dinheiro na Conta?</label>
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
                        fetch(`/api/projects/${projectId}/companies`, { headers: getHeaders() }),
                        fetch(`/api/projects/${projectId}/accounts`, { headers: getHeaders() })
                    ]);

                    const companies = await companiesRes.json();
                    const accounts = await accountsRes.json();

                    const compSelect = modal.querySelector('#loan-company-select');
                    compSelect.innerHTML = '<option value="">Selecione...</option>' +
                        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

                    const accSelect = modal.querySelector('#loan-account-select');
                    accSelect.innerHTML = '<option value="">Selecione...</option>' +
                        accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

                } catch (err) {
                    console.error('Load data error', err);
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
