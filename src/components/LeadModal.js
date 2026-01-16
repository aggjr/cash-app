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
            // --- UI Helpers ---
            // Build Tree from flat list
            const buildTree = (items) => {
                const rootItems = [];
                const lookup = {};
                items.forEach(item => {
                    item.children = [];
                    item.allDescendants = []; // For easy cascading
                    lookup[item.id] = item;
                });
                items.forEach(item => {
                    if (item.parent_id && lookup[item.parent_id]) {
                        lookup[item.parent_id].children.push(item);
                    } else {
                        rootItems.push(item);
                    }
                });

                // Helper to populate allDescendants
                const populateDescendants = (node) => {
                    node.children.forEach(child => {
                        node.allDescendants.push(child.id);
                        populateDescendants(child);
                        node.allDescendants.push(...child.allDescendants);
                    });
                };
                rootItems.forEach(populateDescendants);

                return rootItems;
            };

            const expandedGroups = new Set();
            // Default expand roots
            // (Optional: expand all initially? or just roots?)

            const currentLeadGroups = new Set(leadGruposIds.map(String)); // Ensure strings for comparison

            const toggleGroup = (id) => {
                if (expandedGroups.has(id)) expandedGroups.delete(id);
                else expandedGroups.add(id);
                renderGroupsTree(); // Re-render
            };

            const handleGroupCheck = (group, isChecked) => {
                // 1. Handle current node
                if (isChecked) currentLeadGroups.add(String(group.id));
                else currentLeadGroups.delete(String(group.id));

                // 2. Cascade Down (Select/Deselect all children)
                const cascadeDown = (node) => {
                    node.children.forEach(child => {
                        if (isChecked) currentLeadGroups.add(String(child.id));
                        else currentLeadGroups.delete(String(child.id));
                        cascadeDown(child);
                    });
                };
                cascadeDown(group);

                // 3. Cascade Up (If deselecting last child, deselect parent. If selecting all children, select parent)
                // Actually user said: "quando desmarcar o checkbox de todos os nós filhos, desmarcar o nó pai"
                // And standard logic: if uncheck child, uncheck parent (because parent implies ALL). 
                // Let's implement robust verifyUp:

                // We need to find the parent. Since we don't have direct parent link easily accessible in the recursion without searching,
                // we can rely on the flat list or lookup if we kept it.
                // Simple approach: Re-verify all parents state based on children.
                // Or just loop the flat 'grupos' list to find parent.

                if (!isChecked) {
                    // If unchecking, uncheck all ancestors
                    let curr = group;
                    while (curr.parent_id) {
                        const parent = grupos.find(g => g.id == curr.parent_id);
                        if (parent) {
                            currentLeadGroups.delete(String(parent.id));
                            curr = parent;
                        } else break;
                    }
                } else {
                    // If checking, check parent ONLY IF all siblings are checked? 
                    // Or usually checking a child should PARTIALLY check parent. 
                    // But we don't have partial state request.
                    // User said: "Ao marcar um nó pai, marcar todos os nós filhos".
                    // User said: "quando desmarcar o ckeckbox de todos os nós filhos, desmarcar o nó pai".
                    // This implies if I have 3 children, and I deselect 1, parent is NOT deselected yet? 
                    // "desmarcar o checkbox de TODOS os nós filhos" -> implies waiting for the last one.
                    // OK.

                    if (group.parent_id) {
                        const parent = grupos.find(g => g.id == group.parent_id);
                        if (parent) {
                            // Check if all siblings are unchecked? 
                            // Wait, user said "When deselect ALL children, deselect parent".
                            // Means if 1 is checked, parent stays checked?
                            // That sounds like "Parent = At least one child".
                            // BUT "Selecting Parent -> Selects ALL children". This is contradictory if Parent = At least one.
                            // Usually:
                            // Parent Selected = All Children Selected.
                            // Parent Deselected = At least one child Deselected.
                            // Parent Indeterminate = Some children selected.

                            // Let's stick to strict Hierarchical Sets if possible, or loose "Folder" logic.
                            // User Request literal: "desmarcar o checkbox de TODOS os nós filhos, desmarcar o nó pai"
                            // This implies that if 1 child is checked, parent REMAINS checked.
                            // This means Parent logic is "Are any children checked? Then I am checked".
                            // BUT "Checking Parent -> Checks ALL children".
                            // This is "Union" logic. 

                            // Let's implement:
                            // Check Parent -> Check All Children.
                            // Check Child -> Check Parent (because parent represents the group presence).
                            // Uncheck Child -> Check if any other children are checked. If NONE, uncheck Parent.

                            currentLeadGroups.add(String(parent.id)); // Auto-check parent if child checked

                            // We might need to propagate this up
                        }
                    }
                }

                renderGroupsTree();
            };

            // Check if any child of a parent is checked to keep parent checked (for Uncheck event)
            const reevaluateParentState = (parentId) => {
                const parent = grupos.find(g => g.id == parentId);
                if (!parent) return;

                const children = grupos.filter(g => g.parent_id == parentId);
                const hasCheckedChild = children.some(c => currentLeadGroups.has(String(c.id)));

                if (!hasCheckedChild) {
                    currentLeadGroups.delete(String(parentId));
                    if (parent.parent_id) reevaluateParentState(parent.parent_id);
                }
            };

            // Refined Check Handler using the specific logic requested
            const handleGroupCheckFormatted = (group, isChecked) => {
                const strId = String(group.id);

                if (isChecked) {
                    currentLeadGroups.add(strId);
                    // Cascade Down: Check all children
                    const cascadeSelect = (node) => {
                        // Find children in flat list for robustness
                        const children = grupos.filter(g => g.parent_id == node.id);
                        children.forEach(c => {
                            currentLeadGroups.add(String(c.id));
                            cascadeSelect(c);
                        });
                    };
                    cascadeSelect(group);

                    // Cascade Up: Check parent (because now this group is active)
                    // "Marcar um pai marca os filhos". User didn't explicitly say "Marcar um filho marca o pai",
                    // but usually yes for "Folders". If I am in a subfolder, I am in the folder.
                    let curr = group;
                    while (curr.parent_id) {
                        const parent = grupos.find(g => g.id == curr.parent_id);
                        if (parent) {
                            currentLeadGroups.add(String(parent.id));
                            curr = parent;
                        } else break;
                    }

                } else {
                    currentLeadGroups.delete(strId);
                    // Cascade Down: Deselect all children
                    // Logical consequence: if I leave the folder, I leave subfolders?
                    // User said "Ao marcar um nó pai, marcar todos". Didn't say uncheck.
                    // But usually yes. Let's uncheck children.
                    const cascadeDeselect = (node) => {
                        const children = grupos.filter(g => g.parent_id == node.id);
                        children.forEach(c => {
                            currentLeadGroups.delete(String(c.id));
                            cascadeDeselect(c);
                        });
                    };
                    cascadeDeselect(group);

                    // Cascade Up: "Quando desmarcar checkbox de TODOS os nós filhos, desmarcar o nó pai"
                    if (group.parent_id) {
                        reevaluateParentState(group.parent_id);
                    }
                }
                renderGroupsTree();
            };


            const renderGroupTreeViewer = (filter = '') => {
                const term = filter.toLowerCase();
                const tree = buildTree(grupos);

                // Helper to render a node
                const renderNode = (node, level = 0) => {
                    // Filter Logic:
                    // Show if:
                    // 1. Name matches (highlight?)
                    // 2. A child matches (then expand self)
                    // 3. A parent matched (so show self) -> Implicit in tree traversal if we don't prune.

                    const nameMatch = node.nome.toLowerCase().includes(term);
                    const childrenNodes = grupos.filter(g => g.parent_id == node.id);
                    const hasMatchingDescendant = (n) => {
                        const kids = grupos.filter(g => g.parent_id == n.id);
                        if (n.nome.toLowerCase().includes(term)) return true;
                        return kids.some(k => hasMatchingDescendant(k));
                    };
                    const childMatches = hasMatchingDescendant(node);

                    if (term && !nameMatch && !childMatches) return ''; // Hide if no match in branch

                    // Auto-expand if filtering and has matching kids
                    if (term && childMatches) expandedGroups.add(node.id);

                    const isExpanded = expandedGroups.has(node.id);
                    const isChecked = currentLeadGroups.has(String(node.id));
                    const hasChildren = childrenNodes.length > 0;

                    const indent = level * 1.2; // rem

                    let html = `
                        <div class="tree-row" 
                            style="display: flex; align-items: center; padding: 0.2rem 0.5rem; transition: background-color 0.1s; 
                                   border-bottom: 1px solid var(--color-border-light);"
                            onmouseenter="this.style.backgroundColor='#F9FAFB'" 
                            onmouseleave="this.style.backgroundColor='transparent'">
                            
                            <div style="width: ${indent}rem;"></div>
                            
                            <!-- Toggle Icon -->
                            <div style="width: 20px; display: flex; justify-content: center; cursor: pointer; margin-right: 4px;"
                                 onclick="document.getElementById('btn-toggle-${node.id}').click()">
                                <button id="btn-toggle-${node.id}" type="button" 
                                    style="background:none; border:none; cursor:pointer; font-size: 0.7rem; color: #6B7280; visibility: ${hasChildren ? 'visible' : 'hidden'};"
                                >
                                    ${isExpanded ? '▼' : '▶'}
                                </button>
                            </div>
                            
                            <!-- Checkbox -->
                            <input type="checkbox" id="chk-${node.id}" 
                                ${isChecked ? 'checked' : ''}
                                style="accent-color: var(--color-primary); width: 14px; height: 14px; cursor: pointer; margin-right: 8px;"
                            />
                            
                            <!-- Label -->
                            <label for="chk-${node.id}" style="display: flex; align-items: center; cursor: pointer; flex: 1;">
                                <span style="margin-right: 6px; font-size: 1rem;">📂</span>
                                <span style="font-size: 0.9rem; color: var(--color-text-primary); ${nameMatch && term ? 'font-weight:bold; background:#FEF3C7;' : ''}">
                                    ${node.nome}
                                </span>
                            </label>
                        </div>
                    `;

                    if (isExpanded && hasChildren) {
                        const sortedChildren = childrenNodes.sort((a, b) => a.nome.localeCompare(b.nome));
                        html += sortedChildren.map(child => renderNode(child, level + 1)).join('');
                    }

                    return html;
                };

                const sortedRoots = tree.sort((a, b) => a.nome.localeCompare(b.nome));
                return sortedRoots.map(root => renderNode(root)).join('');
            };

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
                             <label>Grupos</label> <!-- Renamed from Grupos de Interesse -->
                             <div style="background: white; border: 1px solid var(--color-border-light); border-radius: 6px; overflow: hidden;">
                                <div style="padding: 0.75rem; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-light);">
                                    <input type="text" id="${idGruposSearch}" class="form-input" placeholder="🔍 Buscar Grupos..." 
                                        style="padding: 0.5rem; font-size: 0.9rem; margin: 0; width: 100%; border: 1px solid var(--color-border-light);" />
                                </div>
                                <div id="${idGruposList}" style="max-height: 300px; overflow-y: auto;">
                                    <!-- Tree will render here -->
                                </div>
                             </div>
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
                                    <div style="padding: 0.75rem; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-light);">
                                        <input type="text" id="values-search" class="form-input" placeholder="🔍 Buscar Valor..." disabled
                                            style="padding: 0.5rem; font-size: 0.9rem; margin: 0; width: 100%; border: 1px solid var(--color-border-light); opacity: 0.6;" />
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
            const valuesSearchEl = modal.querySelector('#values-search');

            // --- Render Functions ---
            const renderValues = (charId, values, charName) => {
                valuesListEl.innerHTML = '';

                if (!values || values.length === 0) {
                    valuesSearchEl.disabled = true;
                    valuesSearchEl.style.opacity = '0.6';
                    valuesSearchEl.value = '';
                    valuesListEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 0.9rem;">Esta característica não possui valores</div>';
                    return;
                }

                // Enable search
                valuesSearchEl.disabled = false;
                valuesSearchEl.style.opacity = '1';

                const currentVal = selectedCharValues[charId];

                values.forEach((val, index) => {
                    const isEven = index % 2 === 0;
                    const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
                    const isChecked = currentVal == val.id;

                    const label = document.createElement('label');
                    label.className = 'zebra-row';
                    label.dataset.itemName = val.valor.toLowerCase();
                    label.style.cssText = `display: flex; align-items: center; gap: 0.75rem; padding: 0.35rem 0.75rem; cursor: pointer; background-color: ${bgColor}; border-bottom: 1px solid #E5E7EB; transition: background-color 0.15s;`;

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
                            // Re-render characteristics interacting properly with search filter
                            const currentFilter = caracSearchEl.value;
                            renderCharacteristics(currentFilter);
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
                valuesSearchEl.value = '';
                valuesSearchEl.disabled = true;
                valuesSearchEl.style.opacity = '0.6';
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
                        valuesSearchEl.disabled = true;
                        valuesSearchEl.style.opacity = '0.6';
                        valuesListEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">Erro ao carregar valores</div>';
                    }
                } catch (e) {
                    console.error(e);
                    valuesSearchEl.disabled = true;
                    valuesSearchEl.style.opacity = '0.6';
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
                    label.style.cssText = `display: flex; align-items: center; gap: 0.75rem; padding: 0.35rem 0.75rem; cursor: pointer; background-color: ${bgColor}; border-bottom: 1px solid #E5E7EB; transition: background-color 0.15s;`;

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
                            selectedCharValues[c.id] = null; // Clear selected value

                            // If this is the active characteristic, re-render values to clear radio selection
                            if (activeCharId === c.id && valuesCache[c.id]) {
                                renderValues(c.id, valuesCache[c.id], c.nome);
                            }
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

            // Initial render will happen in setTimeout after DOM is ready

            // Setup Search Handlers and Initial Render
            setTimeout(() => {
                // CRITICAL: Render characteristics FIRST
                console.log('Rendering characteristics:', caracteristicas.length);
                renderCharacteristics();

                // Groups Search & Initial Render
                const grpSearch = modal.querySelector(`#${idGruposSearch}`);
                const grpList = modal.querySelector(`#${idGruposList}`);

                // Helper to re-render tree ONLY
                const renderGroupsTree = () => {
                    if (grpList) {
                        grpList.innerHTML = renderGroupTreeViewer(grpSearch ? grpSearch.value : '');

                        // Re-attach listeners because innerHTML wipes them
                        // Toggle Listeners are inline/ID based (document.getElementById in onclick), so they work if IDs are stable.
                        // Actually inline onclick="document.getElementById..." works.
                        // But we need to attach Checkbox listeners manually or use global delegation.
                        // Let's use delegation on the container!
                    }
                };

                // Delegation for Groups Tree
                if (grpList) {
                    grpList.addEventListener('change', (e) => {
                        if (e.target.type === 'checkbox' && e.target.id.startsWith('chk-')) {
                            const id = parseInt(e.target.id.replace('chk-', ''));
                            const group = grupos.find(g => g.id === id);
                            if (group) {
                                handleGroupCheckFormatted(group, e.target.checked);
                            }
                        }
                    });

                    // Toggle Delegator (The expand button)
                    grpList.addEventListener('click', (e) => {
                        // Check if clicked element is a toggle button
                        if (e.target.id && e.target.id.startsWith('btn-toggle-')) {
                            e.stopPropagation(); // prevent label click if nested?
                            const id = parseInt(e.target.id.replace('btn-toggle-', ''));
                            toggleGroup(id);
                        }
                    });
                }

                if (grpSearch) {
                    grpSearch.addEventListener('input', (e) => {
                        renderGroupsTree();
                    });
                }

                renderGroupsTree(); // Initial Render

                // Characteristics Search
                caracSearchEl.addEventListener('input', (e) => {
                    renderCharacteristics(e.target.value);
                });

                // Values Search
                valuesSearchEl.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    valuesListEl.querySelectorAll('.zebra-row').forEach(row => {
                        const itemName = row.dataset.itemName || '';
                        row.style.display = itemName.includes(term) ? 'flex' : 'none';
                    });
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
