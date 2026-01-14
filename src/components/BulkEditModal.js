import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

const BulkEditModal = {
    show: async ({ items, ids, projectId, type, onSave }) => {
        console.log('[BulkEditModal] show() called with:', { items, ids, projectId, type });
        console.log('[BulkEditModal] items count:', items?.length);
        console.log('[BulkEditModal] ids count:', ids?.length);

        return new Promise((resolve) => {
            console.log('[BulkEditModal] Creating modal elements...');
            const API_BASE_URL = getApiBaseUrl();

            // Create overlay with inline styles
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                backdrop-filter: blur(4px);
            `;

            // Create modal with inline styles
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 600px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
            `;

            // Convert ids to array to handle both Set and Array types
            const idsArray = Array.isArray(ids) ? ids : Array.from(ids);

            modal.innerHTML = `
                <div class="modal-header">
                    <h3>✏️ Edição em Lote</h3>
                    <button id="close-modal" class="btn-close">✕</button>
                </div>
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    <p style="margin-bottom: 1rem; color: #6B7280; background: #F3F4F6; padding: 0.75rem; border-radius: 6px;">
                        Editando <strong style="color: var(--color-primary);">${idsArray.length}</strong> ${idsArray.length === 1 ? 'item' : 'itens'} selecionados.
                        <br><span style="font-size: 0.9em;">Apenas os campos alterados serão atualizados.</span>
                    </p>

                    <!-- Datas -->
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Data do Fato</label>
                            <input type="date" id="bulk-data-fato" class="form-input">
                            <label style="font-size: 0.8em; color: #9CA3AF; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem;">
                                <input type="checkbox" id="clear-data-fato" style="transform: scale(0.9);"> Limpar campo
                            </label>
                        </div>

                        <div class="form-group">
                            <label>Data Prevista</label>
                            <input type="date" id="bulk-data-prevista" class="form-input">
                            <label style="font-size: 0.8em; color: #9CA3AF; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem;">
                                <input type="checkbox" id="clear-data-prevista" style="transform: scale(0.9);"> Limpar campo
                            </label>
                        </div>

                        <div class="form-group">
                            <label>Data Atraso</label>
                            <input type="date" id="bulk-data-atraso" class="form-input">
                            <label style="font-size: 0.8em; color: #9CA3AF; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem;">
                                <input type="checkbox" id="clear-data-atraso" style="transform: scale(0.9);"> Limpar campo
                            </label>
                        </div>

                        <div class="form-group">
                            <label>Data Real</label>
                            <input type="date" id="bulk-data-real" class="form-input">
                            <label style="font-size: 0.8em; color: #9CA3AF; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem;">
                                <input type="checkbox" id="clear-data-real" style="transform: scale(0.9);"> Limpar campo
                            </label>
                        </div>
                    </div>

                    <!-- Empresa, Conta, Valor -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Empresa</label>
                            <select id="bulk-empresa" class="form-input">
                                <option value="">-- Manter atual --</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Conta Bancária</label>
                            <select id="bulk-conta" class="form-input">
                                <option value="">-- Manter atual --</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Valor (R$)</label>
                            <input type="text" id="bulk-valor" class="form-input" placeholder="R$ 0,00">
                            <label style="font-size: 0.8em; color: #9CA3AF; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem;">
                                <input type="checkbox" id="clear-valor" style="transform: scale(0.9);"> Limpar campo
                            </label>
                        </div>
                    </div>

                    <!-- Tipo e Forma de Pagamento -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Tipo ${type === 'income' ? 'Entrada' : 'Saída'}</label>
                            <select id="bulk-tipo" class="form-input">
                                <option value="">-- Manter atual --</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Forma de ${type === 'income' ? 'Entrada' : 'Pagamento'}</label>
                            <select id="bulk-forma-pagamento" class="form-input">
                                <option value="">-- Manter atual --</option>
                                <option value="Pix">Pix</option>
                                <option value="Ted">Ted</option>
                                <option value="DOC">DOC</option>
                                <option value="Boleto">Boleto</option>
                                <option value="Verificar">Verificar</option>
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="Cartão">Cartão</option>
                            </select>
                        </div>
                    </div>

                    <!-- Descrição -->
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Descrição</label>
                        <select id="bulk-desc-mode" class="form-input" style="margin-bottom: 0.5rem;">
                            <option value="">-- Manter atual --</option>
                            <option value="replace">Substituir</option>
                            <option value="prefix">Adicionar Prefixo</option>
                            <option value="suffix">Adicionar Sufixo</option>
                        </select>
                        <input type="text" id="bulk-desc-value" class="form-input" placeholder="Texto..." style="display: none;">
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="btn-cancel" class="btn-secondary">Cancelar</button>
                    <button id="btn-save" class="btn-primary">Salvar Alterações</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Load dropdown options
            const loadOptions = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const headers = {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    };

                    // Load tipos
                    const tipoEndpoint = type === 'income' ? '/tipo-entrada' : '/tipo-saida';
                    const tiposRes = await fetch(`${API_BASE_URL}${tipoEndpoint}?projectId=${projectId}`, { headers });

                    if (!tiposRes.ok) {
                        throw new Error(`Failed to load tipos: ${tiposRes.status}`);
                    }

                    const tiposData = await tiposRes.json();
                    const tipos = Array.isArray(tiposData) ? tiposData : [];

                    const tipoSelect = modal.querySelector('#bulk-tipo');
                    tipos.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.id;
                        opt.textContent = t.label || t.name;
                        tipoSelect.appendChild(opt);
                    });

                    // Load empresas
                    const empresasRes = await fetch(`${API_BASE_URL}/companies?projectId=${projectId}`, { headers });

                    if (!empresasRes.ok) {
                        throw new Error(`Failed to load companies: ${empresasRes.status}`);
                    }

                    const empresasData = await empresasRes.json();
                    const empresas = Array.isArray(empresasData) ? empresasData : [];

                    const empresaSelect = modal.querySelector('#bulk-empresa');
                    empresas.forEach(e => {
                        const opt = document.createElement('option');
                        opt.value = e.id;
                        opt.textContent = e.name;
                        empresaSelect.appendChild(opt);
                    });

                    // Load contas
                    const contasRes = await fetch(`${API_BASE_URL}/accounts?projectId=${projectId}`, { headers });

                    if (!contasRes.ok) {
                        throw new Error(`Failed to load accounts: ${contasRes.status}`);
                    }

                    const contasData = await contasRes.json();
                    const contas = Array.isArray(contasData) ? contasData : [];

                    const contaSelect = modal.querySelector('#bulk-conta');
                    contas.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c.id;
                        opt.textContent = c.name;
                        contaSelect.appendChild(opt);
                    });

                } catch (error) {
                    console.error('Error loading options:', error);
                    showToast('Erro ao carregar opções: ' + error.message, 'error');
                }
            };

            loadOptions();

            // Description mode change
            const descMode = modal.querySelector('#bulk-desc-mode');
            const descValue = modal.querySelector('#bulk-desc-value');
            descMode.onchange = () => {
                descValue.style.display = descMode.value ? 'block' : 'none';
            };

            // Close handlers
            const close = () => {
                document.body.removeChild(overlay);
                resolve(null);
            };

            modal.querySelector('#close-modal').onclick = close;
            modal.querySelector('#btn-cancel').onclick = close;
            overlay.onclick = (e) => {
                if (e.target === overlay) close();
            };

            // Save handler
            modal.querySelector('#btn-save').onclick = async () => {
                const updates = {};

                // Datas
                const dataFato = modal.querySelector('#bulk-data-fato').value;
                const clearDataFato = modal.querySelector('#clear-data-fato').checked;
                if (clearDataFato) updates.data_fato = null;
                else if (dataFato) updates.data_fato = dataFato;

                const dataPrevista = modal.querySelector('#bulk-data-prevista').value;
                const clearDataPrevista = modal.querySelector('#clear-data-prevista').checked;
                if (clearDataPrevista) updates.data_prevista_recebimento = null;
                else if (dataPrevista) updates.data_prevista_recebimento = dataPrevista;

                const dataAtraso = modal.querySelector('#bulk-data-atraso').value;
                const clearDataAtraso = modal.querySelector('#clear-data-atraso').checked;
                if (clearDataAtraso) updates.data_atraso = null;
                else if (dataAtraso) updates.data_atraso = dataAtraso;

                const dataReal = modal.querySelector('#bulk-data-real').value;
                const clearDataReal = modal.querySelector('#clear-data-real').checked;
                if (clearDataReal) updates.data_real_recebimento = null;
                else if (dataReal) updates.data_real_recebimento = dataReal;

                // Empresa, Conta
                const empresaId = modal.querySelector('#bulk-empresa').value;
                if (empresaId) updates.company_id = parseInt(empresaId);

                const contaId = modal.querySelector('#bulk-conta').value;
                if (contaId) updates.account_id = parseInt(contaId);

                // Valor
                const valorInput = modal.querySelector('#bulk-valor').value;
                const clearValor = modal.querySelector('#clear-valor').checked;
                if (clearValor) {
                    updates.valor = null;
                } else if (valorInput) {
                    // Parse currency
                    let clean = valorInput.replace(/[^0-9,-]+/g, "");
                    clean = clean.replace(',', '.');
                    const valor = parseFloat(clean) || 0;
                    if (valor > 0) updates.valor = valor;
                }

                // Tipo
                const tipoId = modal.querySelector('#bulk-tipo').value;
                if (tipoId) updates.tipo_id = parseInt(tipoId);

                // Forma de Pagamento
                const formaPagamento = modal.querySelector('#bulk-forma-pagamento').value;
                if (formaPagamento) updates.forma_pagamento = formaPagamento;

                // Descrição
                const descMode = modal.querySelector('#bulk-desc-mode').value;
                const descValue = modal.querySelector('#bulk-desc-value').value.trim();
                if (descMode && descValue) {
                    updates.description_mode = descMode;
                    updates.description_value = descValue;
                }

                if (Object.keys(updates).length === 0) {
                    showToast('Selecione pelo menos um campo para atualizar', 'warning');
                    return;
                }

                document.body.removeChild(overlay);
                await onSave(updates);
                resolve(updates);
            };
        });
    }
};

export default BulkEditModal;
