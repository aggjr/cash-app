import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

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

                modal.innerHTML = `
                    <div class="dialog-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="dialog-body">
                        <!-- Grid Layout matching DespesaModal (6 columns) -->
                        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem;">
                            
                            <!-- Row 1: Dates -->
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Data Fato *</label>
                                <input type="date" id="retirada-fato" class="form-input" 
                                    value="${formatDateForInput(retirada?.data_fato) || today}">
                            </div>
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Data Prevista *</label>
                                <input type="date" id="retirada-prevista" class="form-input" 
                                    value="${formatDateForInput(retirada?.data_prevista) || today}">
                            </div>
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Data Real</label>
                                <input type="date" id="retirada-real" class="form-input" 
                                    value="${formatDateForInput(retirada?.data_real)}">
                            </div>

                            <!-- Row 2: Entities & Value -->
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Empresa *</label>
                                <select id="retirada-company" class="form-input">
                                    <option value="">Selecione...</option>
                                    ${companies.map(c => `<option value="${c.id}" ${retirada?.company_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                </select>
                            </div>
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Conta *</label>
                                <select id="retirada-account" class="form-input">
                                    <option value="">Selecione...</option>
                                    ${accounts.map(a => `<option value="${a.id}" ${retirada?.account_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                                </select>
                            </div>
                            <div style="grid-column: span 2;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Valor (R$) *</label>
                                <input type="number" step="0.01" id="retirada-valor" class="form-input" placeholder="0.00" value="${retirada?.valor || ''}">
                            </div>

                            <!-- Row 3: Description (Full Span) -->
                            <div style="grid-column: span 6;">
                                <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Descrição</label>
                                <textarea id="retirada-desc" class="form-input" placeholder="Detalhes..." style="resize:none; height:100px;">${retirada?.descricao || ''}</textarea>
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
                    const valor = modal.querySelector('#retirada-valor').value;
                    const descricao = modal.querySelector('#retirada-desc').value;
                    const companyId = modal.querySelector('#retirada-company').value;
                    const accountId = modal.querySelector('#retirada-account').value;
                    const active = isEdit ? (modal.querySelector('#retirada-active').checked ? 1 : 0) : 1;

                    if (!dataFato || !dataPrevista || !valor || !companyId || !accountId) {
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
