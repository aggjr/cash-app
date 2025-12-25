import { TreeSelector } from './TreeSelector.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const SaidaModal = {
    show({ saida = null, projectId, onSave, onCancel }) {
        return new Promise(async (resolve) => {
            try {
                const API_BASE_URL = getApiBaseUrl();
                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                const isEdit = saida !== null;
                let hasChanges = false;

                // Mark as dirty helper
                const markAsDirty = () => { hasChanges = true; };

                // Fetch data
                const token = localStorage.getItem('token');
                let tipoSaidas = [];
                let companies = [];
                let accounts = [];

                try {
                    const [tipoResponse, companyResponse, accountResponse] = await Promise.all([
                        fetch(`${API_BASE_URL}/tipo_saida?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${API_BASE_URL}/companies?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${API_BASE_URL}/accounts?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } })
                    ]);

                    if (tipoResponse.ok) {
                        const json = await tipoResponse.json();
                        tipoSaidas = Array.isArray(json) ? json : [];
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
                    // Defer alert slightly to ensure DOM is ready or just use standard alert for fatal load error
                    alert('Erro ao carregar dados do servidor: ' + error.message);
                }

                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';

                const modal = document.createElement('div');
                modal.className = 'account-modal animate-float-in';
                modal.style.maxWidth = '900px';
                modal.style.width = '95%';

                const formatDateForInput = (dateString) => {
                    if (!dateString) return '';
                    if (dateString.includes('T')) return dateString.split('T')[0];
                    return dateString;
                };

                modal.innerHTML = `
                    <div class="account-modal-body" style="padding: 1rem; overflow-y: auto; max-height: 85vh;">
                        <h3 style="margin: 0 0 1rem 0; color: var(--color-primary); font-size: 1.1rem;">${isEdit ? 'Editar Saída' : 'Nova Saída'}</h3>
                        
                        <div class="form-grid" style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.75rem;">
                            
                            <!-- Row 1: All Dates (2+2+2+2 = 8 cols) -->
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="saida-data-fato">Data do Fato <span class="required">*</span></label>
                                <input type="date" id="saida-data-fato" class="form-input" 
                                    value="${formatDateForInput(saida?.data_fato)}" required />
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="saida-data-prevista">Data Prevista <span class="required">*</span></label>
                                <input type="date" id="saida-data-prevista" class="form-input" 
                                    value="${formatDateForInput(saida?.data_prevista_pagamento)}" required />
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="saida-data-atraso">Data Atraso</label>
                                <input type="date" id="saida-data-atraso" class="form-input" 
                                    value="${formatDateForInput(saida?.data_atraso)}" />
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="saida-data-real">Data Real</label>
                                <input type="date" id="saida-data-real" class="form-input" 
                                    value="${formatDateForInput(saida?.data_real_pagamento)}" />
                            </div>

                            <!-- Row 2: Empresa (2), Conta (2), Valor (2), Tipo (2) = 8 cols -->
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="saida-company">Empresa <span class="required">*</span></label>
                                <select id="saida-company" class="form-input" required>
                                    <option value="">Selecione...</option>
                                    ${companies.map(c => `
                                        <option value="${c.id}" ${saida?.company_id === c.id ? 'selected' : ''}>${c.name}</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="saida-account">Conta <span id="account-required-asterisk" style="display: ${saida?.data_real_pagamento ? 'inline' : 'none'};">*</span></label>
                                <select id="saida-account" class="form-input">
                                    <option value="">Selecione...</option>
                                </select>
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="saida-valor">Valor (R$) <span class="required">*</span></label>
                                <input type="text" id="saida-valor" class="form-input" 
                                    placeholder="R$ 0,00" required />
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="saida-installment-type">Tipo de Lançamento</label>
                                <select id="saida-installment-type" class="form-input">
                                    <option value="total">Saída Única</option>
                                    <option value="dividir">Dividir (Parcelar)</option>
                                    <option value="replicar">Replicar (Recorrente)</option>
                                </select>
                            </div>

                            <!-- Row 3 (Conditional): Parcelas, Intervalo, Dias - Only shows when Dividir/Replicar -->
                            <div class="form-group" id="installment-count-group" style="grid-column: span 2; display: none;">
                                <label for="saida-installment-count">Nº Parcelas</label>
                                <input type="number" id="saida-installment-count" class="form-input" 
                                    min="2" max="120" value="2" />
                            </div>

                            <div class="form-group" id="installment-interval-group" style="grid-column: span 2; display: none;">
                                <label for="saida-installment-interval">Intervalo</label>
                                <select id="saida-installment-interval" class="form-input">
                                    <option value="semanal">Semanal</option>
                                    <option value="quinzenal">Quinzenal</option>
                                    <option value="mensal" selected>Mensal</option>
                                    <option value="trimestral">Trimestral</option>
                                    <option value="semestral">Semestral</option>
                                    <option value="anual">Anual</option>
                                    <option value="personalizado">Personalizado</option>
                                </select>
                            </div>

                            <div class="form-group" id="custom-days-group" style="grid-column: span 2; display: none;">
                                <label for="saida-custom-days">Dias</label>
                                <input type="number" id="saida-custom-days" class="form-input" 
                                    min="1" max="365" value="10" placeholder="Ex: 10" />
                            </div>

                            <!-- Spacer to fill remaining columns when installments are visible -->
                            <div id="installment-spacer" style="grid-column: span 2; display: none;"></div>

                            <!-- Row 4: Boleto/Cobrança (4), Comprovante (4) = 8 cols -->
                            <div class="form-group" style="grid-column: span 4;">
                                <label for="saida-boleto">Boleto/Cobrança</label>
                                <input type="file" id="saida-boleto" style="display: none;" accept="image/*,application/pdf" />
                                <input type="hidden" id="saida-boleto-url" value="${saida?.boleto_url || ''}" />
                                
                                <div id="boleto-container" class="form-input" style="
                                    display: flex; 
                                    align-items: center; 
                                    justify-content: space-between; 
                                    cursor: pointer; 
                                    padding: 0.5rem; 
                                    background: white;
                                ">
                                    <div id="boleto-display-area" style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
                                        <span id="boleto-placeholder-text" style="color: #9CA3AF; font-style: italic; font-size: 0.9rem;">
                                            ${saida?.boleto_url ? '' : 'Clique no clipe para anexar...'}
                                        </span>
                                        <a id="boleto-link" href="${saida?.boleto_url ? API_BASE_URL + saida.boleto_url : '#'}" target="_blank" 
                                           style="display: ${saida?.boleto_url ? 'block' : 'none'}; color: var(--color-primary); text-decoration: underline; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
                                           ${saida?.boleto_url ? saida.boleto_url.split('/').pop().split('-').slice(1).join('-') : ''}
                                        </a>
                                    </div>

                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span id="btn-boleto-attach" style="cursor: pointer; font-size: 1.2rem; display: ${saida?.boleto_url ? 'none' : 'block'};" title="Anexar Boleto">📎</span>
                                        <span id="btn-boleto-remove" style="cursor: pointer; font-size: 1.2rem; display: ${saida?.boleto_url ? 'block' : 'none'};" title="Remover Boleto">🗑️</span>
                                    </div>
                                </div>
                            </div>

                            <div class="form-group" style="grid-column: span 4;">
                                <label for="saida-comprovante">Comprovante</label>
                                <input type="file" id="saida-comprovante" style="display: none;" accept="image/*,application/pdf" />
                                <input type="hidden" id="saida-comprovante-url" value="${saida?.comprovante_url || ''}" />
                                
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
                                            ${saida?.comprovante_url ? '' : 'Clique no clipe para anexar...'}
                                        </span>
                                        <a id="file-link" href="${saida?.comprovante_url ? API_BASE_URL + saida.comprovante_url : '#'}" target="_blank" 
                                           style="display: ${saida?.comprovante_url ? 'block' : 'none'}; color: var(--color-primary); text-decoration: underline; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
                                           ${saida?.comprovante_url ? saida.comprovante_url.split('/').pop().split('-').slice(1).join('-') : ''}
                                        </a>
                                    </div>

                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span id="btn-attach" style="cursor: pointer; font-size: 1.2rem; display: ${saida?.comprovante_url ? 'none' : 'block'};" title="Anexar Arquivo">📎</span>
                                        <span id="btn-remove" style="cursor: pointer; font-size: 1.2rem; display: ${saida?.comprovante_url ? 'block' : 'none'};" title="Remover Arquivo">🗑️</span>
                                    </div>
                                </div>
                                <div id="comprovante-preview" style="margin-top: 5px; font-size: 0.85rem; display: none;"></div>
                            </div>

                            <!-- Row 3.5: Payment Method Radio Buttons (Span 6) -->
                            <div class="form-group" style="grid-column: span 6;">
                                <label>Forma de Entrada</label>
                                <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; padding: 0.5rem 0;">
                                    ${['Pix', 'Ted', 'DOC', 'Boleto', 'Verificar', 'Dinheiro', 'Cartão'].map(opt => `
                                        <div style="display: flex; align-items: center; gap: 0.3rem;">
                                            <input type="radio" name="forma_pagamento" id="fp-${opt}" value="${opt}" 
                                                ${saida?.forma_pagamento === opt ? 'checked' : ''} style="cursor: pointer;">
                                            <label for="fp-${opt}" style="margin: 0; cursor: pointer; font-weight: normal;">${opt}</label>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Row 4: Description (Span 4) and Tree (Span 4) Side-by-Side Symmetrical (Full width) -->
                            
                            <div class="form-group" style="grid-column: span 4; display: flex; flex-direction: column; min-height: 150px;">
                                <label for="saida-descricao">Descrição</label>
                                <textarea id="saida-descricao" class="form-input" placeholder="Opcional" style="resize: none; flex: 1; box-sizing: border-box; font-family: inherit;">${saida?.descricao || ''}</textarea>
                            </div>

                            <div class="form-group" style="grid-column: span 4; display: flex; flex-direction: column; min-height: 150px;">
                                <label>Tipo de Saída <span class="required">*</span></label>
                                <div id="tree-selector-container" style="flex: 1;"></div>
                                <input type="hidden" id="saida-tipo-entrada-id" value="${saida?.tipo_saida_id || ''}" />
                            </div>

                        </div>
                    </div>
                    <!-- Footer with Z-Index ensure -->
                    <div class="account-modal-footer" style="padding: 1rem; position: relative; z-index: 100;">
                        <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                        <button class="btn-primary" id="modal-save" type="button">
                            ${isEdit ? 'Salvar Alterações' : 'Criar Entrada'}
                        </button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // Elements
                const dataFatoInput = modal.querySelector('#saida-data-fato');
                const dataPrevistaInput = modal.querySelector('#saida-data-prevista');
                const dataRealInput = modal.querySelector('#saida-data-real');
                const dataAtrasoInput = modal.querySelector('#saida-data-atraso');
                const valorInput = modal.querySelector('#saida-valor');
                const installmentTypeSelect = modal.querySelector('#saida-installment-type');
                const installmentCountInput = modal.querySelector('#saida-installment-count');
                const installmentIntervalSelect = modal.querySelector('#saida-installment-interval');
                const installmentCountGroup = modal.querySelector('#installment-count-group');
                const installmentIntervalGroup = modal.querySelector('#installment-interval-group');
                const customDaysInput = modal.querySelector('#saida-custom-days');
                const customDaysGroup = modal.querySelector('#custom-days-group');
                const installmentSpacer = modal.querySelector('#installment-spacer');
                const comprovanteInput = modal.querySelector('#saida-comprovante');
                const comprovanteUrlInput = modal.querySelector('#saida-comprovante-url');
                const comprovantePreview = modal.querySelector('#comprovante-preview');
                const boletoInput = modal.querySelector('#saida-boleto');
                const boletoUrlInput = modal.querySelector('#saida-boleto-url');
                const tipoEntradaIdInput = modal.querySelector('#saida-tipo-entrada-id');
                const treeContainer = modal.querySelector('#tree-selector-container');
                const companySelect = modal.querySelector('#saida-company');
                const accountSelect = modal.querySelector('#saida-account');
                const descricaoInput = modal.querySelector('#saida-descricao');
                const saveBtn = modal.querySelector('#modal-save');
                const cancelBtn = modal.querySelector('#modal-cancel');

                const validate = () => {
                    let isValid = true;
                    if (!dataFatoInput.value) { dataFatoInput.classList.add('input-error'); isValid = false; } else dataFatoInput.classList.remove('input-error');
                    if (!dataPrevistaInput.value) { dataPrevistaInput.classList.add('input-error'); isValid = false; } else dataPrevistaInput.classList.remove('input-error');
                    if (!valorInput.value) { valorInput.classList.add('input-error'); isValid = false; } else valorInput.classList.remove('input-error');
                    if (!tipoEntradaIdInput.value) {
                        // Apply ONLY to inner element to avoid double border/background issues
                        treeContainer.style.border = '';
                        treeContainer.classList.remove('input-error');

                        const innerTree = treeContainer.querySelector('.tree-selector');
                        if (innerTree) innerTree.classList.add('input-error');
                        isValid = false;
                    } else {
                        treeContainer.classList.remove('input-error');
                        treeContainer.style.border = '';
                        const innerTree = treeContainer.querySelector('.tree-selector');
                        if (innerTree) innerTree.classList.remove('input-error');
                    }
                    if (!companySelect.value) { companySelect.classList.add('input-error'); isValid = false; } else companySelect.classList.remove('input-error');

                    // Account is only required if Data Real is set
                    if (dataRealInput.value && !accountSelect.value) {
                        accountSelect.classList.add('input-error');
                        isValid = false;
                    } else {
                        accountSelect.classList.remove('input-error');
                    }
                    return isValid;
                };

                // Initialize Tree Selector
                const initialTipoId = parseInt(tipoSaidaIdInput.value);
                // Safe check ensures tipoSaidas is array
                TreeSelector.render(treeContainer, tipoSaidas, initialTipoId, (selectedId) => {
                    if (initialTipoId !== selectedId) {
                        hasChanges = true;
                    }
                    tipoSaidaIdInput.value = selectedId;
                    validate();
                });

                // Force inner height for symmetry
                const treeEl = treeContainer.querySelector('.tree-selector');
                if (treeEl) {
                    treeEl.style.height = '100%';
                    treeEl.style.maxHeight = 'none'; // Override internal max-height
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
                    // Works for both "R$ 1.000,00" and "1000,00"
                    let clean = str.replace(/[^0-9,-]+/g, "");
                    clean = clean.replace(',', '.');
                    return parseFloat(clean) || 0;
                };

                if (saida?.valor !== undefined && saida?.valor !== null) {
                    valorInput.value = formatFloat(Number(saida.valor));
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

                // Installment Fields Toggle Logic
                const toggleInstallmentFields = () => {
                    const type = installmentTypeSelect.value;
                    const showFields = (type === 'dividir' || type === 'replicar');

                    installmentCountGroup.style.display = showFields ? 'block' : 'none';
                    installmentIntervalGroup.style.display = showFields ? 'block' : 'none';
                    installmentSpacer.style.display = showFields ? 'block' : 'none';

                    // Show custom days field only when interval is 'personalizado'
                    const showCustomDays = showFields && installmentIntervalSelect.value === 'personalizado';
                    customDaysGroup.style.display = showCustomDays ? 'block' : 'none';

                    if (!showFields) {
                        installmentCountInput.value = 2;
                        installmentIntervalSelect.value = 'mensal';
                        customDaysInput.value = 10;
                    }
                };

                // Initialize visibility
                toggleInstallmentFields();

                // Listen for changes
                installmentTypeSelect.addEventListener('change', () => {
                    toggleInstallmentFields();
                    markAsDirty();
                });

                installmentCountInput.addEventListener('change', markAsDirty);

                installmentIntervalSelect.addEventListener('change', () => {
                    toggleInstallmentFields(); // Re-toggle to show/hide custom days
                    markAsDirty();
                });

                customDaysInput.addEventListener('change', markAsDirty);

                setTimeout(() => { dataFatoInput.focus(); }, 100);

                // File Upload Logic
                const comprovanteContainer = modal.querySelector('#comprovante-container');
                const btnAttach = modal.querySelector('#btn-attach');
                const btnRemove = modal.querySelector('#btn-remove');
                const fileLink = modal.querySelector('#file-link');
                const placeholderText = modal.querySelector('#placeholder-text');

                // Helper to update UI state
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
                        comprovanteInput.value = ''; // Reset file input
                        comprovanteUrlInput.value = '';
                    }
                };

                if (comprovanteInput) {
                    // Trigger file select on clip click
                    btnAttach.addEventListener('click', (e) => {
                        e.stopPropagation();
                        comprovanteInput.click();
                    });

                    // Trigger file select on container click (if empty)
                    comprovanteContainer.addEventListener('click', (e) => {
                        if (!comprovanteUrlInput.value && e.target !== btnRemove && e.target !== fileLink) {
                            comprovanteInput.click();
                        }
                    });

                    // Remove file
                    btnRemove.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // If it's a freshly uploaded file vs existing, logic is same: clear field
                        updateFileUI(null, null);
                        markAsDirty();
                    });

                    // Handle File Selection
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

                            // Reset placeholder style
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
                }

                // Boleto Upload Logic (duplicate of comprovante)
                const boletoContainer = modal.querySelector('#boleto-container');
                const btnBoletoAttach = modal.querySelector('#btn-boleto-attach');
                const btnBoletoRemove = modal.querySelector('#btn-boleto-remove');
                const boletoLink = modal.querySelector('#boleto-link');
                const boletoPlaceholderText = modal.querySelector('#boleto-placeholder-text');

                const updateBoletoUI = (url, filename) => {
                    if (url) {
                        boletoPlaceholderText.style.display = 'none';
                        boletoLink.style.display = 'block';
                        boletoLink.href = `${API_BASE_URL}${url}`;
                        boletoLink.textContent = filename || 'Boleto Anexado';
                        btnBoletoAttach.style.display = 'none';
                        btnBoletoRemove.style.display = 'block';
                    } else {
                        boletoPlaceholderText.style.display = 'block';
                        boletoLink.style.display = 'none';
                        boletoLink.href = '#';
                        boletoLink.textContent = '';
                        btnBoletoAttach.style.display = 'block';
                        btnBoletoRemove.style.display = 'none';
                        boletoInput.value = '';
                        boletoUrlInput.value = '';
                    }
                };

                if (boletoInput) {
                    btnBoletoAttach.addEventListener('click', (e) => {
                        e.stopPropagation();
                        boletoInput.click();
                    });

                    boletoContainer.addEventListener('click', (e) => {
                        if (!boletoUrlInput.value && e.target !== btnBoletoRemove && e.target !== boletoLink) {
                            boletoInput.click();
                        }
                    });

                    btnBoletoRemove.addEventListener('click', (e) => {
                        e.stopPropagation();
                        updateBoletoUI(null, null);
                        markAsDirty();
                    });

                    boletoInput.addEventListener('change', async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        const formData = new FormData();
                        formData.append('file', file);

                        try {
                            boletoPlaceholderText.textContent = 'Enviando...';
                            boletoPlaceholderText.style.color = 'var(--color-gold)';

                            const response = await fetch(`${API_BASE_URL}/upload`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` },
                                body: formData
                            });

                            if (!response.ok) throw new Error('Falha no upload');

                            const result = await response.json();

                            boletoPlaceholderText.textContent = 'Clique no clipe para anexar...';
                            boletoPlaceholderText.style.color = '#9CA3AF';

                            boletoUrlInput.value = result.fileUrl;
                            updateBoletoUI(result.fileUrl, result.originalName);
                            markAsDirty();

                        } catch (error) {
                            console.error('Upload error:', error);
                            boletoPlaceholderText.textContent = 'Erro ao enviar. Tente novamente.';
                            boletoPlaceholderText.style.color = '#EF4444';
                            boletoInput.value = '';
                        }
                    });
                }

                const accountAsterisk = modal.querySelector('#account-required-asterisk');

                // Account Logic
                const updateAccountList = () => {
                    const selectedCompanyId = parseInt(companySelect.value);
                    const currentAccountId = parseInt(accountSelect.value || saida?.account_id || 0);

                    // Clear options
                    accountSelect.innerHTML = '<option value="">Selecione...</option>';

                    if (selectedCompanyId) {
                        const filteredAccounts = accounts.filter(acc => acc.company_id === selectedCompanyId);

                        filteredAccounts.forEach(acc => {
                            const option = document.createElement('option');
                            option.value = acc.id;
                            option.textContent = acc.name;
                            if (acc.id === currentAccountId) {
                                option.selected = true;
                            }
                            accountSelect.appendChild(option);
                        });
                    }

                    // Re-trigger validation or state toggle if needed
                    toggleAccountState();
                };

                const toggleAccountState = () => {
                    if (dataRealInput.value) {
                        accountSelect.disabled = false;
                        accountSelect.style.backgroundColor = 'white';
                        accountSelect.style.color = 'inherit';
                        accountAsterisk.style.display = 'inline';
                    } else {
                        accountSelect.disabled = true;
                        accountSelect.style.backgroundColor = 'var(--color-background-disabled)'; // Ensure this var exists or use #F3F4F6
                        accountSelect.style.color = '#9CA3AF';
                        accountAsterisk.style.display = 'none';
                        // accountSelect.value = ''; // Keep value logic as is
                        accountSelect.classList.remove('input-error');
                    }
                };

                // Initial State Check
                updateAccountList(); // Populate accounts based on initial company
                toggleAccountState();

                // Listen for Company changes
                companySelect.addEventListener('change', () => {
                    updateAccountList();
                    markAsDirty();
                });

                // Listen for Data Real changes
                dataRealInput.addEventListener('change', () => {
                    toggleAccountState();
                    markAsDirty();
                });
                dataRealInput.addEventListener('input', () => {
                    toggleAccountState(); // Immediate feedback
                });

                // Change Tracking
                [dataFatoInput, dataPrevistaInput, dataAtrasoInput, valorInput, companySelect, accountSelect, descricaoInput].forEach(el => {
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
                        confirmOverlay.className = 'dialog-overlay'; // Reuse class for centering
                        confirmOverlay.style.zIndex = '100000'; // Higher than modal
                        confirmOverlay.style.backgroundColor = 'rgba(0,0,0,0.4)';

                        // Use a simple white box structure manually to be sure
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
                        if (btnOk) btnOk.onclick = () => closeAlert();
                        alertOverlay.onclick = (e) => { if (e.target === alertOverlay) closeAlert(); };

                        // Focus button for accessibility
                        setTimeout(() => btnOk?.focus(), 50);
                    });
                };

                // Close / Cancel Logic
                const requestClose = async () => {
                    try {
                        if (hasChanges) {
                            // Use Custom Confirm
                            const confirmed = await showCustomConfirm('Tem certeza que deseja cancelar? As alterações não salvas serão perdidas.');
                            if (!confirmed) return;
                        }
                        close(null);
                        if (onCancel) onCancel();
                    } catch (e) {
                        console.error('Cancel Error:', e);
                        close(null); // Force close on error
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

                saveBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    try {
                        if (!validate()) {
                            await showCustomAlert('Existem campos obrigatórios não preenchidos (marcados em vermelho).');
                            return;
                        }

                        const data = {
                            dataFato: dataFatoInput.value,
                            dataPrevistaPagamento: dataPrevistaInput.value,
                            dataRealPagamento: dataRealInput.value || null,
                            dataAtraso: dataAtrasoInput.value || null,
                            valor: parseCurrency(valorInput.value),
                            descricao: descricaoInput.value.trim(),
                            tipoSaidaId: parseInt(tipoSaidaIdInput.value),
                            companyId: parseInt(companySelect.value),
                            accountId: parseInt(accountSelect.value),
                            comprovanteUrl: comprovanteUrlInput.value || null,
                            boletoUrl: boletoUrlInput.value || null,
                            formaPagamento: modal.querySelector('input[name="forma_pagamento"]:checked')?.value || null,
                            // Installment data
                            installmentType: installmentTypeSelect.value,
                            installmentCount: installmentTypeSelect.value === 'total' ? 1 : parseInt(installmentCountInput.value),
                            installmentInterval: installmentTypeSelect.value === 'total' ? null : installmentIntervalSelect.value,
                            customDays: installmentIntervalSelect.value === 'personalizado' ? parseInt(customDaysInput.value) : null
                        };
                        if (isEdit) {
                            data.id = saida.id;
                            data.active = saida.active !== undefined ? saida.active : true;
                        }
                        close(data);
                        if (onSave) onSave(data);
                    } catch (e) {
                        await showCustomAlert('Erro ao salvar: ' + e.message);
                    }
                });

                // Robust Listener Attachment
                if (cancelBtn) {
                    cancelBtn.onclick = null;
                    cancelBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Cancel clicked (custom logic)');
                        requestClose();
                    });
                } else {
                    console.error('Cancel button missing');
                }

                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) requestClose();
                });

            } catch (fatalError) {
                console.error('Modal Fatal Error:', fatalError);
                // Can't use custom alert here if basic DOM setup failed, but try fallback
                alert('Erro crítico ao abrir a janela: ' + fatalError.message);
                resolve(null); // Resolve to unblock caller
            }
        });
    }
};

