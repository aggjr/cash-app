import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const AporteModal = {
    show: ({ aporte, projectId, onSave }) => {
        return new Promise((resolve) => {
            const API_BASE_URL = getApiBaseUrl();
            const isEdit = !!aporte;
            const title = isEdit ? 'Editar Aporte' : 'Novo Aporte';

            // 1. Fetch Dependencies
            const token = localStorage.getItem('token');
            Promise.all([
                fetch(`${API_BASE_URL}/companies?projectId=${projectId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(async r => {
                    if (!r.ok) throw new Error(`Companies: ${r.statusText}`);
                    return r.json();
                }),
                fetch(`${API_BASE_URL}/accounts?projectId=${projectId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(async r => {
                    if (!r.ok) throw new Error(`Accounts: ${r.statusText}`);
                    return r.json();
                })
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
                modal.style.maxWidth = '600px';
                modal.style.width = '100%';

                const today = new Date().toISOString().substring(0, 10);

                modal.innerHTML = `
                    <div class="dialog-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="dialog-body">
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            
                            <!-- PRIMEIRA LINHA: Data Fato + Data Real + Valor -->
                            <div style="display: flex; gap: 1rem; align-items: flex-end;">
                                <div style="flex: 1;">
                                    <label style="display:block; margin-bottom:0.5rem; font-weight:500; font-size: 0.85rem;">Data Fato <span style="color:#EF4444">*</span></label>
                                    <input type="date" id="aporte-fato" class="form-input" value="${aporte?.data_fato ? aporte.data_fato.substring(0, 10) : ''}" style="font-size: 0.85rem;">
                                </div>
                                <div style="flex: 1;">
                                    <label style="display:block; margin-bottom:0.5rem; font-weight:500; font-size: 0.85rem;">Data Real</label>
                                    <input type="date" id="aporte-real" class="form-input" value="${aporte?.data_real ? aporte.data_real.substring(0, 10) : ''}" style="font-size: 0.85rem;">
                                </div>
                                <div style="flex: 1;">
                                    <label style="display:block; margin-bottom:0.5rem; font-weight:500; font-size: 0.85rem;">Valor (R$) <span style="color:#EF4444">*</span></label>
                                    <input type="text" id="aporte-valor" class="form-input" placeholder="R$ 0,00" style="font-size: 0.85rem;">
                                </div>
                            </div>

                            <!-- SEGUNDA LINHA: Empresa + Conta -->
                            <div style="display: flex; gap: 1rem;">
                                <div style="flex: 1;">
                                    <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Empresa <span style="color:#EF4444">*</span></label>
                                    <select id="aporte-company" class="form-input">
                                        <option value="">Selecione...</option>
                                        ${companies.map(c => `<option value="${c.id}" ${aporte?.company_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div style="flex: 1;">
                                    <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Conta <span id="account-required-asterisk" style="color:#EF4444; display:none;">*</span></label>
                                    <select id="aporte-account" class="form-input" disabled>
                                        <option value="">Selecione...</option>
                                        ${accounts.map(a => `<option value="${a.id}" ${aporte?.account_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                    </select>
                                </div>
                            </div>

                            <!-- DESCRIÇÃO -->
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Descrição</label>
                                <textarea id="aporte-desc" class="form-input" placeholder="Detalhes do aporte..." rows="3" style="resize: vertical; min-height: 70px;">${aporte?.descricao || ''}</textarea>
                            </div>

                            <!-- UPLOAD COMPROVANTE -->
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Comprovante</label>
                                <input type="file" id="aporte-comprovante" style="display: none;" accept="image/*,application/pdf" />
                                <input type="hidden" id="aporte-comprovante-url" value="${aporte?.comprovante_url || ''}" />
                                
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
                                            ${aporte?.comprovante_url ? '' : 'Clique no clipe para anexar...'}
                                        </span>
                                        <a id="file-link" href="${aporte?.comprovante_url ? API_BASE_URL + aporte.comprovante_url : '#'}" target="_blank" 
                                           style="display: ${aporte?.comprovante_url ? 'block' : 'none'}; color: var(--color-primary); text-decoration: underline; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
                                           ${aporte?.comprovante_url ? (aporte.comprovante_url.split('/').pop().split('-').slice(1).join('-') || aporte.comprovante_url.split('/').pop()) : ''}
                                        </a>
                                    </div>

                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span id="btn-attach" style="cursor: pointer; font-size: 1.2rem; display: ${aporte?.comprovante_url ? 'none' : 'block'};" title="Anexar Arquivo">📎</span>
                                        <span id="btn-remove" style="cursor: pointer; font-size: 1.2rem; display: ${aporte?.comprovante_url ? 'block' : 'none'};" title="Remover Arquivo">🗑️</span>
                                    </div>
                                </div>
                            </div>

                            ${isEdit ? `
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                                <input type="checkbox" id="aporte-active" ${aporte.active ? 'checked' : ''}>
                                <label for="aporte-active">Ativo</label>
                            </div>
                            ` : ''}

                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn-secondary" id="btn-cancel">Cancelar</button>
                        <button class="btn-primary" id="btn-save">${isEdit ? 'Salvar Alterações' : 'Criar Aporte'}</button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // 3. Bind Events
                const btnCancel = modal.querySelector('#btn-cancel');
                const btnSave = modal.querySelector('#btn-save');

                // Elements
                const valorInput = modal.querySelector('#aporte-valor');
                const dataFatoInput = modal.querySelector('#aporte-fato');
                const dataRealInput = modal.querySelector('#aporte-real');
                const companySelect = modal.querySelector('#aporte-company');
                const accountSelect = modal.querySelector('#aporte-account');
                const accountAsterisk = modal.querySelector('#account-required-asterisk');

                // Upload Elements
                const comprovanteInput = modal.querySelector('#aporte-comprovante');
                const comprovanteUrlInput = modal.querySelector('#aporte-comprovante-url');
                const comprovanteContainer = modal.querySelector('#comprovante-container');
                const btnAttach = modal.querySelector('#btn-attach');
                const btnRemove = modal.querySelector('#btn-remove');
                const fileLink = modal.querySelector('#file-link');
                const placeholderText = modal.querySelector('#placeholder-text');

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

                // Initialize Valor if present
                if (aporte?.valor !== undefined && aporte?.valor !== null) {
                    valorInput.value = formatFloat(Number(aporte.valor));
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

                // Toggle Account Logic
                const toggleAccountState = () => {
                    const isRealDateFilled = !!dataRealInput.value;
                    accountSelect.disabled = !isRealDateFilled;

                    if (isRealDateFilled) {
                        accountSelect.style.backgroundColor = 'white';
                        accountSelect.style.color = 'inherit';
                        accountAsterisk.style.display = 'inline';
                    } else {
                        accountSelect.style.backgroundColor = 'var(--color-background-disabled)'; // Use standard var
                        accountSelect.style.color = '#9CA3AF';
                        accountSelect.value = '';
                        accountSelect.classList.remove('input-error');
                        accountAsterisk.style.display = 'none';
                    }
                };

                // Initial State
                toggleAccountState();
                if (aporte?.account_id && aporte?.data_real) {
                    accountSelect.value = aporte.account_id;
                }

                dataRealInput.addEventListener('change', toggleAccountState);
                dataRealInput.addEventListener('input', toggleAccountState);

                // File Upload Handlers
                const updateFileUI = (url) => {
                    if (url) {
                        // Extract filename logic
                        const filename = url.split('/').pop().split('-').slice(1).join('-') || url.split('/').pop();

                        placeholderText.style.display = 'none';
                        fileLink.style.display = 'block';
                        fileLink.href = `${API_BASE_URL}${url}`;
                        fileLink.textContent = filename;
                        btnAttach.style.display = 'none';
                        btnRemove.style.display = 'block';
                    } else {
                        placeholderText.style.display = 'block';
                        fileLink.style.display = 'none';
                        fileLink.href = '#';
                        btnAttach.style.display = 'block';
                        btnRemove.style.display = 'none';
                        comprovanteInput.value = '';
                        comprovanteUrlInput.value = '';
                    }
                };

                btnAttach.onclick = (e) => { e.stopPropagation(); comprovanteInput.click(); };
                comprovanteContainer.onclick = (e) => {
                    if (!comprovanteUrlInput.value && e.target !== btnRemove && e.target !== fileLink) comprovanteInput.click();
                };
                btnRemove.onclick = (e) => { e.stopPropagation(); updateFileUI(null); };

                comprovanteInput.onchange = async (e) => {
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
                        updateFileUI(result.fileUrl);

                    } catch (error) {
                        console.error(error);
                        placeholderText.textContent = 'Erro ao enviar.';
                        placeholderText.style.color = '#EF4444';
                    }
                };

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
                    const dataFato = dataFatoInput.value;
                    const dataReal = dataRealInput.value;
                    // Fix: Parse currency value
                    const valor = parseCurrency(valorInput.value);
                    const descricao = modal.querySelector('#aporte-desc').value;
                    const companyId = companySelect.value;
                    const accountId = accountSelect.value;
                    const active = isEdit ? (modal.querySelector('#aporte-active').checked ? 1 : 0) : 1;
                    const comprovanteUrl = comprovanteUrlInput.value;

                    // Validation
                    let isValid = true;
                    if (!valor) { valorInput.classList.add('input-error'); isValid = false; } else valorInput.classList.remove('input-error');
                    if (!dataFato) { dataFatoInput.classList.add('input-error'); isValid = false; } else dataFatoInput.classList.remove('input-error');
                    if (!companyId) { companySelect.classList.add('input-error'); isValid = false; } else companySelect.classList.remove('input-error');

                    if (dataReal && !accountId) {
                        accountSelect.classList.add('input-error'); isValid = false;
                    } else {
                        accountSelect.classList.remove('input-error');
                    }

                    if (!isValid) {
                        // showToast is imported in Manager, but Dialogs usually handles alerts. 
                        // We can use a simple alert here or rely on the visual cues
                        // Adding a shake animation or toast is nice, but visual red borders are robust.
                        Dialogs.alert('Preencha os campos obrigatórios (*)', 'Erro de Validação');
                        return;
                    }

                    const data = {
                        dataFato,
                        dataReal: dataReal || null,
                        valor,
                        descricao,
                        companyId,
                        accountId: dataReal ? accountId : null, // Ensure explicit null if not used
                        active,
                        comprovante_url: comprovanteUrl
                    };

                    if (onSave) await onSave(data);
                    close(data);
                };

            }).catch(err => {
                console.error(err);
                Dialogs.alert(`Erro ao carregar dados: ${err.message}`, 'Erro');
                resolve(null);
            });
        });
    }
};
