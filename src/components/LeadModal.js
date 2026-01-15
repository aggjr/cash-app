import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const LeadModal = {
    show({ lead = null, onSave }) {
        return new Promise(async (resolve) => {
            const API_BASE_URL = getApiBaseUrl();
            let container = document.getElementById('custom-dialog-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'custom-dialog-container';
                document.body.appendChild(container);
            }

            const token = localStorage.getItem('token');
            const isEdit = lead !== null;

            // Data storage
            let grupos = [];
            let caracteristicas = [];

            // Pre-selected values
            const leadGruposIds = lead?.grupos ? (Array.isArray(lead.grupos) ? lead.grupos : []) : [];
            const leadCaracteristicasIds = lead?.caracteristicas ? (Array.isArray(lead.caracteristicas) ? lead.caracteristicas : []) : [];

            // Fetch Dependencies Parallelly
            try {
                const [gruposRes, caracRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/marketing/caracteristicas`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);

                if (gruposRes.ok) grupos = await gruposRes.json();
                if (caracRes.ok) caracteristicas = await caracRes.json();

            } catch (error) {
                console.error('Error loading dependencies:', error);
                showToast('Erro ao carregar dados auxiliares', 'error');
            }

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '1000';

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';
            // Make it wider to accommodate multiple lists? Or stacked? Stacked is fine.
            modal.style.maxWidth = '700px';
            modal.style.width = '95%';

            const renderCheckboxList = (items, selectedIds, label) => `
                <div class="form-group">
                    <label>${label}</label>
                    <div style="
                        max-height: 150px; 
                        overflow-y: auto; 
                        border: 1px solid var(--color-border-light); 
                        border-radius: 6px; 
                        padding: 0.5rem;
                        background: var(--color-bg-secondary);
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                        gap: 0.5rem;
                    ">
                        ${items.length > 0 ? items.map(item => `
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                                <input type="checkbox" value="${item.id}" 
                                    ${selectedIds.includes(item.id) ? 'checked' : ''} 
                                    style="width: 16px; height: 16px; accent-color: var(--color-primary);">
                                <span>${item.nome}</span>
                            </label>
                        `).join('') : '<p style="color: var(--color-text-muted); font-size: 0.85rem; padding: 0.5rem;">Nenhum item disponível.</p>'}
                    </div>
                </div>
            `;

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 1.5rem;">
                    <h3 style="margin: 0 0 1.5rem 0; color: var(--color-primary); font-size: 1.25rem;">
                        ${isEdit ? '✏️ Editar Lead' : '🎯 Novo Lead'}
                    </h3>
                    
                    <div class="form-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label for="lead-nome">Nome <span class="required">*</span></label>
                                <input type="text" id="lead-nome" class="form-input" 
                                    value="${lead?.nome || ''}" placeholder="Nome do lead" required />
                            </div>
                            <div class="form-group">
                                <label for="lead-telefone">Telefone</label>
                                <input type="text" id="lead-telefone" class="form-input" 
                                    value="${lead?.telefone || ''}" placeholder="(00) 00000-0000" />
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="lead-email">E-mail</label>
                            <input type="email" id="lead-email" class="form-input" 
                                value="${lead?.email || ''}" placeholder="email@exemplo.com" />
                        </div>

                        ${renderCheckboxList(grupos, leadGruposIds, 'Grupos de Interesse')}

                        ${renderCheckboxList(caracteristicas, leadCaracteristicasIds, 'Características')}

                        <div class="form-group">
                            <label for="lead-observacoes">Observações</label>
                            <textarea id="lead-observacoes" class="form-input" rows="2" 
                                placeholder="Anotações sobre o lead...">${lead?.observacoes || ''}</textarea>
                        </div>

                    </div>
                </div>
                
                <div class="account-modal-footer" style="padding: 1rem; border-top: 1px solid var(--color-border-light);">
                    <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                    <button class="btn-primary" id="modal-save" type="button">
                        ${isEdit ? 'Salvar Alterações' : 'Criar Lead'}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            // Elements
            const nomeInput = modal.querySelector('#lead-nome');
            const emailInput = modal.querySelector('#lead-email');
            const telefoneInput = modal.querySelector('#lead-telefone');
            const observacoesInput = modal.querySelector('#lead-observacoes');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');

            // Helper to get checked items from a specific container (we need to target correct lists)
            // But strict selectors might be tricky since lists are generated in HTML string.
            // Let's rely on iterating form groups or querying by structure?
            // Safer: Add IDs to the checkbox containers in `renderCheckboxList`.
            // Re-rendering HTML with IDs.

            // Re-render HTML above with IDs (I'll do it dynamically via replace or logic update before appending, but easier to just use querySelectorAll on whole modal for specific values)
            // Wait, values are unique IDs across different tables (grupos ids vs caracteristicas ids).
            // But an ID 1 might exist in both tables! Risks collision if I just select all checkboxes.
            // I MUST scope them.

            // Retrying renderCheckboxList with ID support
            const idGrupos = 'list-grupos';
            const idCaracteristicas = 'list-caracteristicas';

            // Logic to reinject HTML with IDs:
            const listGruposHTML = renderCheckboxList(grupos, leadGruposIds, 'Grupos de Interesse').replace('<div style="', `<div id="${idGrupos}" style="`);
            const listCaracHTML = renderCheckboxList(caracteristicas, leadCaracteristicasIds, 'Características').replace('<div style="', `<div id="${idCaracteristicas}" style="`);

            modal.querySelector('.form-grid').innerHTML = `
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label for="lead-nome">Nome <span class="required">*</span></label>
                                <input type="text" id="lead-nome" class="form-input" 
                                    value="${lead?.nome || ''}" placeholder="Nome do lead" required />
                            </div>
                            <div class="form-group">
                                <label for="lead-telefone">Telefone</label>
                                <input type="text" id="lead-telefone" class="form-input" 
                                    value="${lead?.telefone || ''}" placeholder="(00) 00000-0000" />
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="lead-email">E-mail</label>
                            <input type="email" id="lead-email" class="form-input" 
                                value="${lead?.email || ''}" placeholder="email@exemplo.com" />
                        </div>

                        <div class="form-group">
                             <label>Grupos de Interesse</label>
                             <div id="${idGrupos}" style="
                                max-height: 150px; 
                                overflow-y: auto; 
                                border: 1px solid var(--color-border-light); 
                                border-radius: 6px; 
                                padding: 0.5rem;
                                background: var(--color-bg-secondary);
                                display: grid;
                                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                                gap: 0.5rem;
                            ">
                                ${grupos.length > 0 ? grupos.map(item => `
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                                        <input type="checkbox" value="${item.id}" 
                                            ${leadGruposIds.includes(item.id) ? 'checked' : ''} 
                                            style="width: 16px; height: 16px; accent-color: var(--color-primary);">
                                        <span>${item.nome}</span>
                                    </label>
                                `).join('') : '<p style="color: var(--color-text-muted); font-size: 0.85rem; padding: 0.5rem;">Nenhum grupo disponível.</p>'}
                            </div>
                        </div>

                        <div class="form-group">
                             <label>Características</label>
                             <div id="${idCaracteristicas}" style="
                                max-height: 150px; 
                                overflow-y: auto; 
                                border: 1px solid var(--color-border-light); 
                                border-radius: 6px; 
                                padding: 0.5rem;
                                background: var(--color-bg-secondary);
                                display: grid;
                                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                                gap: 0.5rem;
                            ">
                                ${caracteristicas.length > 0 ? caracteristicas.map(item => `
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                                        <input type="checkbox" value="${item.id}" 
                                            ${leadCaracteristicasIds.includes(item.id) ? 'checked' : ''} 
                                            style="width: 16px; height: 16px; accent-color: var(--color-primary);">
                                        <span>${item.nome}</span>
                                    </label>
                                `).join('') : '<p style="color: var(--color-text-muted); font-size: 0.85rem; padding: 0.5rem;">Nenhuma característica disponível.</p>'}
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="lead-observacoes">Observações</label>
                            <textarea id="lead-observacoes" class="form-input" rows="2" 
                                placeholder="Anotações sobre o lead...">${lead?.observacoes || ''}</textarea>
                        </div>
            `;

            // Refetch inputs after innerHTML rewrite
            const nomeInputRef = modal.querySelector('#lead-nome');
            const emailInputRef = modal.querySelector('#lead-email');
            const telefoneInputRef = modal.querySelector('#lead-telefone');
            const observacoesInputRef = modal.querySelector('#lead-observacoes');


            setTimeout(() => nomeInputRef.focus(), 100);

            const close = () => {
                const parent = overlay.parentNode;
                if (parent) parent.removeChild(overlay);
                resolve(null);
            };

            cancelBtn.onclick = close;
            overlay.onclick = (e) => { if (e.target === overlay) close(); };

            saveBtn.onclick = async () => {
                if (!nomeInputRef.value.trim()) {
                    nomeInputRef.classList.add('input-error');
                    showToast('O nome é obrigatório', 'warning');
                    return;
                }

                // Collect Checkboxes
                const selectedGrupos = Array.from(modal.querySelector(`#${idGrupos}`).querySelectorAll('input:checked'))
                    .map(cb => parseInt(cb.value));

                const selectedCaracteristicas = Array.from(modal.querySelector(`#${idCaracteristicas}`).querySelectorAll('input:checked'))
                    .map(cb => parseInt(cb.value));

                const data = {
                    nome: nomeInputRef.value.trim(),
                    email: emailInputRef.value.trim() || null,
                    telefone: telefoneInputRef.value.trim() || null,
                    observacoes: observacoesInputRef.value.trim() || null,
                    grupos: selectedGrupos,
                    caracteristicas: selectedCaracteristicas
                };

                saveBtn.disabled = true;
                saveBtn.textContent = 'Salvando...';

                try {
                    await onSave(data);
                    close();
                    resolve(true);
                } catch (error) {
                    console.error(error);
                    showToast(error.message || 'Erro ao salvar', 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Lead';
                }
            };
        });
    }
};
