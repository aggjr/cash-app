import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const LeadModal = {
    show: async ({ lead = null, grupos = [], caracteristicas = [], onSave }) => {
        return new Promise((resolve) => {
            const API_BASE_URL = getApiBaseUrl();
            const token = localStorage.getItem('token');
            const isEdit = !!lead;

            // IDs for elements
            const idGruposList = `grupos-list-${Date.now()}`;
            const idGruposSearch = `grupos-search-${Date.now()}`;
            const idCaracList = `caracs-list-${Date.now()}`;
            const idCaracSearch = `caracs-search-${Date.now()}`;

            // State
            const leadGruposIds = lead?.grupos || [];
            const selectedCharacteristics = new Set(); // IDs of checked characteristics
            const selectedCharValues = {}; // { charId: valueId }
            let activeCharId = null; // Currently selected char to show values
            let valuesCache = {}; // charId -> [values]

            // Initialize selected characteristics and values
            if (lead?.caracteristicas_detalhadas) {
                lead.caracteristicas_detalhadas.forEach(c => {
                    selectedCharacteristics.add(c.id);
                    selectedCharValues[c.id] = c.valor_id;
                });
            } else if (lead?.caracteristicas) {
                if (Array.isArray(lead.caracteristicas)) {
                    lead.caracteristicas.forEach(id => {
                        selectedCharacteristics.add(id);
                        if (!selectedCharValues[id]) selectedCharValues[id] = null;
                    });
                }
            }

            // --- UI Helpers ---
            // Zebra-striped checkbox list for Groups
            const renderZebraList = (items, selectedIds, listId, searchId) => `
                <div style="background: white; border: 1px solid var(--color-border-light); border-radius: 6px; overflow: hidden;">
                    <div style="padding: 0.75rem; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-light);">
                        <input type="text" id="${searchId}" class="form-input" placeholder="🔍 Buscar..." 
                            style="padding: 0.5rem; font-size: 0.9rem; margin: 0; width: 100%; border: 1px solid var(--color-border-light);" />
                    </div>
                    <div id="${listId}" style="max-height: 200px; overflow-y: auto;">
                        ${items.map((item, index) => {
                const isEven = index % 2 === 0;
                const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
                const isChecked = selectedIds.includes(item.id);
                return `
                                <label class="zebra-row" data-item-name="${item.nome.toLowerCase()}" 
                                    style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; cursor: pointer; 
                                           background-color: ${bgColor}; border-bottom: 1px solid #E5E7EB; transition: background-color 0.15s;"
                                    onmouseenter="this.style.backgroundColor='#EDD8BB'" 
                                    onmouseleave="this.style.backgroundColor='${bgColor}'">
                                    <input type="checkbox" value="${item.id}" ${isChecked ? 'checked' : ''} 
                                        style="accent-color: var(--color-primary); width: 16px; height: 16px; cursor: pointer; margin: 0;">
                                    <span style="font-size: 0.95rem; color: var(--color-text-primary);">${item.nome}</span>
                                </label>
                            `;
            }).join('')}
                    </div>
                </div>
            `;

            const container = document.body;
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';

            const modal = document.createElement('div');
            modal.className = 'account-modal';
            modal.style.cssText = 'background: white; border-radius: 12px; width: 90%; max-width: 900px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;';

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
                             ${renderZebraList(grupos, leadGruposIds, idGruposList, idGruposSearch)}
                        </div>

                        <!-- DUAL COLUMN CHARACTERISTICS & VALUES -->
                        <div class="form-group">
                            <label>Características e Valores</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; height: 300px;">
                                
                                <!-- Left: Characteristics -->
                                <div style="background: white; border: 1px solid var(--color-border-light); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;">
                                    <div style="padding: 0.75rem; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-light);">
                                        <input type="text" id="${idCaracSearch}" class="form-input" placeholder="🔍 Buscar Característica..." 
                                            style="padding: 0.5rem; font-size: 0.9rem; margin: 0; width: 100%; border: 1px solid var(--color-border-light);" />
                                    </div>
                                    <div id="${idCaracList}" style="flex: 1; overflow-y: auto;">
                                        <!-- Characteristics will be rendered here -->
                                    </div>
                                </div>

                                <!-- Right: Values -->
                                <div style="background: white; border: 1px solid var(--color-border-light); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;">
                                    <div id="values-header" style="padding: 0.75rem; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-light); font-weight: 600; font-size: 0.95rem;">
                                        Selecione uma característica
                                    </div>
                                    <div id="values-list" style="flex: 1; overflow-y: auto;">
                                        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 0.9rem;">
                                            Valores aparecerão aqui
                                        </div>
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
            const caracSearchEl = modal.querySelector(`#${idCaracSearch}`);
            const valuesListEl = modal.querySelector('#values-list');
            const valuesHeaderEl = modal.querySelector('#values-header');

            // --- Render Functions ---
            const renderValues = (charId, values, charName) => {
                valuesHeaderEl.textContent = charName;
                valuesListEl.innerHTML = '';

                if (!values || values.length === 0) {
                    valuesListEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 0.9rem;">Esta característica não possui valores</div>';
                    return;
                }

                const currentVal = selectedCharValues[charId];

                values.forEach((val, index) => {
                    const isEven = index % 2 === 0;
                    const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
                    const isChecked = currentVal == val.id;

                    const label = document.createElement('label');
                    label.className = 'zebra-row';
                    label.style.cssText = `display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; cursor: pointer; background-color: ${bgColor}; border-bottom: 1px solid #E5E7EB; transition: background-color 0.15s;`;

                    label.onmouseenter = () => label.style.backgroundColor = '#EDD8BB';
                    label.onmouseleave = () => label.style.backgroundColor = bgColor;

                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = `values-${charId}`;
                    radio.value = val.id;
                    radio.checked = isChecked;
                    radio.style.cssText = 'accent-color: var(--color-primary); width: 16px; height: 16px; cursor: pointer; margin: 0;';

                    radio.onchange = () => {
                        selectedCharValues[charId] = parseInt(val.id);
                        // Auto-check characteristic if not already checked
                        if (!selectedCharacteristics.has(charId)) {
                            selectedCharacteristics.add(charId);
                            renderCharacteristics();
                        }
                    };

                    const span = document.createElement('span');
                    span.textContent = val.valor;
                    span.style.cssText = 'font-size: 0.95rem; color: var(--color-text-primary);';

                    label.appendChild(radio);
                    label.appendChild(span);
                    valuesListEl.appendChild(label);
                });
            };

            const loadValues = async (charId, charName) => {
                activeCharId = charId;
                valuesHeaderEl.textContent = charName;
                valuesListEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">Carregando...</div>';

                if (valuesCache[charId]) {
                    renderValues(charId, valuesCache[charId], charName);
                    return;
                }

                try {
                    const res = await fetch(`${API_BASE_URL}/marketing/caracteristicas/${charId}/valores`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const values = await res.json();
                        valuesCache[charId] = values;
                        renderValues(charId, values, charName);
                    } else {
                        valuesListEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">Erro ao carregar valores</div>';
                    }
                } catch (e) {
                    console.error(e);
                    valuesListEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">Erro ao carregar valores</div>';
                }
            };

            const renderCharacteristics = (filter = '') => {
                caracListEl.innerHTML = '';
                const term = filter.toLowerCase();

                caracteristicas.forEach((c, index) => {
                    if (term && !c.nome.toLowerCase().includes(term)) return;

                    const isEven = index % 2 === 0;
                    const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
                    const isChecked = selectedCharacteristics.has(c.id);
                    const isActive = activeCharId === c.id;

                    const label = document.createElement('label');
                    label.className = 'zebra-row';
                    label.dataset.itemName = c.nome.toLowerCase();
                    label.style.cssText = `display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; cursor: pointer; background-color: ${bgColor}; border-bottom: 1px solid #E5E7EB; transition: background-color 0.15s;`;

                    if (isActive) {
                        label.style.backgroundColor = '#DBEAFE';
                        label.style.fontWeight = '500';
                    }

                    label.onmouseenter = () => label.style.backgroundColor = '#EDD8BB';
                    label.onmouseleave = () => {
                        if (isActive) {
                            label.style.backgroundColor = '#DBEAFE';
                        } else {
                            label.style.backgroundColor = bgColor;
                        }
                    };

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = c.id;
                    checkbox.checked = isChecked;
                    checkbox.style.cssText = 'accent-color: var(--color-primary); width: 16px; height: 16px; cursor: pointer; margin: 0;';

                    checkbox.onclick = (e) => {
                        e.stopPropagation();
                        if (checkbox.checked) {
                            selectedCharacteristics.add(c.id);
                            if (!selectedCharValues[c.id]) selectedCharValues[c.id] = null;
                            loadValues(c.id, c.nome);
                        } else {
                            selectedCharacteristics.delete(c.id);
                            delete selectedCharValues[c.id];
                        }
                    };

                    const span = document.createElement('span');
                    span.textContent = c.nome;
                    span.style.cssText = 'font-size: 0.95rem; color: var(--color-text-primary); flex: 1;';

                    label.onclick = (e) => {
                        if (e.target === checkbox) return;
                        loadValues(c.id, c.nome);
                        renderCharacteristics(filter);
                    };

                    label.appendChild(checkbox);
                    label.appendChild(span);
                    caracListEl.appendChild(label);
                });
            };

            // Initial render
            renderCharacteristics();

            // Setup Search Handlers
            setTimeout(() => {
                // Groups Search
                const grpSearch = modal.querySelector(`#${idGruposSearch}`);
                const grpList = modal.querySelector(`#${idGruposList}`);
                if (grpSearch && grpList) {
                    grpSearch.addEventListener('input', (e) => {
                        const term = e.target.value.toLowerCase();
                        grpList.querySelectorAll('.zebra-row').forEach(row => {
                            const itemName = row.dataset.itemName || '';
                            row.style.display = itemName.includes(term) ? 'flex' : 'none';
                        });
                    });
                }

                // Characteristics Search
                caracSearchEl.addEventListener('input', (e) => {
                    renderCharacteristics(e.target.value);
                });

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

                // Build characteristics array with values
                const finalCaracteristicas = Array.from(selectedCharacteristics).map(charId => ({
                    id: charId,
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
