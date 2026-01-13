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

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.zIndex = '10000';

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'modal-content';
            modal.style.maxWidth = '600px';
            modal.style.width = '90%';

            // Convert ids to array to handle both Set and Array types
            const idsArray = Array.isArray(ids) ? ids : Array.from(ids);

            modal.innerHTML = `
                <div class="modal-header">
                    <h3>✏️ Edição em Lote</h3>
                    <button id="close-modal" class="btn-close">✕</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 1rem; color: #6B7280;">
                        Editando <strong>${idsArray.length}</strong> ${idsArray.length === 1 ? 'item' : 'itens'} selecionados.
                        Apenas os campos preenchidos serão atualizados.
                    </p>

                    <div class="form-group">
                        <label>Tipo ${type === 'income' ? 'Entrada' : 'Saída'}</label>
                        <select id="bulk-tipo" class="form-input">
                            <option value="">-- Manter atual --</option>
                        </select>
                    </div>

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

                const tipoId = modal.querySelector('#bulk-tipo').value;
                if (tipoId) updates.tipo_id = parseInt(tipoId);

                const empresaId = modal.querySelector('#bulk-empresa').value;
                if (empresaId) updates.company_id = parseInt(empresaId);

                const contaId = modal.querySelector('#bulk-conta').value;
                if (contaId) updates.account_id = parseInt(contaId);

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
