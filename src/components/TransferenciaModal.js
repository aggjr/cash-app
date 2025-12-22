import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
// Refresh Sync

export const TransferenciaModal = {
    show: ({ transferencia, projectId, onSave }) => {
        return new Promise(async (resolve) => {
            const API_BASE_URL = getApiBaseUrl();
            const isEdit = !!transferencia;
            const title = isEdit ? 'Editar Transferência' : 'Nova Transferência';

            const token = localStorage.getItem('token');

            try {
                const accountsRes = await fetch(`${API_BASE_URL}/accounts?projectId=${projectId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const accountsData = await accountsRes.json();
                const accounts = Array.isArray(accountsData) ? accountsData : [];

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
                                <label>Data Prevista <span class="required">*</span></label>
                                <input type="date" id="transf-prevista" class="form-input" 
                                    value="${formatDateForInput(transferencia?.data_prevista)}">
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label>Data Real</label>
                                <input type="date" id="transf-real" class="form-input" 
                                    value="${formatDateForInput(transferencia?.data_real)}">
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label>Valor (R$) <span class="required">*</span></label>
                                <input type="text" id="transf-valor" class="form-input" placeholder="R$ 0,00">
                            </div>

                            <!-- Row 2: Conta Origem | Conta Destino -->
                            <div class="form-group" style="grid-column: span 3;">
                                <label>Conta Origem (Sai) <span id="source-required-asterisk" class="required" style="display: none;">*</span></label>
                                <select id="transf-source" class="form-input" disabled style="background-color: var(--color-background-disabled); color: #9CA3AF;">
                                    <option value="">Selecione...</option>
                                    ${accounts.map(a => `<option value="${a.id}" ${transferencia?.source_account_id === a.id ? 'selected' : ''}>${a.name} (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(a.current_balance)})</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="grid-column: span 3;">
                                <label>Conta Destino (Entra) <span id="dest-required-asterisk" class="required" style="display: none;">*</span></label>
                                <select id="transf-dest" class="form-input" disabled style="background-color: var(--color-background-disabled); color: #9CA3AF;">
                                    <option value="">Selecione...</option>
                                    ${accounts.map(a => `<option value="${a.id}" ${transferencia?.destination_account_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                            </div>


                            <!-- Row 2.5: Forma de Transferência -->
                            <div class="form-group" style="grid-column: span 6;">
                                <label>Forma de Transferência</label>
                                <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; padding: 0.2rem 0;">
                                    ${['Pix', 'Ted', 'DOC', 'Boleto', 'Verificar', 'Dinheiro', 'Cartão'].map(opt => `
                                        <div style="display: flex; align-items: center; gap: 0.3rem;">
                                            <input type="radio" name="forma_pagamento" id="fp-${opt}" value="${opt}" 
                                                ${transferencia?.forma_pagamento === opt ? 'checked' : ''} style="cursor: pointer;">
                                            <label for="fp-${opt}" style="margin: 0; cursor: pointer; font-weight: normal; font-size: 0.9rem;">${opt}</label>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Row 3: Comprovante -->
                            <div class="form-group" style="grid-column: span 6;">
                                <label for="transf-comprovante">Comprovante</label>
                                <input type="file" id="transf-comprovante" style="display: none;" accept="image/*,application/pdf" />
                                <input type="hidden" id="transf-comprovante-url" value="${transferencia?.comprovante_url || ''}" />
                                
                                <div id="comprovante-container" class="form-input" style="
                                    display: flex; 
                                    align-items: center; 
                                    justify-content: space-between; 
                                    cursor: pointer; 
                                    padding: 0.5rem; 
                                    background: white;
                                ">
                                    <div id="file-display-area" style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
                                        <span id="placeholder-text" style="color: #9CA3AF; font-style: italic; font-size: 0.9rem;">
                                            ${transferencia?.comprovante_url ? '' : 'Clique no clipe para anexar...'}
                                        </span>
                                        <a id="file-link" href="${transferencia?.comprovante_url ? API_BASE_URL + transferencia.comprovante_url : '#'}" target="_blank" 
                                           style="display: ${transferencia?.comprovante_url ? 'block' : 'none'}; color: var(--color-primary); text-decoration: underline; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
                                           ${transferencia?.comprovante_url ? transferencia.comprovante_url.split('/').pop().split('-').slice(1).join('-') : ''}
                                        </a>
                                    </div>

                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span id="btn-attach" style="cursor: pointer; font-size: 1.2rem; display: ${transferencia?.comprovante_url ? 'none' : 'block'};" title="Anexar Arquivo">📎</span>
                                        <span id="btn-remove" style="cursor: pointer; font-size: 1.2rem; display: ${transferencia?.comprovante_url ? 'block' : 'none'};" title="Remover Arquivo">🗑️</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Row 4: Description -->
                            <div class="form-group" style="grid-column: span 6;">
                                <label>Descrição</label>
                                <textarea id="transf-desc" class="form-input" placeholder="Detalhes da transferência..." style="resize:none; height:100px;">${transferencia?.descricao || ''}</textarea>
                            </div>

                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn-secondary" id="btn-cancel">Cancelar</button>
                        <button class="btn-primary" id="btn-save">${isEdit ? 'Salvar' : 'Transferir'}</button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // Track changes
                let hasChanges = false;
                const markAsDirty = () => { hasChanges = true; };

                // Get elements
                const dataPrevistaInput = modal.querySelector('#transf-prevista');
                const dataRealInput = modal.querySelector('#transf-real');
                const valorInput = modal.querySelector('#transf-valor');
                const sourceSelect = modal.querySelector('#transf-source');
                const destSelect = modal.querySelector('#transf-dest');
                const descInput = modal.querySelector('#transf-desc');
                const sourceAsterisk = modal.querySelector('#source-required-asterisk');
                const destAsterisk = modal.querySelector('#dest-required-asterisk');

                // Validation function
                const validate = () => {
                    let isValid = true;

                    // Data Prevista é sempre obrigatória
                    if (!dataPrevistaInput.value) {
                        dataPrevistaInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        dataPrevistaInput.classList.remove('input-error');
                    }

                    // Valor é sempre obrigatório
                    const parseCurrency = (str) => {
                        if (!str) return 0;
                        let clean = str.replace(/[^0-9,-]+/g, "");
                        clean = clean.replace(',', '.');
                        return parseFloat(clean) || 0;
                    };
                    if (!valorInput.value || parseCurrency(valorInput.value) <= 0) {
                        valorInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        valorInput.classList.remove('input-error');
                    }

                    // Contas são obrigatórias apenas se Data Real estiver preenchida
                    if (dataRealInput.value) {
                        if (!sourceSelect.value) {
                            sourceSelect.classList.add('input-error');
                            isValid = false;
                        } else {
                            sourceSelect.classList.remove('input-error');
                        }

                        if (!destSelect.value) {
                            destSelect.classList.add('input-error');
                            isValid = false;
                        } else {
                            destSelect.classList.remove('input-error');
                        }
                    } else {
                        sourceSelect.classList.remove('input-error');
                        destSelect.classList.remove('input-error');
                    }

                    return isValid;
                };

                // Currency formatting functions
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

                // Initialize valor if editing
                if (transferencia?.valor !== undefined && transferencia?.valor !== null) {
                    valorInput.value = formatFloat(Number(transferencia.valor));
                }

                // Valor input handlers
                valorInput.addEventListener('focus', (e) => {
                    let val = e.target.value;
                    val = val.replace('R$', '').trim();
                    val = val.replace(/\./g, '');
                    e.target.value = val;
                });

                valorInput.addEventListener('blur', (e) => {
                    let val = e.target.value;
                    if (val === '' || val === '-') {
                        e.target.value = '';
                    } else {
                        let num = parseCurrency(val);
                        e.target.value = formatFloat(num);
                    }
                });

                valorInput.addEventListener('input', (e) => {
                    let val = e.target.value;
                    let clean = val.replace(/[^0-9,-]/g, '');
                    if (clean !== val) e.target.value = clean;
                });

                // Toggle account state based on Data Real
                const toggleAccountState = () => {
                    const hasDataReal = dataRealInput.value !== '';

                    sourceSelect.disabled = !hasDataReal;
                    destSelect.disabled = !hasDataReal;

                    sourceAsterisk.style.display = hasDataReal ? 'inline' : 'none';
                    destAsterisk.style.display = hasDataReal ? 'inline' : 'none';

                    // Visual styling
                    if (hasDataReal) {
                        sourceSelect.style.backgroundColor = 'white';
                        sourceSelect.style.color = 'inherit';
                        destSelect.style.backgroundColor = 'white';
                        destSelect.style.color = 'inherit';
                    } else {
                        sourceSelect.style.backgroundColor = 'var(--color-background-disabled)';
                        sourceSelect.style.color = '#9CA3AF';
                        destSelect.style.backgroundColor = 'var(--color-background-disabled)';
                        destSelect.style.color = '#9CA3AF';
                        // Clear selections if Data Real is removed
                        sourceSelect.value = '';
                        destSelect.value = '';
                    }
                };

                // Initialize account state
                toggleAccountState();

                // Listen to Data Real changes
                dataRealInput.addEventListener('change', () => {
                    toggleAccountState();
                    markAsDirty();
                });

                // Track changes on all inputs
                [dataPrevistaInput, dataRealInput, valorInput, sourceSelect, destSelect, descInput].forEach(el => {
                    el.addEventListener('change', markAsDirty);
                    // Remove input-error class when user starts typing/changing
                    el.addEventListener('input', () => {
                        el.classList.remove('input-error');
                    });
                    el.addEventListener('change', () => {
                        el.classList.remove('input-error');
                    });
                });

                // File Upload Logic
                const comprovanteInput = modal.querySelector('#transf-comprovante');
                const comprovanteUrlInput = modal.querySelector('#transf-comprovante-url');
                const comprovanteContainer = modal.querySelector('#comprovante-container');
                const btnAttach = modal.querySelector('#btn-attach');
                const btnRemove = modal.querySelector('#btn-remove');
                const fileLink = modal.querySelector('#file-link');
                const placeholderText = modal.querySelector('#placeholder-text');

                const updateFileUI = (url, filename) => {
                    if (url) {
                        placeholderText.style.display = 'none';
                        fileLink.style.display = 'block';
                        fileLink.href = `${API_BASE_URL}${url}`;
                        fileLink.textContent = filename || 'Arquivo Anexado';
                        btnAttach.style.display = 'none';
                        btnRemove.style.display = 'block';
                    } else {
                        placeholderText.style.display = 'block';
                        fileLink.style.display = 'none';
                        fileLink.href = '#';
                        fileLink.textContent = '';
                        btnAttach.style.display = 'block';
                        btnRemove.style.display = 'none';
                        comprovanteInput.value = '';
                        comprovanteUrlInput.value = '';
                    }
                };

                btnAttach.addEventListener('click', (e) => {
                    e.stopPropagation();
                    comprovanteInput.click();
                });

                comprovanteContainer.addEventListener('click', (e) => {
                    if (!comprovanteUrlInput.value && e.target !== btnRemove && e.target !== fileLink) {
                        comprovanteInput.click();
                    }
                });

                btnRemove.addEventListener('click', (e) => {
                    e.stopPropagation();
                    updateFileUI(null, null);
                    markAsDirty();
                });

                comprovanteInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const formData = new FormData();
                    formData.append('file', file);

                    try {
                        placeholderText.textContent = 'Enviando...';
                        placeholderText.style.color = 'var(--color-gold)';

                        const response = await fetch(`${API_BASE_URL}/upload`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: formData
                        });

                        if (!response.ok) throw new Error('Falha no upload');

                        const result = await response.json();

                        placeholderText.textContent = 'Clique no clipe para anexar...';
                        placeholderText.style.color = '#9CA3AF';

                        comprovanteUrlInput.value = result.fileUrl;
                        updateFileUI(result.fileUrl, result.originalName);
                        markAsDirty();

                    } catch (error) {
                        console.error('Upload error:', error);
                        placeholderText.textContent = 'Erro ao enviar. Tente novamente.';
                        placeholderText.style.color = '#EF4444';
                        comprovanteInput.value = '';
                    }
                });

                // Cross-Exclusion Logic
                const updateOptions = () => {
                    const applyExclusion = (selectedVal, targetSelect) => {
                        Array.from(targetSelect.options).forEach(opt => {
                            if (opt.value && opt.value === selectedVal) {
                                opt.disabled = true;
                                if (opt.selected) targetSelect.value = "";
                            } else {
                                opt.disabled = false;
                            }
                        });
                    };

                    applyExclusion(sourceSelect.value, destSelect);
                    applyExclusion(destSelect.value, sourceSelect);
                };

                sourceSelect.addEventListener('change', () => {
                    updateOptions();
                    markAsDirty();
                });
                destSelect.addEventListener('change', () => {
                    updateOptions();
                    markAsDirty();
                });
                updateOptions();

                // Custom Confirm Dialog
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
                    });
                };

                // Custom Alert Dialog
                const showCustomAlert = (message) => {
                    return new Promise((resolveAlert) => {
                        const alertOverlay = document.createElement('div');
                        alertOverlay.className = 'dialog-overlay';
                        alertOverlay.style.zIndex = '100000';
                        alertOverlay.style.backgroundColor = 'rgba(0,0,0,0.4)';

                        const alertBox = document.createElement('div');
                        alertBox.style.background = 'white';
                        alertBox.style.padding = '24px';
                        alertBox.style.borderRadius = '12px';
                        alertBox.style.maxWidth = '400px';
                        alertBox.style.width = '90%';
                        alertBox.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
                        alertBox.style.textAlign = 'center';
                        alertBox.className = 'animate-float-in';

                        alertBox.innerHTML = `
                            <h3 style="margin: 0 0 16px 0; color: #EF4444; font-size: 1.25rem;">Atenção</h3>
                            <p style="margin: 0 0 24px 0; color: #555; line-height: 1.5;">${message}</p>
                            <div style="display: flex; justify-content: center;">
                                <button id="alert-ok" style="
                                    background: var(--color-primary); border: none; padding: 8px 24px; 
                                    border-radius: 6px; cursor: pointer; color: white; font-weight: 500;">
                                    Entendi
                                </button>
                            </div>
                        `;

                        alertOverlay.appendChild(alertBox);
                        document.body.appendChild(alertOverlay);

                        const closeAlert = () => {
                            if (document.body.contains(alertOverlay)) {
                                document.body.removeChild(alertOverlay);
                            }
                            resolveAlert();
                        };

                        const btnOk = alertOverlay.querySelector('#alert-ok');
                        if (btnOk) btnOk.onclick = closeAlert;
                    });
                };

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

                btnCancel.onclick = async () => {
                    if (hasChanges) {
                        const confirmed = await showCustomConfirm('Tem certeza que deseja cancelar? As alterações não salvas serão perdidas.');
                        if (confirmed) close(null);
                    } else {
                        close(null);
                    }
                };

                btnSave.onclick = async () => {
                    // Validate first
                    if (!validate()) {
                        await showCustomAlert('Por favor, preencha todos os campos obrigatórios destacados em vermelho.');
                        return;
                    }

                    const dataPrevista = dataPrevistaInput.value;
                    const dataReal = dataRealInput.value;
                    const valor = parseCurrency(valorInput.value);
                    const descricao = descInput.value;
                    const sourceAccountId = sourceSelect.value;
                    const destinationAccountId = destSelect.value;
                    const comprovanteUrl = comprovanteUrlInput.value || null;

                    // Additional validation
                    if (dataReal && sourceAccountId === destinationAccountId) {
                        await showCustomAlert('A conta de origem e destino devem ser diferentes.');
                        return;
                    }

                    const dataFato = dataReal || dataPrevista;

                    const data = {
                        dataFato,
                        dataPrevista: dataPrevista || null,
                        dataReal: dataReal || null,
                        valor,
                        descricao,
                        sourceAccountId: sourceAccountId || null,
                        destinationAccountId: destinationAccountId || null,
                        comprovanteUrl,
                        active: 1, // Always active - deletion is handled by delete button
                        formaPagamento: modal.querySelector('input[name="forma_pagamento"]:checked')?.value || null
                    };

                    if (onSave) await onSave(data);
                    close(data);
                };

            } catch (err) {
                console.error(err);
                Dialogs.alert(`Erro ao carregar contas: ${err.message}`, 'Erro');
                resolve(null);
            }
        });
    }
};
