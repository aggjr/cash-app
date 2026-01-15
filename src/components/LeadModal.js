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

            // Component IDs
            const idGruposList = 'list-grupos';
            const idGruposSearch = 'search-grupos';
            const idCaracList = 'list-caracteristicas';
            const idCaracSearch = 'search-caracteristicas';

            const renderSearchableListHtml = (items, selectedIds, listId, searchId) => `
                <div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border-light); border-radius: 6px; padding: 0.75rem;">
                    <div style="margin-bottom: 0.5rem; position: relative;">
                        <input type="text" id="${searchId}" class="form-input" placeholder="🔍 Buscar..." 
                            style="padding: 0.4rem 0.5rem; font-size: 0.9rem; margin-bottom: 0; width: 100%; border: 1px solid var(--color-border-light);" />
                    </div>
                    <div id="${listId}" style="
                        max-height: 150px; 
                        overflow-y: auto; 
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                        gap: 0.25rem;
                        padding-right: 0.25rem;
                    ">
                        ${items.length > 0 ? items.map(item => `
                            <label class="checkbox-item" style="
                                display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;
                                padding: 0.25rem; border-radius: 4px; transition: background 0.1s;
                            " onmouseover="this.style.backgroundColor='rgba(0,0,0,0.05)'" onmouseout="this.style.backgroundColor='transparent'">
                                <input type="checkbox" value="${item.id}" 
                                    ${selectedIds.includes(item.id) ? 'checked' : ''} 
                                    style="width: 16px; height: 16px; accent-color: var(--color-primary); flex-shrink: 0;">
                                <span class="item-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.nome}">${item.nome}</span>
                            </label>
                        `).join('') : '<p style="color: var(--color-text-muted); font-size: 0.85rem;">Nenhum item disponível.</p>'}
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

                        <div class="form-group">
                             <label>Grupos de Interesse</label>
                             ${renderSearchableListHtml(grupos, leadGruposIds, idGruposList, idGruposSearch)}
                        </div>

                        <div class="form-group">
                             <label>Características</label>
                             ${renderSearchableListHtml(caracteristicas, leadCaracteristicasIds, idCaracList, idCaracSearch)}
                        </div>

                        <div class="form-group">
                            <label for="lead-observacoes">Observações</label>
                            <textarea id="lead-observacoes" class="form-input" rows="2" 
                                placeholder="Anotações sobre o lead...">${lead?.observacoes || ''}</textarea>
                        </div>
            `;

            // Add Footer logic (separate block to keep innerHTML clean logic)
            modal.innerHTML += `
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

            // Fetch elements
            const nomeInputRef = modal.querySelector('#lead-nome');
            const emailInputRef = modal.querySelector('#lead-email');
            const telefoneInputRef = modal.querySelector('#lead-telefone');
            const observacoesInputRef = modal.querySelector('#lead-observacoes');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');

            // --- Enable Search Logic ---
            const setupSearch = (searchId, listId) => {
                const searchInput = modal.querySelector(`#${searchId}`);
                const listContainer = modal.querySelector(`#${listId}`);
                if (!searchInput || !listContainer) return;

                const items = listContainer.querySelectorAll('label.checkbox-item');

                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    items.forEach(item => {
                        const name = item.querySelector('.item-name').textContent.toLowerCase();
                        if (name.includes(term)) {
                            item.style.display = 'flex';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                });
            };

            setTimeout(() => {
                nomeInputRef.focus();
                setupSearch(idGruposSearch, idGruposList);
                setupSearch(idCaracSearch, idCaracList);
            }, 100);

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

                // Collect Checkboxes (Note: we must collect ALL checked boxes, even if hidden by filter!
                // querySelectorAll works on all descendants regardless of visibility style usually, unless using :visible)
                // 'input:checked' gets checked elements even if display none.

                const selectedGrupos = Array.from(modal.querySelector(`#${idGruposList}`).querySelectorAll('input:checked'))
                    .map(cb => parseInt(cb.value));

                const selectedCaracteristicas = Array.from(modal.querySelector(`#${idCaracList}`).querySelectorAll('input:checked'))
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
