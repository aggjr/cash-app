import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const TransferenciaModal = {
    show: ({ transferencia, projectId, onSave }) => {
        return new Promise((resolve) => {
            const API_BASE_URL = getApiBaseUrl();
            const isEdit = !!transferencia;
            const title = isEdit ? 'Editar Transferência' : 'Nova Transferência';

            const token = localStorage.getItem('token');
            const accountsPromise = fetch(`${API_BASE_URL}/accounts?projectId=${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json());

            accountsPromise.then(accountsRes => {
                const accounts = Array.isArray(accountsRes) ? accountsRes : [];

                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';

                const modal = document.createElement('div');
                modal.className = 'dialog-box animate-float-in';
                // Increased width to accommodate 3 items in a row (Account, Account, Value) comfortable
                modal.style.maxWidth = '900px';
                modal.style.width = '100%';

                const formatDateForInput = (str) => {
                    if (!str) return '';
                    if (str.includes('T')) return str.split('T')[0];
                    return str;
                };

                modal.innerHTML = `
                    <div class="dialog-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="dialog-body">
                        <div class="form-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem;">
                            
                            <!-- Row 1: Data Prevista | Data Real | Valor -->
                            <div class="form-group" style="grid-column: span 2;">
                                <label>Data Prevista</label>
                                <input type="date" id="transf-prevista" class="form-input" 
                                    value="${formatDateForInput(transferencia?.data_prevista)}">
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label>Data Real</label>
                                <input type="date" id="transf-real" class="form-input" 
                                    value="${formatDateForInput(transferencia?.data_real)}">
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label>Valor (R$) *</label>
                                <input type="number" step="0.01" id="transf-valor" class="form-input" placeholder="0.00" value="${transferencia?.valor || ''}">
                            </div>

                            <!-- Row 2: Conta Origem | Conta Destino -->
                            <div class="form-group" style="grid-column: span 3;">
                                <label>Conta Origem (Sai) *</label>
                                <select id="transf-source" class="form-input">
                                    <option value="">Selecione...</option>
                                    ${accounts.map(a => `<option value="${a.id}" ${transferencia?.source_account_id === a.id ? 'selected' : ''}>${a.name} (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.current_balance)})</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="grid-column: span 3;">
                                <label>Conta Destino (Entra) *</label>
                                <select id="transf-dest" class="form-input">
                                    <option value="">Selecione...</option>
                                    ${accounts.map(a => `<option value="${a.id}" ${transferencia?.destination_account_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                            </div>

                            <!-- Row 3: Description -->
                            <div class="form-group" style="grid-column: span 6;">
                                <label>Descrição</label>
                                <textarea id="transf-desc" class="form-input" placeholder="Detalhes da transferência..." style="resize:none; height:100px;">${transferencia?.descricao || ''}</textarea>
                            </div>

                            ${isEdit ? `
                            <div style="grid-column: span 6; display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                                <input type="checkbox" id="transf-active" ${transferencia.active ? 'checked' : ''}>
                                <label for="transf-active">Ativo</label>
                            </div>
                            ` : ''}

                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn-secondary" id="btn-cancel">Cancelar</button>
                        <button class="btn-primary" id="btn-save">${isEdit ? 'Salvar' : 'Transferir'}</button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // --- Logic for Cross-Exclusion ---
                const sourceSelect = modal.querySelector('#transf-source');
                const destSelect = modal.querySelector('#transf-dest');

                const updateOptions = () => {
                    const paramsSource = { selected: sourceSelect.value, target: destSelect };
                    const paramsDest = { selected: destSelect.value, target: sourceSelect };

                    // Helper to disable option in target if it matches selected
                    const applyExclusion = (selectedVal, targetSelect) => {
                        Array.from(targetSelect.options).forEach(opt => {
                            if (opt.value && opt.value === selectedVal) {
                                opt.disabled = true;
                                if (opt.selected) targetSelect.value = ""; // Reset if currently selected became disabled
                            } else {
                                opt.disabled = false;
                            }
                        });
                    };

                    applyExclusion(paramsSource.selected, paramsSource.target);
                    applyExclusion(paramsDest.selected, paramsDest.target);
                };

                sourceSelect.addEventListener('change', updateOptions);
                destSelect.addEventListener('change', updateOptions);

                // Initial run to apply existing selection exclusions
                updateOptions();
                // --------------------------------

                const btnCancel = modal.querySelector('#btn-cancel');
                const btnSave = modal.querySelector('#btn-save');

                const close = (result) => {
                    modal.classList.add('animate-float-out');
                    overlay.classList.add('fade-out');
                    setTimeout(() => {
                        if (container.contains(overlay)) container.removeChild(overlay);
                        resolve(result);
                    }, 200);
                };

                btnCancel.onclick = () => close(null);

                btnSave.onclick = async () => {
                    // Data Fato is hidden. Logic: Use Data Real if available, else Data Prevista.
                    // If neither, error? Or default to today?
                    // User requirement implies these are the only dates. 
                    // Let's prioritize Real > Prevista.
                    const dataPrevista = modal.querySelector('#transf-prevista').value;
                    const dataReal = modal.querySelector('#transf-real').value;
                    const valor = modal.querySelector('#transf-valor').value;
                    const descricao = modal.querySelector('#transf-desc').value;
                    const sourceAccountId = modal.querySelector('#transf-source').value;
                    const destinationAccountId = modal.querySelector('#transf-dest').value;
                    const active = isEdit ? (modal.querySelector('#transf-active').checked ? 1 : 0) : 1;

                    // Validation
                    if (!sourceAccountId || !destinationAccountId || !valor) {
                        Dialogs.alert('Preencha Contas e Valor.', 'Erro de Validação');
                        return;
                    }

                    if (sourceAccountId === destinationAccountId) {
                        Dialogs.alert('A conta de origem e destino devem ser diferentes.', 'Erro de Lógica');
                        return;
                    }

                    const dataFato = dataReal || dataPrevista;
                    if (!dataFato) {
                        Dialogs.alert('Informe pelo menos uma data (Prevista ou Real).', 'Erro de Validação');
                        return;
                    }

                    const data = {
                        dataFato, // Backend needs this
                        dataPrevista: dataPrevista || null,
                        dataReal: dataReal || null,
                        valor,
                        descricao,
                        sourceAccountId,
                        destinationAccountId,
                        active
                    };

                    if (onSave) await onSave(data);
                    close(data);
                };

            }).catch(err => {
                console.error(err);
                Dialogs.alert(`Erro ao carregar contas: ${err.message}`, 'Erro');
                resolve(null);
            });
        });
    }
};
