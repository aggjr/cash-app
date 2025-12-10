import { TreeSelector } from './TreeSelector.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const DespesaModal = {
    show({ despesa = null, projectId, onSave, onCancel }) {
        return new Promise(async (resolve) => {
            try {
                const API_BASE_URL = getApiBaseUrl();
                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                const isEdit = despesa !== null;
                let hasChanges = false;

                // Mark as dirty helper
                const markAsDirty = () => { hasChanges = true; };

                // Fetch data
                const token = localStorage.getItem('token');
                let tipoDespesas = [];
                let companies = [];
                let accounts = [];

                try {
                    const [tipoResponse, companyResponse, accountResponse] = await Promise.all([
                        fetch(`${API_BASE_URL}/tipo_despesa?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${API_BASE_URL}/companies?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${API_BASE_URL}/accounts?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } })
                    ]);

                    if (tipoResponse.ok) {
                        const json = await tipoResponse.json();
                        tipoDespesas = Array.isArray(json) ? json : [];
                    }
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

                const formatDateForInput = (dateString) => {
                    if (!dateString) return '';
                    if (dateString.includes('T')) return dateString.split('T')[0];
                    return dateString;
                };

                modal.innerHTML = `
                    <div class="account-modal-body" style="padding: 1rem; overflow-y: hidden; max-height: 95vh;">
                        <h3 style="margin: 0 0 1rem 0; color: var(--color-primary); font-size: 1.1rem;">${isEdit ? 'Editar Saída' : 'Nova Saída'}</h3>
                        
                        <div class="form-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.75rem;">
                            
                            <!-- Row 1: Dates (Span 2 each) -->
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="despesa-data-fato">Data do Fato <span class="required">*</span></label>
                                <input type="date" id="despesa-data-fato" class="form-input" 
                                    value="${formatDateForInput(despesa?.data_fato)}" required />
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="despesa-data-prevista">Data Prevista <span class="required">*</span></label>
                                <input type="date" id="despesa-data-prevista" class="form-input" 
                                    value="${formatDateForInput(despesa?.data_prevista_pagamento)}" required />
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="despesa-data-real">Data Real</label>
                                <input type="date" id="despesa-data-real" class="form-input" 
                                    value="${formatDateForInput(despesa?.data_real_pagamento)}" />
                            </div>

                            <!-- Row 2: Company, Account, Value (Span 2 each) -->
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="despesa-company">Empresa <span class="required">*</span></label>
                                <select id="despesa-company" class="form-input" required>
                                    <option value="">Selecione...</option>
                                    ${companies.map(c => `<option value="${c.id}" ${despesa?.company_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="despesa-account">Conta <span class="required">*</span></label>
                                <select id="despesa-account" class="form-input" required>
                                    <option value="">Selecione...</option>
                                    ${accounts.map(a => `<option value="${a.id}" ${despesa?.account_id == a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="despesa-valor">Valor (R$) <span class="required">*</span></label>
                                <input type="text" id="despesa-valor" class="form-input" 
                                    placeholder="R$ 0,00" required />
                            </div>

                            <!-- Row 3: Description (Span 3) and Tree (Span 3) Side-by-Side Symmetrical -->
                            
                            <div class="form-group" style="grid-column: span 3; display: flex; flex-direction: column;">
                                <label for="despesa-descricao">Descrição</label>
                                <textarea id="despesa-descricao" class="form-input" placeholder="Opcional" style="resize: none; height: 200px; font-family: inherit;">${despesa?.descricao || ''}</textarea>
                            </div>

                            <div class="form-group" style="grid-column: span 3; display: flex; flex-direction: column;">
                                <label>Tipo de Saída <span class="required">*</span></label>
                                <div id="tree-selector-container" style="flex: 1; height: 200px;"></div>
                                <input type="hidden" id="despesa-tipo-despesa-id" value="${despesa?.tipo_despesa_id || ''}" />
                            </div>

                        </div>
                    </div>
                    <!-- Footer with Z-Index ensure -->
                    <div class="account-modal-footer" style="padding: 1rem; position: relative; z-index: 100;">
                        <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                        <button class="btn-primary" id="modal-save" type="button">
                            ${isEdit ? 'Salvar Alterações' : 'Criar Saída'}
                        </button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // Elements
                const dataFatoInput = modal.querySelector('#despesa-data-fato');
                const dataPrevistaInput = modal.querySelector('#despesa-data-prevista');
                const dataRealInput = modal.querySelector('#despesa-data-real');
                const valorInput = modal.querySelector('#despesa-valor');
                const tipoDespesaIdInput = modal.querySelector('#despesa-tipo-despesa-id');
                const treeContainer = modal.querySelector('#tree-selector-container');
                const companySelect = modal.querySelector('#despesa-company');
                const accountSelect = modal.querySelector('#despesa-account');
                const descricaoInput = modal.querySelector('#despesa-descricao');
                const saveBtn = modal.querySelector('#modal-save');
                const cancelBtn = modal.querySelector('#modal-cancel');

                const validate = () => {
                    let isValid = true;
                    if (!dataFatoInput.value) { dataFatoInput.classList.add('input-error'); isValid = false; } else dataFatoInput.classList.remove('input-error');
                    if (!dataPrevistaInput.value) { dataPrevistaInput.classList.add('input-error'); isValid = false; } else dataPrevistaInput.classList.remove('input-error');
                    if (!valorInput.value) { valorInput.classList.add('input-error'); isValid = false; } else valorInput.classList.remove('input-error');
                    if (!tipoDespesaIdInput.value) { treeContainer.style.border = '1px solid #EF4444'; isValid = false; } else treeContainer.style.border = '1px solid var(--color-border-light)';
                    if (!companySelect.value) { companySelect.classList.add('input-error'); isValid = false; } else companySelect.classList.remove('input-error');
                    if (!accountSelect.value) { accountSelect.classList.add('input-error'); isValid = false; } else accountSelect.classList.remove('input-error');
                    return isValid;
                };

                // Initialize Tree Selector
                const initialTipoId = parseInt(tipoDespesaIdInput.value);
                TreeSelector.render(treeContainer, tipoDespesas, initialTipoId, (selectedId) => {
                    if (initialTipoId !== selectedId) {
                        hasChanges = true;
                    }
                    tipoDespesaIdInput.value = selectedId;
                    validate();
                });

                // Force inner height for symmetry
                const treeEl = treeContainer.querySelector('.tree-selector');
                if (treeEl) {
                    treeEl.style.height = '100%';
                    treeEl.style.boxSizing = 'border-box';
                }

                // Currency formatting strategies
                const formatFloat = (num) => {
                    let str = Number(num).toFixed(2).replace('.', ',');
                    str = str.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                    return 'R$ ' + str;
                };

                const parseCurrency = (str) => {
                    if (!str) return 0;
                    let clean = str.replace(/[^0-9,-]+/g, "");
                    clean = clean.replace(',', '.');
                    return parseFloat(clean) || 0;
                };

                if (despesa?.valor !== undefined && despesa?.valor !== null) {
                    valorInput.value = formatFloat(Number(despesa.valor));
                }

                // On Focus: Show raw value for easy editing
                valorInput.addEventListener('focus', (e) => {
                    let val = e.target.value;
                    val = val.replace('R$', '').trim();
                    val = val.replace(/\./g, '');
                    e.target.value = val;
                });

                // On Blur: Format back to Currency
                valorInput.addEventListener('blur', (e) => {
                    let val = e.target.value;
                    if (val === '' || val === '-') {
                        e.target.value = '';
                    } else {
                        let num = parseCurrency(val);
                        e.target.value = formatFloat(num);
                    }
                    validate();
                });

                // On Input: Allow valid characters only
                valorInput.addEventListener('input', (e) => {
                    let val = e.target.value;
                    let clean = val.replace(/[^0-9,-]/g, '');
                    if (clean !== val) e.target.value = clean;
                    validate();
                });

                setTimeout(() => { dataFatoInput.focus(); }, 100);

                // Change Tracking
                [dataFatoInput, dataPrevistaInput, dataRealInput, valorInput, companySelect, accountSelect, descricaoInput].forEach(el => {
                    if (el) {
                        el.addEventListener('input', markAsDirty);
                        el.addEventListener('change', markAsDirty);
                    }
                });

                const close = (result) => {
                    document.removeEventListener('keydown', handleKeydown);
                    modal.classList.add('animate-float-out');
                    overlay.classList.add('fade-out');
                    setTimeout(() => {
                        if (container.contains(overlay)) container.removeChild(overlay);
                        resolve(result);
                    }, 200);
                };

                // Custom Confirm Dialog Helper (Internal)
                const showCustomConfirm = (message, confirmText = 'Sim, Cancelar') => {
                    return new Promise((resolveConfirm) => {
                        const confirmOverlay = document.createElement('div');
                        confirmOverlay.className = 'dialog-overlay';
                        confirmOverlay.style.zIndex = '100000';
                        confirmOverlay.style.backgroundColor = 'rgba(0,0,0,0.4)';

                        const confirmBox = document.createElement('div');
                        confirmBox.style.background = 'white';
                        confirmBox.style.padding = '24px';
                        confirmBox.style.borderRadius = '12px';
                        confirmBox.style.maxWidth = '400px';
                        confirmBox.style.width = '90%';
                        confirmBox.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
                        confirmBox.style.textAlign = 'center';
                        confirmBox.className = 'animate-float-in';

                        confirmBox.innerHTML = `
                            <h3 style="margin: 0 0 16px 0; color: var(--color-primary); font-size: 1.25rem;">Confirmação</h3>
                            <p style="margin: 0 0 24px 0; color: #555; line-height: 1.5;">${message}</p>
                            <div style="display: flex; gap: 12px; justify-content: center;">
                                <button id="confirm-no" style="
                                    background: transparent; border: 1px solid #ccc; padding: 8px 16px; 
                                    border-radius: 6px; cursor: pointer; color: #555; font-weight: 500;">
                                    Não
                                </button>
                                <button id="confirm-yes" style="
                                    background: var(--color-primary); border: none; padding: 8px 16px; 
                                    border-radius: 6px; cursor: pointer; color: white; font-weight: 500;">
                                    ${confirmText}
                                </button>
                            </div>
                        `;

                        confirmOverlay.appendChild(confirmBox);
                        document.body.appendChild(confirmOverlay);

                        const closeConfirm = (val) => {
                            if (document.body.contains(confirmOverlay)) {
                                document.body.removeChild(confirmOverlay);
                            }
                            resolveConfirm(val);
                        };

                        const btnNo = confirmOverlay.querySelector('#confirm-no');
                        const btnYes = confirmOverlay.querySelector('#confirm-yes');

                        if (btnNo) btnNo.onclick = () => closeConfirm(false);
                        if (btnYes) btnYes.onclick = () => closeConfirm(true);
                        confirmOverlay.onclick = (e) => { if (e.target === confirmOverlay) closeConfirm(false); };
                    });
                };

                // Close / Cancel Logic
                const requestClose = async () => {
                    try {
                        if (hasChanges) {
                            const confirmed = await showCustomConfirm('Tem certeza que deseja cancelar? As alterações não salvas serão perdidas.');
                            if (!confirmed) return;
                        }
                        close(null);
                        if (onCancel) onCancel();
                    } catch (e) {
                        console.error('Cancel Error:', e);
                        close(null);
                    }
                };

                const handleKeydown = async (e) => {
                    if (!document.body.contains(modal)) return;

                    if (e.key === 'Escape') {
                        e.preventDefault();
                        requestClose();
                        return;
                    }

                    if (e.key === 'Enter') {
                        if (document.activeElement === descricaoInput) return;
                        e.preventDefault();
                        if (hasChanges) {
                            const confirmSave = await showCustomConfirm('Deseja salvar as alterações realizadas?', 'Sim, Salvar');
                            if (confirmSave) saveBtn.click();
                        } else {
                            saveBtn.click();
                        }
                    }
                };

                document.addEventListener('keydown', handleKeydown);

                saveBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    try {
                        if (!validate()) {
                            alert('Existem campos obrigatórios não preenchidos (marcados em vermelho).');
                            return;
                        }

                        const data = {
                            dataFato: dataFatoInput.value,
                            dataPrevistaPagamento: dataPrevistaInput.value,
                            dataRealPagamento: dataRealInput.value || null,
                            valor: parseCurrency(valorInput.value),
                            descricao: descricaoInput.value.trim(),
                            tipoDespesaId: parseInt(tipoDespesaIdInput.value),
                            companyId: parseInt(companySelect.value),
                            accountId: parseInt(accountSelect.value)
                        };
                        if (isEdit) {
                            data.id = despesa.id;
                            data.active = despesa.active !== undefined ? despesa.active : true;
                        }
                        close(data);
                        if (onSave) onSave(data);
                    } catch (e) {
                        alert('Erro ao salvar: ' + e.message);
                    }
                });

                if (cancelBtn) {
                    cancelBtn.onclick = null;
                    cancelBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        requestClose();
                    });
                }

                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) requestClose();
                });

            } catch (fatalError) {
                console.error('Modal Fatal Error:', fatalError);
                alert('Erro crítico ao abrir a janela: ' + fatalError.message);
                resolve(null);
            }
        });
    }
};
