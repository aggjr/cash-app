import { getApiBaseUrl } from '../utils/apiConfig.js';
import { showToast } from '../utils/toast.js';
import { SharedTable } from './SharedTable.js';

export const GrupoModal = {
    show({ grupo = null, onSave, minimal = false }) {
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
                let allLeads = []; // For the table

                let grupoCaracteristicasIds = [];
                let grupoSubgruposIds = [];
                let grupoLeadsIds = [];

                // Fetch Dependencies Parallelly
                if (!minimal) {
                    try {
                        const [caracRes, gruposRes, leadsRes] = await Promise.all([
                            fetch(`${API_BASE_URL}/marketing/caracteristicas`, { headers: { 'Authorization': `Bearer ${token}` } }),
                            fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: { 'Authorization': `Bearer ${token}` } }),
                            fetch(`${API_BASE_URL}/marketing/leads`, { headers: { 'Authorization': `Bearer ${token}` } })
                        ]);

                        if (caracRes.ok) allCaracteristicas = await caracRes.json();
                        if (gruposRes.ok) allGrupos = await gruposRes.json();
                        if (leadsRes.ok) allLeads = await leadsRes.json();
                    } catch (error) {
                        console.error('Error loading dependencies:', error);
                        showToast('Erro ao carregar dados auxiliares', 'error');
                    }
                }

                if (isEdit && !minimal) {
                    try {
                        const fullGroupRes = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${grupo.id}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (fullGroupRes.ok) {
                            const fullGroup = await fullGroupRes.json();
                            if (fullGroup.caracteristicas) grupoCaracteristicasIds = fullGroup.caracteristicas;
                            if (fullGroup.subgrupos) grupoSubgruposIds = fullGroup.subgrupos;
                            if (fullGroup.leads) grupoLeadsIds = fullGroup.leads;
                        }

                    } catch (error) {
                        console.error('Error loading group details:', error);
                    }
                }

                // Filter available groups for Sub-groups (Exclude self)
                const availableSubgroups = (isEdit && !minimal)
                    ? allGrupos.filter(g => g.id !== grupo.id)
                    : allGrupos;


                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';
                overlay.style.zIndex = '1000';

                const modal = document.createElement('div');
                modal.className = 'account-modal animate-float-in';
                if (minimal) {
                    modal.style.maxWidth = '500px';
                    modal.style.width = '90%';
                    modal.style.height = 'auto'; // Auto height for minimal
                    modal.style.maxHeight = '90vh';
                } else {
                    modal.style.maxWidth = '1200px'; // Wide design for table
                    modal.style.width = '95%';
                    modal.style.height = '90vh';
                }
                modal.style.display = 'flex';
                modal.style.flexDirection = 'column';

                const idCaracList = 'list-caracteristicas';
                const idCaracSearch = 'search-caracteristicas';
                const idSubList = 'list-subgrupos';
                const idSubSearch = 'search-subgrupos';
                const idLeadsTable = 'container-leads-table';
                const idLeadsSearch = 'search-leads-table';

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
                            scrollbar-width: thin;
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
                    <div class="account-modal-body" style="padding: 1.5rem; overflow-y: auto; flex: 1;">
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

                            ${!minimal ? `
                                <!-- LEADS SECTION -->
                                <div class="form-group">
                                    <label>Leads Integrantes</label>
                                    <div style="background: white; border: 1px solid var(--color-border-light); border-radius: 8px; overflow: hidden; padding: 0.5rem; display: flex; flex-direction: column; height: 500px;">
                                        <div style="margin-bottom: 0.5rem;">
                                            <input type="text" id="${idLeadsSearch}" class="form-input" placeholder="🔍 Buscar Lead..." 
                                                style="padding: 0.5rem; font-size: 0.9rem; width: 100%;" />
                                        </div>
                                        <div id="${idLeadsTable}" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;"></div>
                                    </div>
                                    <small style="color: var(--color-text-muted); display: block; margin-top: 0.3rem;">
                                        Selecione os leads que farão parte deste grupo.
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label>Sub-grupos (Este grupo contém...)</label>
                                    ${renderSearchableListHtml(availableSubgroups, grupoSubgruposIds, idSubList, idSubSearch, 'Nenhum outro grupo disponível.')}
                                </div>

                                <div class="form-group">
                                    <label>Características (Critérios)</label>
                                    ${renderSearchableListHtml(allCaracteristicas, grupoCaracteristicasIds, idCaracList, idCaracSearch, 'Nenhuma característica cadastrada.')}
                                </div>
                            ` : ''}

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
                const leadsSearchInput = modal.querySelector(`#${idLeadsSearch}`);

                // Setup Search Logic for Lists (only if lists exist)
                const setupSearch = (searchId, listId) => {
                    const searchInput = modal.querySelector(`#${searchId}`);
                    const listContainer = modal.querySelector(`#${listId}`);
                    if (!searchInput || !listContainer) return;
                    // ... (rest is safe if elements found)
                    const items = listContainer.querySelectorAll('label.checkbox-item');
                    searchInput.addEventListener('input', (e) => {
                        const term = e.target.value.toLowerCase();
                        items.forEach(item => {
                            const name = item.querySelector('.item-name').textContent.toLowerCase();
                            item.style.display = name.includes(term) ? 'flex' : 'none';
                        });
                    });
                };

                // Initialize SharedTable
                let sharedTable = null;
                setTimeout(() => {
                    nomeInput.focus();
                    if (!minimal) {
                        setupSearch(idSubSearch, idSubList);
                        setupSearch(idCaracSearch, idCaracList);

                        // Setup Leads Table
                        const tableContainer = modal.querySelector(`#${idLeadsTable}`);
                        if (tableContainer) {

                            // 1. Transform Leads Data (Pivot) & Create Columns
                            const dynamicColumns = [
                                { key: 'nome', label: 'Nome', align: 'left', sticky: true, width: '200px' },
                                { key: 'telefone', label: 'Whatsapp', width: '130px', sticky: true },
                                { key: 'email', label: 'E-mail', width: '200px', sticky: true }
                            ];

                            // Add Characteristic Columns
                            allCaracteristicas.forEach(c => {
                                dynamicColumns.push({
                                    key: `char_${c.id}`,
                                    label: c.nome,
                                    width: '150px',
                                    type: 'text', // Enables filtering
                                    align: 'left'
                                });
                            });

                            // Process Leads
                            const processedLeads = allLeads.map(lead => {
                                const newLead = { ...lead };

                                // Parse JSON if available, otherwise fallback (though backend should send JSON now)
                                let chars = [];
                                if (lead.caracteristicas_json) {
                                    try {
                                        // Handle double-encoding if it happens, or direct array
                                        chars = typeof lead.caracteristicas_json === 'string'
                                            ? JSON.parse(lead.caracteristicas_json)
                                            : lead.caracteristicas_json;
                                    } catch (e) { console.error('Error parsing chars json', e); }
                                }

                                if (Array.isArray(chars)) {
                                    chars.forEach(c => {
                                        // c: { id, nome, valor }
                                        // Use 'valor' if present (Assigned Value), otherwise 'Sim' (if it's just a tag characteristic)
                                        // Actually, for lead-characteristic relation, it might just be existence, 
                                        // BUT the backend query `IF(cv.valor IS NOT NULL, ...)` suggests values exist.
                                        // Let's use value or 'Sim'.
                                        newLead[`char_${c.id}`] = c.valor || 'Sim'; // 'Sim' implies presence if no specific value
                                    });
                                }
                                return newLead;
                            });

                            sharedTable = new SharedTable({
                                container: tableContainer,
                                columns: dynamicColumns,
                                enableSelection: true,
                                footerRow: null // We use external summary now
                            });

                            // Set Initial Selection
                            sharedTable.selection = new Set(grupoLeadsIds);

                            // Initial Render
                            sharedTable.render(processedLeads);

                            // Search Logic for Leads (Updated to filter by flattened props too?)
                            // User wanted "Multiple filters in parallel". SharedTable `applyClientSideFilter` handles column-specific filters.
                            // The global search input below is properly for "Quick Search". 
                            // We can keep it or remove it. User asked for "Advanced filters". 
                            // SharedTable handles advanced column filters. 
                            // I will keep this search box as a "Global Text Search" across visible columns.

                            if (leadsSearchInput) {
                                leadsSearchInput.addEventListener('input', (e) => {
                                    const term = e.target.value.toLowerCase();
                                    const filtered = processedLeads.filter(l => {
                                        // Check fixed fields
                                        if (l.nome && l.nome.toLowerCase().includes(term)) return true;
                                        if (l.email && l.email.toLowerCase().includes(term)) return true;
                                        if (l.telefone && l.telefone.includes(term)) return true;

                                        // Check dynamic chars
                                        return allCaracteristicas.some(c => {
                                            const val = l[`char_${c.id}`];
                                            return val && String(val).toLowerCase().includes(term);
                                        });
                                    });
                                    sharedTable.render(filtered);
                                });
                            }
                        }
                    }
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

                    const selectedCaracs = minimal ? [] : Array.from(modal.querySelector(`#${idCaracList}`).querySelectorAll('input:checked'))
                        .map(cb => parseInt(cb.value));

                    const selectedSubgrupos = minimal ? [] : Array.from(modal.querySelector(`#${idSubList}`).querySelectorAll('input:checked'))
                        .map(cb => parseInt(cb.value));

                    const selectedLeads = sharedTable ? Array.from(sharedTable.selection) : [];

                    const grupoData = {
                        nome: nomeInput.value.trim(),
                        descricao: descricaoInput.value.trim() || null,
                        caracteristicas: selectedCaracs,
                        subgrupos: selectedSubgrupos,
                        leads: selectedLeads // Send leads array
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
