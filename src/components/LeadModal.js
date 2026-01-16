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

            // --- State for Characteristics & Values ---
            let selectedCharValues = {}; // Map: charId -> valorId
            if (lead?.caracteristicas_detalhadas) {
                lead.caracteristicas_detalhadas.forEach(c => {
                    selectedCharValues[c.id] = c.valor_id;
                });
            } else if (lead?.caracteristicas) {
                // Legacy support or fallback: just IDs implies no values
                // lead.caracteristicas is array of IDs [1, 2]
                if (Array.isArray(lead.caracteristicas)) {
                    lead.caracteristicas.forEach(id => {
                        if (!selectedCharValues[id]) selectedCharValues[id] = null;
                    });
                }
            }

            let activeCharId = null; // Currently selected char to show values for
            let valuesCache = {}; // charId -> [values]

            // --- UI Helpers ---
            // Re-use standard renderer for Groups
            const renderGenericList = (items, selectedIds, listId, searchId) => `
                <div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border-light); border-radius: 6px; padding: 0.75rem;">
                    <div style="margin-bottom: 0.5rem;">
                        <input type="text" id="${searchId}" class="form-input" placeholder="🔍 Buscar..." 
                            style="padding: 0.4rem 0.5rem; font-size: 0.9rem; margin-bottom: 0; width: 100%; border: 1px solid var(--color-border-light);" />
                    </div>
                    <div id="${listId}" style="max-height: 150px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.25rem;">
                        ${items.map(item => `
                            <label class="checkbox-item" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.25rem;">
                                <input type="checkbox" value="${item.id}" ${selectedIds.includes(item.id) ? 'checked' : ''} style="accent-color: var(--color-primary);">
                                <span class="item-name" style="font-size: 0.9rem;" title="${item.nome}">${item.nome}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 1.5rem; max-height: 80vh; overflow-y: auto;">
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
                             ${renderGenericList(grupos, leadGruposIds, idGruposList, idGruposSearch)}
                        </div>

                        <!-- CHARACTERISTICS & VALUES SPLIT VIEW -->
                        <div class="form-group">
                             <label>Características e Valores</label>
                             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; height: 250px;">
                                
                                <!-- Left: Characteristics List -->
                                <div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border-light); border-radius: 6px; padding: 0.75rem; display: flex; flex-direction: column;">
                                    <input type="text" id="${idCaracSearch}" class="form-input" placeholder="🔍 Buscar Característica..." 
                                        style="font-size: 0.9rem; margin-bottom: 0.5rem; padding: 0.4rem;" />
                                    
                                    <div id="${idCaracList}" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.25rem;">
                                        <!-- Items injected here -->
                                    </div>
                                </div>

                                <!-- Right: Values List -->
                                <div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border-light); border-radius: 6px; padding: 0.75rem; display: flex; flex-direction: column;">
                                    <div id="values-header" style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--color-text-secondary); height: 32px; display: flex; align-items: center;">
                                        Selecione uma característica
                                    </div>
                                    
                                    <div id="values-list-container" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.25rem;">
                                        <p class="text-muted" style="font-size: 0.85rem; margin-top: 1rem; text-align: center;">Valores aparecerão aqui.</p>
                                    </div>
                                </div>

                             </div>
                        </div>

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
            const nomeInputRef = modal.querySelector('#lead-nome');
            const emailInputRef = modal.querySelector('#lead-email');
            const telefoneInputRef = modal.querySelector('#lead-telefone');
            const observacoesInputRef = modal.querySelector('#lead-observacoes');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');

            const caracListEl = modal.querySelector(`#${idCaracList}`);
            const valuesListEl = modal.querySelector('#values-list-container');
            const valuesHeaderEl = modal.querySelector('#values-header');
            const caracSearchEl = modal.querySelector(`#${idCaracSearch}`);

            // --- Logic for Characteristics/Values ---

            const renderValues = (charId, values) => {
                valuesListEl.innerHTML = '';
                if (!values || values.length === 0) {
                    valuesListEl.innerHTML = '<p class="text-muted" style="font-size: 0.85rem;">Esta característica não possui valores definidos.</p>';
                    return;
                }

                // Selected Value ID for this char
                const currentVal = selectedCharValues[charId];

                values.forEach(val => {
                    const row = document.createElement('label');
                    row.className = 'checkbox-item'; // Reuse style
                    row.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.35rem; border-radius: 4px; font-size: 0.9rem;';
                    row.onmouseover = () => row.style.backgroundColor = 'rgba(0,0,0,0.05)';
                    row.onmouseout = () => row.style.backgroundColor = 'transparent';

                    const input = document.createElement('input');
                    input.type = 'radio';
                    input.name = `values-group-${charId}`; // Group by char so only one value per char
                    input.value = val.id;
                    input.style.accentColor = 'var(--color-primary)';
                    if (currentVal == val.id) input.checked = true;

                    input.onchange = () => {
                        selectedCharValues[charId] = parseInt(val.id);
                    };

                    const span = document.createElement('span');
                    span.textContent = val.valor;

                    row.appendChild(input);
                    row.appendChild(span);
                    valuesListEl.appendChild(row);
                });
            };

            const loadValues = async (charId, charName) => {
                activeCharId = charId;
                valuesHeaderEl.textContent = `Valores para: ${charName}`;
                valuesListEl.innerHTML = '<p class="text-muted" style="font-size: 0.85rem;">Carregando...</p>';

                if (valuesCache[charId]) {
                    renderValues(charId, valuesCache[charId]);
                    return;
                }

                try {
                    const res = await fetch(`${API_BASE_URL}/marketing/caracteristicas/${charId}/valores`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const values = await res.json();
                        valuesCache[charId] = values;
                        renderValues(charId, values);
                    } else {
                        valuesListEl.innerHTML = '<p class="text-muted">Erro ao carregar valores.</p>';
                    }
                } catch (e) {
                    console.error(e);
                    valuesListEl.innerHTML = '<p class="text-muted">Erro ao carregar valores.</p>';
                }
            };

            const renderCharacteristics = (filter = '') => {
                caracListEl.innerHTML = '';
                const term = filter.toLowerCase();

                caracteristicas.forEach(c => {
                    if (term && !c.nome.toLowerCase().includes(term)) return;

                    const row = document.createElement('div');
                    row.style.cssText = `
                        display: flex; align-items: center; justify-content: space-between; 
                        padding: 0.4rem; border-radius: 4px; cursor: pointer; transition: background 0.1s;
                        border: 1px solid transparent;
                    `;

                    // Highlight selected row based on activeCharId
                    if (activeCharId === c.id) {
                        row.style.backgroundColor = 'var(--color-bg-hover)';
                        row.style.borderColor = 'var(--color-primary)';
                    } else {
                        row.onmouseover = () => row.style.backgroundColor = 'rgba(0,0,0,0.03)';
                        row.onmouseout = () => {
                            if (activeCharId !== c.id) row.style.backgroundColor = 'transparent';
                        };
                    }

                    // Checkbox part
                    const label = document.createElement('label');
                    label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; cursor: pointer; flex: 1;';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = c.id;
                    checkbox.style.accentColor = 'var(--color-primary)';
                    if (selectedCharValues.hasOwnProperty(c.id)) checkbox.checked = true;

                    checkbox.onclick = (e) => {
                        e.stopPropagation(); // Prevent row click trigger duplicate?
                        // If checking, add to map. If unchecking, remove.
                        if (checkbox.checked) {
                            if (!selectedCharValues.hasOwnProperty(c.id)) selectedCharValues[c.id] = null;
                            // Also select row to show values
                            loadValues(c.id, c.nome);
                            renderCharacteristics(filter); // Re-render to highlight row
                        } else {
                            delete selectedCharValues[c.id];
                            // If this was active row, maybe clear right panel? Or keep it.
                            // Keep it is less jarring.
                        }
                    };

                    const text = document.createElement('span');
                    text.textContent = c.nome;
                    text.style.fontSize = '0.9rem';

                    label.appendChild(checkbox);
                    label.appendChild(text);

                    // If has selected value, show small indicator?
                    // Optional.

                    row.appendChild(label);

                    // Row click -> Load values (if user clicks on text/empty space, not updates checkbox state directly unless checkbox logic handles it)
                    // Let's make entire row click select the ITEM for viewing values, but only checkbox toggles inclusion.
                    row.onclick = (e) => {
                        if (e.target === checkbox) return; // Handled by checkbox
                        loadValues(c.id, c.nome);
                        renderCharacteristics(filter); // Re-render highlights
                    };

                    caracListEl.appendChild(row);
                });
            };

            // Initial Render
            renderCharacteristics();

            // Search listener
            caracSearchEl.addEventListener('input', (e) => renderCharacteristics(e.target.value));

            // Setup Group Search (Simple)
            setTimeout(() => {
                const grpSearch = modal.querySelector(`#${idGruposSearch}`);
                const grpList = modal.querySelector(`#${idGruposList}`);
                if (grpSearch && grpList) {
                    grpSearch.addEventListener('input', (e) => {
                        const t = e.target.value.toLowerCase();
                        grpList.querySelectorAll('label').forEach(l => {
                            l.style.display = l.textContent.toLowerCase().includes(t) ? 'flex' : 'none';
                        });
                    });
                }
                nomeInputRef.focus();
            }, 100);

            // --- Footer Actions ---
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

                const selectedGrupos = Array.from(modal.querySelector(`#${idGruposList}`).querySelectorAll('input:checked'))
                    .map(cb => parseInt(cb.value));

                // Construct Caracteristicas Array
                // Map: { 1: 5, 2: null } -> [{id: 1, valor_id: 5}, {id: 2, valor_id: null}]
                const finalCaracteristicas = Object.keys(selectedCharValues).map(charId => ({
                    id: parseInt(charId),
                    valor_id: selectedCharValues[charId] || null
                }));

                const data = {
                    nome: nomeInputRef.value.trim(),
                    email: emailInputRef.value.trim() || null,
                    telefone: telefoneInputRef.value.trim() || null,
                    observacoes: observacoesInputRef.value.trim() || null,
                    grupos: selectedGrupos,
                    caracteristicas: finalCaracteristicas
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
