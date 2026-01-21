import { TreeSelector } from './TreeSelector.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { createTreeManager } from './GenericTreeManager.js';

export const IncomeModal = {
    show({ income = null, projectId, onSave, onCancel }) {
        return new Promise(async (resolve) => {
            try {
                const API_BASE_URL = getApiBaseUrl();
                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                const isEdit = income !== null;
                let hasChanges = false;

                // Check if bulk edit mode
                const isBulkEdit = income?._isBulkEdit === true;
                const bulkCount = income?._bulkCount || 0;

                // Check if editing an installment
                const isInstallment = income && income.installment_group_id && income.installment_number && income.installment_total;
                let installmentGroup = [];
                let totalInstallmentValue = income?.valor || 0;

                // Mark as dirty helper
                const markAsDirty = () => { hasChanges = true; };

                // Fetch data
                const token = localStorage.getItem('token');
                let tipoEntradas = [];
                let companies = [];
                let accounts = [];

                try {
                    const fetchPromises = [
                        fetch(`${API_BASE_URL}/tipo_entrada?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${API_BASE_URL}/companies?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${API_BASE_URL}/accounts?projectId=${projectId}`, { headers: { 'Authorization': `Bearer ${token}` } })
                    ];

                    // If editing installment, fetch the group data
                    if (isInstallment) {
                        fetchPromises.push(
                            fetch(`${API_BASE_URL}/incomes/group/${income.installment_group_id}?currentId=${income.id}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            })
                        );
                    }

                    const responses = await Promise.all(fetchPromises);

                    const [tipoResponse, companyResponse, accountResponse, groupResponse] = responses;

                    if (tipoResponse.ok) {
                        const json = await tipoResponse.json();
                        tipoEntradas = Array.isArray(json) ? json : [];
                    }
                    if (companyResponse.ok) {
                        const json = await companyResponse.json();
                        companies = Array.isArray(json) ? json : [];
                    }
                    if (accountResponse.ok) {
                        const json = await accountResponse.json();
                        accounts = Array.isArray(json) ? json : [];
                    }

                    // Process installment group data
                    if (groupResponse && groupResponse.ok) {
                        const groupData = await groupResponse.json();
                        installmentGroup = groupData.installments || [];
                        // Calculate total value (sum all installments)
                        totalInstallmentValue = installmentGroup.reduce((sum, inst) => sum + parseFloat(inst.valor || 0), 0);
                    }
                } catch (error) {
                    console.error('Error loading data:', error);
                    // Defer alert slightly to ensure DOM is ready or just use standard alert for fatal load error
                    alert('Erro ao carregar dados do servidor: ' + error.message);
                }

                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';
                overlay.style.zIndex = '1000'; // Main modal - lowest layer

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
                    <div class="account-modal-body" style="padding: 1rem; overflow-y: auto; max-height: 90vh;">
                        <h3 style="margin: 0 0 1rem 0; color: var(--color-primary); font-size: 1.1rem;">${isBulkEdit ? `✏️ Edição em Lote (${bulkCount} itens)` : isEdit ? 'Editar Entrada' : 'Nova Entrada'}</h3>
                        
                        ${isBulkEdit ? `
                            <div style="background: #F3F4F6; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid var(--color-primary);">
                                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                                    <span style="font-size: 1.5rem;">✏️</span>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 700; font-size: 1rem; color: #374151;">Editando ${bulkCount} ${bulkCount === 1 ? 'item' : 'itens'} selecionados</div>
                                        <div style="font-size: 0.9rem; color: #6B7280; margin-top: 0.25rem;">Apenas os campos alterados serão atualizados.</div>
                                    </div>
                                </div>
                                <div style="font-size: 0.85rem; color: #6B7280; background: white; padding: 0.5rem; border-radius: 4px;">
                                    💡 <strong>Dica:</strong> Campos com valores iguais em todos os itens aparecem preenchidos. Campos com valores diferentes aparecem em branco. Deixe em branco os campos que não deseja alterar.
                                </div>
                            </div>
                        ` : isInstallment ? `
                            <div style="background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%); color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);">
                                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                                    <span style="font-size: var(--text-table-title);">📋</span>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 700; font-size: 1.1rem;">Editando Parcela ${income.installment_number} de ${income.installment_total}</div>
                                        <div style="font-size: 0.9rem; opacity: 0.95; margin-top: 0.25rem;">Parcelamento - Valor Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInstallmentValue)}</div>
                                    </div>
                                </div>
                                <div style="font-size: 0.85rem; opacity: 0.9; background: rgba(255,255,255,0.15); padding: 0.5rem; border-radius: 4px;">
                                    ⚠️ <strong>Importante:</strong> Ao editar ou excluir, você pode escolher aplicar a alteração apenas nesta parcela, em todas as parcelas, ou nesta e nas futuras.
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="form-grid" style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.75rem;">
                            
                            <!-- Row 1: All Dates (2+2+2+2 = 8 cols) -->
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="income-data-fato">Data do Fato ${isBulkEdit ? '' : '<span class="required">*</span>'}</label>
                                <input type="date" id="income-data-fato" class="form-input" 
                                    value="${formatDateForInput(income?.data_fato)}" ${isBulkEdit ? '' : 'required'} />
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="income-data-prevista">Data Prevista ${isBulkEdit ? '' : '<span class="required">*</span>'}</label>
                                <input type="date" id="income-data-prevista" class="form-input" 
                                    value="${formatDateForInput(income?.data_prevista_recebimento)}" ${isBulkEdit ? '' : 'required'} />
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="income-data-atraso">Data Atraso <span style="font-style: italic; color: #9CA3AF; font-weight: normal;">(só se atrasar)</span></label>
                                <input type="date" id="income-data-atraso" class="form-input" 
                                    value="${formatDateForInput(income?.data_atraso)}" />
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="income-data-real">Data Real</label>
                                <input type="date" id="income-data-real" class="form-input" 
                                    value="${formatDateForInput(income?.data_real_recebimento)}" />
                            </div>

                            <!-- Row 2: Empresa (2), Conta (2), Valor (2), Tipo (2) = 8 cols -->
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="income-company">Empresa ${isBulkEdit ? '' : '<span class="required">*</span>'}</label>
                                <select id="income-company" class="form-input" ${isBulkEdit ? '' : 'required'}>
                                    <option value="">${isBulkEdit ? '-- Manter atual --' : 'Selecione...'}</option>
                                    ${companies.map(c => `
                                        <option value="${c.id}" ${income?.company_id === c.id ? 'selected' : ''}>${c.name}</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="income-account">Conta <span id="account-required-asterisk" style="display: ${income?.data_real_recebimento ? 'inline' : 'none'};">*</span></label>
                                <select id="income-account" class="form-input">
                                    <option value="">Selecione...</option>
                                </select>
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="income-valor">Valor (R$) ${isBulkEdit ? '' : '<span class="required">*</span>'} ${isInstallment ? '<span style="font-size: 0.75rem; color: #6B7280; font-weight: normal;">(Desta Parcela)</span>' : ''}</label>
                                <div id="income-valor-wrapper" class="form-input" style="display: flex; align-items: center; background: white; cursor: text; padding: 0.5rem 0.75rem; transition: all 0.2s; border: 1px solid #D1D5DB; border-radius: 6px;">
                                    <input type="text" id="income-valor" 
                                        style="border: none !important; outline: none !important; padding: 0 !important; margin: 0 !important; flex: 0 1 auto; min-width: 10px; font-family: inherit; font-size: inherit; color: inherit; background: transparent !important; width: 100%; box-shadow: none !important; appearance: none !important; -webkit-appearance: none !important;"
                                        placeholder="${isBulkEdit ? 'Deixe em branco para manter' : 'R$ 0,00'}" />
                                    <span id="income-valor-suffix" style="color: #9CA3AF; pointer-events: none; margin-left: 0; user-select: none; display: none;">,00</span>
                                </div>
                            </div>

                            <div class="form-group" style="grid-column: span 2;">
                                <label for="income-installment-type">Tipo de Lançamento</label>
                                <select id="income-installment-type" class="form-input" ${isInstallment ? 'disabled' : ''}>
                                    <option value="total" ${isInstallment ? '' : 'selected'}>Entrada Única</option>
                                    <option value="dividir" ${isInstallment && !income.installment_interval ? 'selected' : ''}>Dividir (Parcelar)</option>
                                    <option value="replicar" ${isInstallment && income.installment_interval ? 'selected' : ''}>Replicar (Recorrente)</option>
                                </select>
                            </div>

                            <!-- Row 3 (Conditional): Parcelas, Intervalo, Dias - Only shows when Dividir/Replicar -->
                            <div class="form-group" id="installment-count-group" style="grid-column: span 2; display: none;">
                                <label for="income-installment-count">Nº Parcelas</label>
                                <input type="number" id="income-installment-count" class="form-input" 
                                    min="2" max="120" value="2" />
                            </div>

                            <div class="form-group" id="installment-interval-group" style="grid-column: span 2; display: none;">
                                <label for="income-installment-interval">Intervalo</label>
                                <select id="income-installment-interval" class="form-input">
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
                                <label for="income-custom-days">Dias</label>
                                <input type="number" id="income-custom-days" class="form-input" 
                                    min="1" max="365" value="10" placeholder="Ex: 10" />
                            </div>

                            <!-- Spacer to fill remaining columns when installments are visible -->
                            <div id="installment-spacer" style="grid-column: span 2; display: none;"></div>

                            <!-- Row 4: Boleto/Cobrança (4), Comprovante (4) = 8 cols -->
                            <div class="form-group" style="grid-column: span 4;">
                                <label for="income-boleto">Boleto/Cobrança</label>
                                <input type="file" id="income-boleto" style="display: none;" accept="image/*,application/pdf" />
                                <input type="hidden" id="income-boleto-url" value="${income?.boleto_url || ''}" />
                                
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
                                            ${income?.boleto_url ? '' : 'Clique no clipe para anexar...'}
                                        </span>
                                        <a id="boleto-link" href="${income?.boleto_url ? API_BASE_URL + income.boleto_url : '#'}" target="_blank" 
                                           style="display: ${income?.boleto_url ? 'block' : 'none'}; color: var(--color-primary); text-decoration: underline; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
                                           ${income?.boleto_url ? income.boleto_url.split('/').pop().split('-').slice(1).join('-') : ''}
                                        </a>
                                    </div>

                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span id="btn-boleto-attach" style="cursor: pointer; font-size: 1.2rem; display: ${income?.boleto_url ? 'none' : 'block'};" title="Anexar Boleto">📎</span>
                                        <span id="btn-boleto-remove" style="cursor: pointer; font-size: 1.2rem; display: ${income?.boleto_url ? 'block' : 'none'};" title="Remover Boleto">🗑️</span>
                                    </div>
                                </div>
                            </div>

                            <div class="form-group" style="grid-column: span 4;">
                                <label for="income-comprovante">Comprovante</label>
                                <input type="file" id="income-comprovante" style="display: none;" accept="image/*,application/pdf" />
                                <input type="hidden" id="income-comprovante-url" value="${income?.comprovante_url || ''}" />
                                
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
                                            ${income?.comprovante_url ? '' : 'Clique no clipe para anexar...'}
                                        </span>
                                        <a id="file-link" href="${income?.comprovante_url ? API_BASE_URL + income.comprovante_url : '#'}" target="_blank" 
                                           style="display: ${income?.comprovante_url ? 'block' : 'none'}; color: var(--color-primary); text-decoration: underline; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
                                           ${income?.comprovante_url ? income.comprovante_url.split('/').pop().split('-').slice(1).join('-') : ''}
                                        </a>
                                    </div>

                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span id="btn-attach" style="cursor: pointer; font-size: 1.2rem; display: ${income?.comprovante_url ? 'none' : 'block'};" title="Anexar Arquivo">📎</span>
                                        <span id="btn-remove" style="cursor: pointer; font-size: 1.2rem; display: ${income?.comprovante_url ? 'block' : 'none'};" title="Remover Arquivo">🗑️</span>
                                    </div>
                                </div>
                                <div id="comprovante-preview" style="margin-top: 5px; font-size: 0.85rem; display: none;"></div>
                            </div>

                            <!-- Row 3.5: Payment Method Radio Buttons (Span 6) -->
                            <!-- Row 3.5: Payment Method Radio Buttons (Span 4 - Left Side) -->
                            <!-- Row 3.5: Payment Method Radio Buttons (Span 4 - Left Side) -->
                            <!-- Row 3.5: Payment Method Radio Buttons (Span 4 - Left Side) -->
                            <!-- Row 3: Left Column Container (Radio Buttons + Description) (Span 4) -->
                            <div style="grid-column: span 4; grid-row: span 2; display: flex; flex-direction: column; gap: 0.5rem;">
                                <!-- Payment Method -->
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="margin-bottom: 0.25rem; display: block;">Forma de Entrada</label>
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; padding: 0;">
                                        ${['Pix', 'Ted', 'DOC', 'Boleto', 'Verificar', 'Dinheiro', 'Cartão'].map(opt => `
                                            <div style="display: flex; align-items: center; gap: 0.3rem;">
                                                <input type="radio" name="forma_pagamento" id="fp-${opt}" value="${opt}" 
                                                    ${income?.forma_pagamento === opt ? 'checked' : ''} style="cursor: pointer;">
                                                <label for="fp-${opt}" style="margin: 0; cursor: pointer; font-weight: normal; font-size: 0.9rem; white-space: nowrap;">${opt}</label>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                               
                                <!-- Description -->
                                <div class="form-group" style="display: flex; flex-direction: column; flex: 1; min-height: 150px; margin-top: 0;">
                                    <label for="income-descricao" style="margin-bottom: 0;">Descrição ${isBulkEdit ? '' : '<span class="required">*</span>'}</label>
                                    <textarea id="income-descricao" class="form-input" placeholder="${isBulkEdit ? 'Deixe em branco para manter' : 'Obrigatório'}" ${isBulkEdit ? '' : 'required'} style="resize: none; flex: 1; box-sizing: border-box; font-family: inherit;">${income?.descricao || ''}</textarea>
                                </div>
                            </div>

                            <!-- Tree Selector (Span 4 - Right Side - Spanning 2 Rows) -->
                            <div class="form-group" style="grid-column: span 4; grid-row: span 2; display: flex; flex-direction: column; min-height: 300px; padding-left: 0.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                                    <label style="margin: 0;">Tipo de Entrada ${isBulkEdit ? '' : '<span class="required">*</span>'}</label>
                                    <button id="btn-manage-tipo-entrada" type="button" 
                                            style="background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 2px; display: flex; align-items: center; justify-content: center; color: var(--color-primary); transition: transform 0.2s;" 
                                            title="Gerenciar Tipos de Entrada"
                                            onmouseover="this.style.transform='rotate(45deg)'"
                                            onmouseout="this.style.transform='rotate(0deg)'">
                                        ⚙️ <span style="color: #9CA3AF; font-style: italic; font-size: 0.85rem; font-weight: normal;">Config/Filtros</span>
                                    </button>
                                </div>
                                <div id="tree-selector-container" style="flex: 1;"></div>
                                <input type="hidden" id="income-tipo-entrada-id" value="${income?.tipo_entrada_id || ''}" />
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
                const dataFatoInput = modal.querySelector('#income-data-fato');
                const dataPrevistaInput = modal.querySelector('#income-data-prevista');
                const dataRealInput = modal.querySelector('#income-data-real');
                const dataAtrasoInput = modal.querySelector('#income-data-atraso');
                const valorInput = modal.querySelector('#income-valor');
                const valorWrapper = modal.querySelector('#income-valor-wrapper');
                const valorSuffix = modal.querySelector('#income-valor-suffix');
                const installmentTypeSelect = modal.querySelector('#income-installment-type');
                const installmentCountInput = modal.querySelector('#income-installment-count');
                const installmentIntervalSelect = modal.querySelector('#income-installment-interval');
                const installmentCountGroup = modal.querySelector('#installment-count-group');
                const installmentIntervalGroup = modal.querySelector('#installment-interval-group');
                const customDaysInput = modal.querySelector('#income-custom-days');
                const customDaysGroup = modal.querySelector('#custom-days-group');
                const installmentSpacer = modal.querySelector('#installment-spacer');
                const comprovanteInput = modal.querySelector('#income-comprovante');
                const comprovanteUrlInput = modal.querySelector('#income-comprovante-url');
                const comprovantePreview = modal.querySelector('#comprovante-preview');
                const boletoInput = modal.querySelector('#income-boleto');
                const boletoUrlInput = modal.querySelector('#income-boleto-url');
                const tipoEntradaIdInput = modal.querySelector('#income-tipo-entrada-id');
                const treeContainer = modal.querySelector('#tree-selector-container');
                const companySelect = modal.querySelector('#income-company');
                const accountSelect = modal.querySelector('#income-account');
                const descricaoInput = modal.querySelector('#income-descricao');
                const saveBtn = modal.querySelector('#modal-save');
                const cancelBtn = modal.querySelector('#modal-cancel');

                const validate = () => {
                    // In bulk edit mode, no fields are required
                    if (isBulkEdit) return true;

                    let isValid = true;
                    if (!dataFatoInput.value) { dataFatoInput.classList.add('input-error'); isValid = false; } else dataFatoInput.classList.remove('input-error');
                    if (!dataPrevistaInput.value) { dataPrevistaInput.classList.add('input-error'); isValid = false; } else dataPrevistaInput.classList.remove('input-error');
                    if (!valorInput.value) {
                        if (valorWrapper) valorWrapper.classList.add('input-error');
                        valorInput.classList.remove('input-error');
                        isValid = false;
                    } else {
                        if (valorWrapper) valorWrapper.classList.remove('input-error');
                        valorInput.classList.remove('input-error');
                    }
                    if (!descricaoInput.value || !descricaoInput.value.trim()) {
                        descricaoInput.classList.add('input-error');
                        isValid = false;
                    } else {
                        descricaoInput.classList.remove('input-error');
                    }
                    if (!tipoEntradaIdInput.value) {
                        const innerTree = treeContainer.querySelector('.tree-selector-wrapper');
                        if (innerTree) innerTree.classList.add('input-error');
                        isValid = false;
                    } else {
                        const innerTree = treeContainer.querySelector('.tree-selector-wrapper');
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

                // Helper to open management sub-modal
                const openManagementSubModal = () => {
                    const subOverlay = document.createElement('div');
                    subOverlay.className = 'dialog-overlay';
                    subOverlay.style.zIndex = '5000'; // Above main modal (1000) but below dialogs (10000)
                    subOverlay.style.display = 'flex';
                    subOverlay.style.alignItems = 'center';
                    subOverlay.style.justifyContent = 'center';

                    const closeSubModal = async () => {
                        if (container.contains(subOverlay)) container.removeChild(subOverlay);
                        // Refresh tree data after closing
                        try {
                            const res = await fetch(`${API_BASE_URL}/tipo_entrada?projectId=${projectId}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (res.ok) {
                                tipoEntradas = await res.json();

                                // Reload allowedIds from server after management modal closes
                                try {
                                    const prefKey = 'tree_selection_tipo_entrada';
                                    const prefResponse = await fetch(`${API_BASE_URL}/user-preferences/${prefKey}`, {
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    if (prefResponse.ok) {
                                        const prefData = await prefResponse.json();
                                        if (prefData.value) {
                                            const parsed = prefData.value;
                                            allowedIds = parsed.checkedNodes || null;
                                        } else {
                                            allowedIds = null;
                                        }
                                    } else {
                                        allowedIds = null;
                                    }
                                } catch (e) {
                                    console.error('Error loading tree preferences from server', e);
                                    allowedIds = null;
                                }

                                renderTree();
                            }
                        } catch (err) {
                            console.error('Error refreshing types:', err);
                        }
                    };

                    const manager = createTreeManager('tipo_entrada', 'Gerenciar Tipos de Entrada', 'Entrada', closeSubModal);
                    subOverlay.innerHTML = manager.render(true);
                    container.appendChild(subOverlay);
                    manager.init();
                };

                const manageBtn = modal.querySelector('#btn-manage-tipo-entrada');
                if (manageBtn) manageBtn.onclick = openManagementSubModal;

                // Load saved filter for TreeSelector from server
                let allowedIds = null;
                try {
                    const prefKey = 'tree_selection_tipo_entrada';
                    const prefResponse = await fetch(`${API_BASE_URL}/user-preferences/${prefKey}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (prefResponse.ok) {
                        const prefData = await prefResponse.json();
                        if (prefData.value) {
                            const parsed = prefData.value;
                            allowedIds = parsed.checkedNodes || null;
                        }
                    }
                } catch (e) {
                    console.error('Error loading tree preferences from server', e);
                }

                const renderTree = () => {
                    treeContainer.innerHTML = '';
                    const initialTipoId = parseInt(tipoEntradaIdInput.value);
                    TreeSelector.render(treeContainer, tipoEntradas, initialTipoId, (selectedId) => {
                        if (initialTipoId !== selectedId) {
                            hasChanges = true;
                        }
                        tipoEntradaIdInput.value = selectedId;
                        validate();
                    }, allowedIds);
                };

                // Initialize Tree Selector
                renderTree();

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

                // Helper: Adjust input width to fit content
                const adjustInputWidth = () => {
                    if (!valorInput) return;
                    const canvas = adjustInputWidth.canvas || (adjustInputWidth.canvas = document.createElement("canvas"));
                    const context = canvas.getContext("2d");
                    const style = window.getComputedStyle(valorInput);
                    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

                    // If empty, reset to 100% to show placeholder properly (or min width)
                    if (!valorInput.value) {
                        valorInput.style.width = '100%';
                        return;
                    }

                    // Measure text
                    const width = context.measureText(valorInput.value).width;
                    valorInput.style.width = (width + 2) + "px"; // +2px buffer
                };

                // Helper: Update suffix visibility
                const updateSuffix = () => {
                    const val = valorInput.value;
                    if (!val) {
                        valorSuffix.style.display = 'none';
                        return;
                    }

                    // If value already has comma (decimal part), hide suffix
                    // Also hide if it starts with R$ (formatted view) - suffix is for typing mode
                    if (val.includes(',') || val.includes('R$')) {
                        valorSuffix.style.display = 'none';
                    } else {
                        valorSuffix.style.display = 'inline';
                    }
                };

                // Set valor - always show individual record value
                if (income?.valor !== undefined && income?.valor !== null) {
                    valorInput.value = formatFloat(Number(income.valor));
                }

                // Wrapper Click to Focus
                if (valorWrapper) {
                    valorWrapper.addEventListener('click', () => {
                        valorInput.focus();
                    });
                }

                // On Focus: Show raw value for easy editing
                valorInput.addEventListener('focus', (e) => {
                    if (valorWrapper) {
                        valorWrapper.style.borderColor = 'var(--color-primary)';
                        valorWrapper.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }

                    let val = e.target.value;
                    val = val.replace('R$', '').trim();
                    val = val.replace(/\./g, ''); // Remove thousands separator
                    e.target.value = val;

                    adjustInputWidth();
                    updateSuffix();
                });

                // On Blur: Format back to Currency
                valorInput.addEventListener('blur', (e) => {
                    if (valorWrapper) {
                        valorWrapper.style.borderColor = ''; // Clear inline to let class (error/default) rule
                        valorWrapper.style.boxShadow = '';
                    }

                    let val = e.target.value;
                    if (val === '' || val === '-') {
                        e.target.value = '';
                    } else {
                        let num = parseCurrency(val);
                        e.target.value = formatFloat(num);
                    }

                    // Reset to full width for placeholder or formatted view
                    valorInput.style.width = '100%';
                    updateSuffix(); // Will hide suffix because of R$ or comma
                    validate();
                });

                // On Input: Allow valid characters only
                // On Input: Allow valid characters only
                valorInput.addEventListener('keydown', (e) => {
                    // Intercept dot (.) or NumpadDecimal to insert comma
                    if (e.key === '.' || e.key === 'Decimal') {
                        e.preventDefault();
                        const start = e.target.selectionStart;
                        const end = e.target.selectionEnd;
                        const val = e.target.value;

                        // Insert comma at cursor
                        e.target.value = val.substring(0, start) + ',' + val.substring(end);
                        e.target.selectionStart = e.target.selectionEnd = start + 1;

                        // Dispatch input event to trigger formatting logic
                        e.target.dispatchEvent(new Event('input'));
                    }
                });

                valorInput.addEventListener('input', (e) => {
                    let val = e.target.value;

                    // Remove all non-numeric and non-comma characters (including existing periods)
                    // We rebuild periods dynamically
                    let clean = val.replace(/[^0-9,]/g, '');

                    // Prevent multiple commas: keep only the first one found
                    const parts = clean.split(',');
                    if (parts.length > 2) {
                        clean = parts[0] + ',' + parts.slice(1).join('');
                    }

                    // Format Integer Part with Thousands Separator
                    const commaIndex = clean.indexOf(',');
                    if (commaIndex !== -1) {
                        const integerPart = clean.substring(0, commaIndex);
                        const decimalPart = clean.substring(commaIndex);
                        // Format integer part
                        const formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                        clean = formattedInt + decimalPart;
                    } else {
                        // No comma yet, just format integers
                        clean = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                    }

                    if (clean !== val) {
                        // Restore cursor position strategy (simple: end if appending, smart if editing)
                        // For simplicity in this iteration:
                        e.target.value = clean;
                    }

                    adjustInputWidth();
                    updateSuffix();
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

                // Disable installment fields when editing an existing installment
                if (isInstallment) {
                    installmentTypeSelect.disabled = true;
                    installmentCountInput.disabled = true;
                    installmentIntervalSelect.disabled = true;
                    customDaysInput.disabled = true;

                    // Set the correct values to show current configuration
                    if (income.installment_interval) {
                        installmentTypeSelect.value = 'replicar';
                    } else {
                        installmentTypeSelect.value = 'dividir';
                    }
                    installmentCountInput.value = income.installment_total || 2;
                    installmentIntervalSelect.value = income.installment_interval || 'mensal';
                    if (income.installment_custom_days) {
                        customDaysInput.value = income.installment_custom_days;
                    }

                    // Show fields but greyed out
                    toggleInstallmentFields();

                    // Add visual indicator
                    [installmentTypeSelect, installmentCountInput, installmentIntervalSelect, customDaysInput].forEach(field => {
                        if (field) {
                            field.style.backgroundColor = '#f3f4f6';
                            field.style.cursor = 'not-allowed';
                        }
                    });
                }

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
                    const currentAccountId = parseInt(accountSelect.value || income?.account_id || 0);

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
                            dataPrevistaRecebimento: dataPrevistaInput.value,
                            dataRealRecebimento: dataRealInput.value || null,
                            dataAtraso: dataAtrasoInput.value || null,
                            valor: parseCurrency(valorInput.value),
                            descricao: descricaoInput.value.trim(),
                            tipoEntradaId: parseInt(tipoEntradaIdInput.value),
                            companyId: parseInt(companySelect.value),
                            accountId: parseInt(accountSelect.value),
                            comprovanteUrl: comprovanteUrlInput.value || null,
                            boletoUrl: boletoUrlInput.value || null,
                            formaPagamento: modal.querySelector('input[name="forma_pagamento"]:checked')?.value || null,
                            // Installment data
                            installmentType: installmentTypeSelect.value,
                            installmentCount: installmentTypeSelect.value === 'total' ? 1 : parseInt(installmentCountInput.value),
                            installmentInterval: installmentTypeSelect.value === 'total' ? null : installmentIntervalSelect.value,
                            installmentCustomDays: installmentIntervalSelect.value === 'personalizado' ? parseInt(customDaysInput.value) : null
                        };
                        if (isEdit) {
                            data.id = income.id;
                            data.active = income.active !== undefined ? income.active : true;
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

