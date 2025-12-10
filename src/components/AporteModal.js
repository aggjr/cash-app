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
                            
                            <!-- Dates -->
                            <div style="display: flex; gap: 1rem;">
                                <div style="flex: 1;">
                                    <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Data Fato *</label>
                                    <input type="date" id="aporte-fato" class="form-input" value="${aporte?.data_fato ? aporte.data_fato.substring(0, 10) : today}">
                                </div>
                                <div style="flex: 1;">
                                    <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Data Real</label>
                                    <input type="date" id="aporte-real" class="form-input" value="${aporte?.data_real ? aporte.data_real.substring(0, 10) : today}">
                                </div>
                            </div>

                            <!-- Value & Description -->
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Valor (R$) *</label>
                                <input type="number" step="0.01" id="aporte-valor" class="form-input" placeholder="0.00" value="${aporte?.valor || ''}">
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Descrição</label>
                                <input type="text" id="aporte-desc" class="form-input" placeholder="Detalhes..." value="${aporte?.descricao || ''}">
                            </div>

                            <!-- Entities -->
                            <div style="display: flex; gap: 1rem;">
                                <div style="flex: 1;">
                                    <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Empresa *</label>
                                    <select id="aporte-company" class="form-input">
                                        <option value="">Selecione...</option>
                                        ${companies.map(c => `<option value="${c.id}" ${aporte?.company_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div style="flex: 1;">
                                    <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Conta *</label>
                                    <select id="aporte-account" class="form-input">
                                        <option value="">Selecione...</option>
                                        ${accounts.map(a => `<option value="${a.id}" ${aporte?.account_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                    </select>
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
                    const dataFato = modal.querySelector('#aporte-fato').value;
                    const dataReal = modal.querySelector('#aporte-real').value;
                    const valor = modal.querySelector('#aporte-valor').value;
                    const descricao = modal.querySelector('#aporte-desc').value;
                    const companyId = modal.querySelector('#aporte-company').value;
                    const accountId = modal.querySelector('#aporte-account').value;
                    const active = isEdit ? (modal.querySelector('#aporte-active').checked ? 1 : 0) : 1;

                    if (!dataFato || !valor || !companyId || !accountId) {
                        Dialogs.alert('Preencha os campos obrigatórios (*)', 'Erro de Validação');
                        return;
                    }

                    const data = {
                        dataFato,
                        dataReal: dataReal || null,
                        valor,
                        descricao,
                        companyId,
                        accountId,
                        active
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
