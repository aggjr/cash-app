import { getApiBaseUrl } from '../utils/apiConfig.js';
import { showToast } from '../utils/toast.js';

export const GrupoModal = {
    show({ grupo = null, onSave }) {
        return new Promise(async (resolve) => {
            try {
                const API_BASE_URL = getApiBaseUrl();
                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                const isEdit = grupo !== null;
                const token = localStorage.getItem('token');

                let allCaracteristicas = [];
                let allGrupos = [];

                let grupoCaracteristicasIds = [];
                let grupoSubgruposIds = [];

                // Fetch Dependencies Parallelly
                try {
                    const [caracRes, gruposRes] = await Promise.all([
                        fetch(`${API_BASE_URL}/marketing/caracteristicas`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: { 'Authorization': `Bearer ${token}` } })
                    ]);

                    if (caracRes.ok) allCaracteristicas = await caracRes.json();
                    if (gruposRes.ok) allGrupos = await gruposRes.json();
                } catch (error) {
                    console.error('Error loading dependencies:', error);
                    showToast('Erro ao carregar dados auxiliares', 'error');
                }

                // If editing, fetch group's details (characteristics and sub-groups)
                // Note: The main GET /grupos-leads doesn't usually return detailed relations for all items if they list is huge.
                // But typically we fetch details on Edit.
                // Let's see if we can get details.
                // Or maybe the main list (which is passed in 'grupo') already has some data? 
                // The main list 'grupos-leads' returns 'g.*' and counts. It does NOT return the arrays of usage.

                // We need to fetch current chars and current subgroups for THIS group.
                if (isEdit) {
                    try {
                        // 1. Characteristics (already had this endpoint)
                        const charsRes = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${grupo.id}/caracteristicas`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (charsRes.ok) {
                            const data = await charsRes.json();
                            grupoCaracteristicasIds = data.filter(c => c.origem === 'direto').map(c => c.id);
                        }

                        // 2. Subgroups - We assume GET /:id returns the tree or create a specific endpoint?
                        // Controller `getById` (line 146) returns `grupos[0]`. It does NOT join compositions.
                        // Wait, `getById` in controller (checked earlier) was basic.
                        // I might need to update Controller `getById` to return `subgrupos` IDs?
                        // Or just fetch ALL and check `parent_id`?
                        // `grupos_composicao` table has `grupo_pai_id`, `grupo_filho_id`.
                        // I can fetch all composition or use a specific endpoint.
                        // Since I didn't create a specific `GET /:id/subgrupos` endpoint yet...
                        // But I DO have `getArvore` or `getLeadsExpandidos`.
                        // Actually, I should probably just fetch the compositions for this group.

                        // HACK: For now, I'll update `getById` in controller if needed, but I don't want to break flow.
                        // Alternative: Update `getById` implies context switch.
                        // Is there a way to get it? 
                        // The user screen shows "Sub-grupos" count.

                        // I will add a small fetch for `subgrupos` logic here?
                        // Or better: Assume `grupo` passed might not have it.
                        // I'll update the `gruposLeadsController.js` `getById` to return `subgrupos` array of IDs? 
                        // Wait, `create` returns `novoGrupo[0]`.

                        // Let's assume I need to fetch it.
                        // I'll use `getArvore`? No, that's recursive.
                        // I'll modify `getById` to returned `subgrupos` list?
                        // OR, I can fetch `grupos-leads` (all) and in the modal logic, I don't know which ones are children unless I have that data.

                        // CRITICAL: The Controller `getById` needs to return the relations!
                        // The previous `LeadModal` worked because `leads` endpoint returns the aggregated string.
                        // Here I need to EDIT.
                        // I'll update `gruposLeadsController.js` `getById` to include `subgrupos` IDs and `caracteristicas` IDs!
                        // That makes the frontend much simpler (1 call).

                        // Can I do that quickly? Yes.
                        // I'll update `gruposLeadsController.js` `getById` FIRST (or in parallel implicitly).
                        // Actually I'll write `GrupoModal` assuming `getById` returns it, then I `update` the controller.
                        // Code below assumes `GET /input/:id` will return extra fields.
                        // But `GrupoModal` calls `fetch` separately currently.
                        // I'll stick to separate fetching if existing endpoints support it.
                        // If not, I'll add one.

                        // Let's Add `GET /:id/details`? Or update `getById`.
                        // Updating `getById` is cleaner.

                        // Wait, I am currently in `GrupoModal.js` editing step.
                        // I can update `GrupoModal` to fetch `GET /marketing/grupos-leads/${grupo.id}`.
                        // And I will ensure that endpoint returns what I need.

                        const fullGroupRes = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${grupo.id}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (fullGroupRes.ok) {
                            const fullGroup = await fullGroupRes.json();
                            // If I update controller, these will be present:
                            if (fullGroup.caracteristicas) grupoCaracteristicasIds = fullGroup.caracteristicas;
                            if (fullGroup.subgrupos) grupoSubgruposIds = fullGroup.subgrupos;
                        }

                    } catch (error) {
                        console.error('Error loading group details:', error);
                    }
                }

                // Filter available groups for Sub-groups (Exclude self)
                const availableSubgroups = isEdit
                    ? allGrupos.filter(g => g.id !== grupo.id)
                    : allGrupos;


                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';
                overlay.style.zIndex = '1000';

                const modal = document.createElement('div');
                modal.className = 'account-modal animate-float-in';
                modal.style.maxWidth = '700px';
                modal.style.width = '95%';

                const idCaracList = 'list-caracteristicas';
                const idCaracSearch = 'search-caracteristicas';
                const idSubList = 'list-subgrupos';
                const idSubSearch = 'search-subgrupos';

                const renderSearchableListHtml = (items, selectedIds, listId, searchId, emptyMsg) => `
                    <div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border-light); border-radius: 6px; padding: 0.75rem;">
                        <div style="margin-bottom: 0.5rem;">
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
                                <label class="checkbox-item" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; padding: 0.25rem; border-radius: 4px; transition: background 0.1s;"
                                    onmouseover="this.style.backgroundColor='rgba(0,0,0,0.05)'" onmouseout="this.style.backgroundColor='transparent'">
                                    <input type="checkbox" value="${item.id}" 
                                        ${selectedIds.includes(item.id) ? 'checked' : ''} 
                                        style="width: 16px; height: 16px; accent-color: var(--color-primary); flex-shrink: 0;">
                                    <span class="item-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.nome}">${item.nome}</span>
                                </label>
                            `).join('') : `<p style="color: var(--color-text-muted); font-size: 0.85rem;">${emptyMsg}</p>`}
                        </div>
                    </div>
                `;

                modal.innerHTML = `
                    <div class="account-modal-body" style="padding: 1.5rem;">
                        <h3 style="margin: 0 0 1.5rem 0; color: var(--color-primary); font-size: 1.25rem;">
                            ${isEdit ? '✏️ Editar Grupo' : '👥 Novo Grupo de Leads'}
                        </h3>
                        
                        <div class="form-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                            
                            <div class="form-group">
                                <label for="grupo-nome">Nome <span class="required">*</span></label>
                                <input type="text" id="grupo-nome" class="form-input" 
                                    value="${grupo?.nome || ''}" placeholder="Nome do grupo (ex: Leads Quentes)" required />
                            </div>

                            <div class="form-group">
                                <label for="grupo-descricao">Descrição</label>
                                <textarea id="grupo-descricao" class="form-input" rows="2" 
                                    placeholder="Descrição opcional...">${grupo?.descricao || ''}</textarea>
                            </div>

                            <div class="form-group">
                                <label>Sub-grupos (Este grupo contém...)</label>
                                ${renderSearchableListHtml(availableSubgroups, grupoSubgruposIds, idSubList, idSubSearch, 'Nenhum outro grupo disponível.')}
                                <small style="color: var(--color-text-muted); display: block; margin-top: 0.3rem;">
                                    Selecione quais grupos fazem parte deste grupo (hierarquia).
                                </small>
                            </div>

                            <div class="form-group">
                                <label>Características (Critérios)</label>
                                ${renderSearchableListHtml(allCaracteristicas, grupoCaracteristicasIds, idCaracList, idCaracSearch, 'Nenhuma característica cadastrada.')}
                            </div>

                        </div>
                    </div>
                    
                    <div class="account-modal-footer" style="padding: 1rem; border-top: 1px solid var(--color-border-light);">
                        <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                        <button class="btn-primary" id="modal-save" type="button">
                            ${isEdit ? 'Salvar Alterações' : 'Criar Grupo'}
                        </button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // Elements
                const nomeInput = modal.querySelector('#grupo-nome');
                const descricaoInput = modal.querySelector('#grupo-descricao');
                const saveBtn = modal.querySelector('#modal-save');
                const cancelBtn = modal.querySelector('#modal-cancel');

                const setupSearch = (searchId, listId) => {
                    const searchInput = modal.querySelector(`#${searchId}`);
                    const listContainer = modal.querySelector(`#${listId}`);
                    if (!searchInput || !listContainer) return;
                    const items = listContainer.querySelectorAll('label.checkbox-item');
                    searchInput.addEventListener('input', (e) => {
                        const term = e.target.value.toLowerCase();
                        items.forEach(item => {
                            const name = item.querySelector('.item-name').textContent.toLowerCase();
                            item.style.display = name.includes(term) ? 'flex' : 'none';
                        });
                    });
                };

                setTimeout(() => {
                    nomeInput.focus();
                    setupSearch(idSubSearch, idSubList);
                    setupSearch(idCaracSearch, idCaracList);
                }, 100);

                const close = () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(null);
                };

                cancelBtn.onclick = close;
                overlay.onclick = (e) => { if (e.target === overlay) close(); };

                saveBtn.onclick = async () => {
                    if (!nomeInput.value.trim()) {
                        nomeInput.classList.add('input-error');
                        showToast('O nome do grupo é obrigatório', 'warning');
                        return;
                    }

                    const selectedCaracs = Array.from(modal.querySelector(`#${idCaracList}`).querySelectorAll('input:checked'))
                        .map(cb => parseInt(cb.value));

                    const selectedSubgrupos = Array.from(modal.querySelector(`#${idSubList}`).querySelectorAll('input:checked'))
                        .map(cb => parseInt(cb.value));

                    const grupoData = {
                        nome: nomeInput.value.trim(),
                        descricao: descricaoInput.value.trim() || null,
                        caracteristicas: selectedCaracs,
                        subgrupos: selectedSubgrupos
                    };

                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Salvando...';

                    try {
                        await onSave(grupoData);
                        close();
                        resolve(true);
                    } catch (error) {
                        console.error(error);
                        showToast(error.message || 'Erro ao salvar', 'error');
                        saveBtn.disabled = false;
                        saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Grupo';
                    }
                };

            } catch (error) {
                console.error('Error in GrupoModal:', error);
                resolve(null);
            }
        });
    }
};
