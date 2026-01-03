import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
// Refresh Sync

export const RetiradaModal = {
    show: ({ retirada, projectId, onSave }) => {
        return new Promise((resolve) => {
            const API_BASE_URL = getApiBaseUrl();
            const isEdit = !!retirada;
            const title = isEdit ? 'Editar Retirada' : 'Nova Retirada';

            // 1. Fetch Dependencies
            const token = localStorage.getItem('token');
            Promise.all([
                fetch(`${API_BASE_URL}/companies?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
                fetch(`${API_BASE_URL}/accounts?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json())
            ]).then(([companiesRes, accountsRes]) => {
                const companies = Array.isArray(companiesRes) ? companiesRes : [];
                const accounts = Array.isArray(accountsRes) ? accountsRes : [];

                // 2. Build Modal DOM
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
                modal.style.maxWidth = '800px'; // Wider to accommodate grid
                modal.style.width = '100%';

                const today = new Date().toISOString().substring(0, 10);

                // Helper format date for input
                const formatDateForInput = (str) => {
                    if (!str) return '';
                    if (str.includes('T')) return str.split('T')[0];
                    return str;
                };

                // Currency Helpers
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

                modal.innerHTML = `
                    <div class="dialog-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="dialog-body">
                        <!-- Grid Layout matching DespesaModal (6 columns) -->
                        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem;">
                            
                            <!-- Row 1: Dates -->
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Data Fato <span style="color:#EF4444">*</span></label>
                                <input type="date" id="retirada-fato" class="form-input" 
                                    value="${formatDateForInput(retirada?.data_fato) || ''}">
                            </div>
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Data Prevista <span style="color:#EF4444">*</span></label>
                                <input type="date" id="retirada-prevista" class="form-input" 
                                    value="${formatDateForInput(retirada?.data_prevista) || ''}">
                            </div>
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Data Real</label>
                                <input type="date" id="retirada-real" class="form-input" 
                                    value="${formatDateForInput(retirada?.data_real)}">
                            </div>

                            <!-- Row 2: Entities & Value -->
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Empresa <span style="color:#EF4444">*</span></label>
                                <select id="retirada-company" class="form-input">
                                    <option value="">Selecione...</option>
                                    ${companies.map(c => `<option value="${c.id}" ${retirada?.company_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                </select>
                            </div>
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Conta <span id="account-required-asterisk" style="color:#EF4444; display:none;">*</span></label>
                                <select id="retirada-account" class="form-input" disabled>
                                    <option value="">Selecione...</option>
                                    ${accounts.map(a => `<option value="${a.id}" ${retirada?.account_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                            </div>
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Valor (R$) <span style="color:#EF4444">*</span></label>
                                <input type="text" id="retirada-valor" class="form-input" placeholder="R$ 0,00" value="">
                            </div>


                            <!-- Row 2.5: Payment Methods -->
                            <div style="grid-column: span 6;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Forma de Retirada</label>
                                <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; padding: 0.2rem 0;">
                                    ${['Pix', 'Ted', 'DOC', 'Boleto', 'Verificar', 'Dinheiro', 'Cartão'].map(opt => `
                                        <div style="display: flex; align-items: center; gap: 0.3rem;">
                                            <input type="radio" name="forma_pagamento" id="fp-${opt}" value="${opt}" 
                                                ${retirada?.forma_pagamento === opt ? 'checked' : ''} style="cursor: pointer;">
                                            <label for="fp-${opt}" style="margin: 0; cursor: pointer; font-weight: normal; font-size: 0.9rem;">${opt}</label>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Row 3: Description (Full Span) -->
                            <div style="grid-column: span 6;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Descrição</label>
                                <textarea id="retirada-desc" class="form-input" placeholder="Detalhes..." style="resize:none; height:100px;">${retirada?.descricao || ''}</textarea>
                            </div>

                            <!-- UPLOAD COMPROVANTE -->
                            <div style="grid-column: span 6;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Comprovante</label>
                                <input type="file" id="retirada-comprovante" style="display: none;" accept="image/*,application/pdf" />
                                <input type="hidden" id="retirada-comprovante-url" value="${retirada?.comprovante_url || ''}" />
                                
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
                                            ${retirada?.comprovante_url ? '' : 'Clique no clipe para anexar...'}
                                        </span>
                                        <a id="file-link" href="${retirada?.comprovante_url ? API_BASE_URL + retirada.comprovante_url : '#'}" target="_blank" 
                                           style="display: ${retirada?.comprovante_url ? 'block' : 'none'}; color: var(--color-primary); text-decoration: underline; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
                                           ${retirada?.comprovante_url ? (retirada.comprovante_url.split('/').pop().split('-').slice(1).join('-') || retirada.comprovante_url.split('/').pop()) : ''}
                                        </a>
                                    </div>

                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span id="btn-attach" style="cursor: pointer; font-size: 1.2rem; display: ${retirada?.comprovante_url ? 'none' : 'block'};" title="Anexar Arquivo">📎</span>
                                        <span id="btn-remove" style="cursor: pointer; font-size: 1.2rem; display: ${retirada?.comprovante_url ? 'block' : 'none'};" title="Remover Arquivo">🗑️</span>
                                    </div>
                                </div>
                            </div>

                            ${isEdit ? `
                            <div style="grid-column: span 6; display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                                <input type="checkbox" id="retirada-active" ${retirada.active ? 'checked' : ''}>
                                <label for="retirada-active">Ativo</label>
                            </div>
                            ` : ''}

                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn-secondary" id="btn-cancel">Cancelar</button>
                        <!-- Button Blue (Primary) -->
                        <button class="btn-primary" id="btn-save">${isEdit ? 'Salvar Alterações' : 'Criar Retirada'}</button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // 3. Bind Events
                const btnCancel = modal.querySelector('#btn-cancel');
                const btnSave = modal.querySelector('#btn-save');

                // Elements
                const valorInput = modal.querySelector('#retirada-valor');
                const dataRealInput = modal.querySelector('#retirada-real');
                const accountSelect = modal.querySelector('#retirada-account');
                const accountAsterisk = modal.querySelector('#account-required-asterisk');

                // File Upload Elements
                const fileInput = modal.querySelector('#retirada-comprovante');
                const fileLink = modal.querySelector('#file-link');
                const btnAttach = modal.querySelector('#btn-attach');
                const btnRemove = modal.querySelector('#btn-remove');
                const placeholderText = modal.querySelector('#placeholder-text');
                const hiddenUrlInput = modal.querySelector('#retirada-comprovante-url');

                // Initialize Valor if present
                if (retirada?.valor !== undefined && retirada?.valor !== null) {
                    valorInput.value = formatFloat(Number(retirada.valor));
                }

                // Currency Event Listeners
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

                // File Upload Logic
                const updateFileUI = (url) => {
                    if (url) {
                        hiddenUrlInput.value = url;
                        // Extract filename safely
                        const filename = url.split('/').pop().split('-').slice(1).join('-') || url.split('/').pop();
                        fileLink.textContent = filename;
                        fileLink.href = API_BASE_URL + url;
                        fileLink.style.display = 'block';
                        placeholderText.style.display = 'none';
                        btnAttach.style.display = 'none';
                        btnRemove.style.display = 'block';
                    } else {
                        hiddenUrlInput.value = '';
                        fileLink.textContent = '';
                        fileLink.href = '#';
                        fileLink.style.display = 'none';
                        placeholderText.style.display = 'block';
                        btnAttach.style.display = 'block';
                        btnRemove.style.display = 'none';
                    }
                };

                // Trigger file input
                modal.querySelector('#comprovante-container').onclick = (e) => {
                    if (e.target !== btnRemove && e.target !== fileLink) {
                        fileInput.click();
                    }
                };

                fileInput.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const formData = new FormData();
                    formData.append('file', file);

                    try {
                        placeholderText.textContent = 'Enviando...';
                        const response = await fetch(`${API_BASE_URL}/upload`, {
                            method: 'POST',
                            body: formData, // No Authorization header needed if public or handled implicitly? Usually needed.
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });

                        if (response.ok) {
                            const result = await response.json();
                            updateFileUI(result.fileUrl);
                            // Assuming showToast is defined elsewhere or needs to be added
                            // Dialogs.toast('Arquivo anexado com sucesso!', 'success'); 
                        } else {
                            placeholderText.textContent = 'Erro ao enviar.';
                            // Dialogs.toast('Erro ao enviar arquivo.', 'error');
                        }
                    } catch (error) {
                        console.error(error);
                        placeholderText.textContent = 'Erro de conexão.';
                    }
                };

                btnRemove.onclick = (e) => {
                    e.stopPropagation();
                    updateFileUI('');
                };

                // Toggle Account Logic
                const toggleAccountState = () => {
                    const isRealDateFilled = !!dataRealInput.value;
                    accountSelect.disabled = !isRealDateFilled;

                    if (isRealDateFilled) {
                        accountSelect.style.backgroundColor = 'white';
                        accountSelect.style.color = 'inherit';
                        accountAsterisk.style.display = 'inline';
                    } else {
                        accountSelect.style.backgroundColor = 'var(--color-background-disabled)';
                        accountSelect.style.color = '#9CA3AF';
                        accountSelect.value = '';
                        accountAsterisk.style.display = 'none';
                    }
                };

                // Initial State
                toggleAccountState();
                if (retirada?.account_id && retirada?.data_real) {
                    accountSelect.value = retirada.account_id;
                }

                dataRealInput.addEventListener('change', toggleAccountState);
                dataRealInput.addEventListener('input', toggleAccountState);

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
                    const dataFato = modal.querySelector('#retirada-fato').value;
                    const dataPrevista = modal.querySelector('#retirada-prevista').value;
                    const dataReal = modal.querySelector('#retirada-real').value;
                    const valor = parseCurrency(valorInput.value); // Use parsed value
                    const descricao = modal.querySelector('#retirada-desc').value;
                    const companyId = modal.querySelector('#retirada-company').value;
                    const accountId = modal.querySelector('#retirada-account').value;
                    const comprovanteUrl = hiddenUrlInput.value;
                    const active = isEdit ? (modal.querySelector('#retirada-active').checked ? 1 : 0) : 1;

                    let isValid = true;
                    if (!dataFato) { modal.querySelector('#retirada-fato').classList.add('input-error'); isValid = false; }
                    if (!dataPrevista) { modal.querySelector('#retirada-prevista').classList.add('input-error'); isValid = false; }
                    if (!valor) { valorInput.classList.add('input-error'); isValid = false; }
                    if (!companyId) { modal.querySelector('#retirada-company').classList.add('input-error'); isValid = false; }

                    if (dataReal && !accountId) {
                        accountSelect.classList.add('input-error'); isValid = false;
                    } else {
                        accountSelect.classList.remove('input-error');
                    }

                    if (!isValid) {
                        Dialogs.alert('Preencha os campos obrigatórios (*)', 'Erro de Validação');
                        return;
                    }

                    const data = {
                        dataFato,
                        dataPrevista,
                        dataReal: dataReal || null,
                        valor,
                        descricao,
                        companyId,
                        accountId: dataReal ? accountId : null,
                        comprovanteUrl: comprovanteUrl || null,
                        accountId: dataReal ? accountId : null,
                        comprovanteUrl: comprovanteUrl || null,
                        active,
                        formaPagamento: modal.querySelector('input[name="forma_pagamento"]:checked')?.value || null
                    };

                    if (onSave) await onSave(data);
                    close(data);
                };

            }).catch(err => {
                console.error(err);
                Dialogs.alert(`Erro ao carregar dados auxiliares: ${err.message}`, 'Erro');
                resolve(null);
            });
        });
    }
};
