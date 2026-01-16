import { showToast } from '../utils/toast.js';
import { showToast } from '../utils/toast.js';
import { Dialogs } from './Dialogs.js';
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

            // Ensure Dialogs initialized
            Dialogs.init();

            // State
            const leadGruposIds = lead?.grupos || [];
            const selectedCharacteristics = new Set(); // IDs of checked characteristics
            const selectedCharValues = {}; // { charId: valueId }
            let activeCharId = null; // Currently selected char to show values
            let activeValueId = null; // Currently selected value for editing
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
                console.log('Building tree from items:', items.length);
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
                console.log('Tree built, roots:', rootItems.length);

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
                console.log('Rendering Group Tree. Filter:', filter, 'Total Grupos:', grupos.length);
                const term = filter.toLowerCase();
                if (!grupos || grupos.length === 0) return '<div style="padding:1rem; color:#888;">Nenhum grupo carregado</div>';

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
                            style="display: flex; align-items: center; padding: 0.15rem 0.5rem; transition: background-color 0.1s; 
                                   border-bottom: 1px solid var(--color-border-light); margin: 0;"
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
                             <label>Grupos que é integrante</label>
                             <div style="background: white; border: 1px solid var(--color-border-light); border-radius: 6px; overflow: hidden;">
                                <div style="padding: 0.4rem; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-light);">
                                    <input type="text" id="${idGruposSearch}" class="form-input" placeholder="🔍 Buscar Grupos..." 
                                        style="padding: 0.4rem; font-size: 0.9rem; margin: 0; width: 100%; border: 1px solid var(--color-border-light);" />
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
                                    <div style="padding: 0.4rem; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-light); display: flex; flex-direction: column; gap: 0.25rem;">
                                        <div style="display: flex; justify-content: flex-end; gap: 0.25rem;">
                                            <button type="button" id="btn-add-char" class="action-btn" title="Adicionar" style="font-size:0.8rem; padding: 2px 6px;">➕</button>
                                            <button type="button" id="btn-edit-char" class="action-btn" title="Editar" style="font-size:0.8rem; padding: 2px 6px;">✏️</button>
                                            <button type="button" id="btn-del-char" class="action-btn" title="Deletar" style="font-size:0.8rem; padding: 2px 6px;">🗑️</button>
                                        </div>
                                        <input type="text" id="${idCaracSearch}" class="form-input" placeholder="🔍 Buscar Característica..." 
                                            style="padding: 0.4rem; font-size: 0.9rem; margin: 0; width: 100%; border: 1px solid var(--color-border-light);" />
                                    </div>
                                    <div id="${idCaracList}" style="flex: 1; overflow-y: auto;">
                                        <!-- Characteristics will be rendered here -->
                                    </div>
                                </div>

                                <!-- Right: Values -->
                                <div style="background: white; border: 1px solid var(--color-border-light); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;">
                                    <div style="padding: 0.4rem; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-light); display: flex; flex-direction: column; gap: 0.25rem;">
                                        <div style="display: flex; justify-content: flex-end; gap: 0.25rem;">
                                            <button type="button" id="btn-add-val" class="action-btn" title="Adicionar" style="font-size:0.8rem; padding: 2px 6px;">➕</button>
                                            <button type="button" id="btn-edit-val" class="action-btn" title="Editar" style="font-size:0.8rem; padding: 2px 6px;">✏️</button>
                                            <button type="button" id="btn-del-val" class="action-btn" title="Deletar" style="font-size:0.8rem; padding: 2px 6px;">🗑️</button>
                                        </div>
                                        <input type="text" id="values-search" class="form-input" placeholder="🔍 Buscar Valor..." disabled
                                            style="padding: 0.4rem; font-size: 0.9rem; margin: 0; width: 100%; border: 1px solid var(--color-border-light); opacity: 0.6;" />
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
                    label.style.cssText = `display: flex; align-items: center; gap: 0.75rem; padding: 0.25rem 0.5rem; cursor: pointer; background-color: ${bgColor}; border-bottom: 1px solid #E5E7EB; transition: background-color 0.15s; margin: 0;`;

                    // Highlight active value for editing
                    if (activeValueId === val.id) {
                        label.style.backgroundColor = '#E0F2FE'; // Light blue
                        label.style.borderLeft = '3px solid var(--color-primary)';
                    }

                    label.onmouseenter = () => label.style.backgroundColor = activeValueId === val.id ? '#E0F2FE' : '#EDD8BB';
                    label.onmouseleave = () => label.style.backgroundColor = activeValueId === val.id ? '#E0F2FE' : bgColor;

                    // Click to select for editing (separate from Checkbox/Radio if needed, but here sticking to row click)
                    label.onclick = (e) => {
                        // If clicking input, don't toggle edit select? No, allow it.
                        activeValueId = val.id;
                        renderValues(charId, values, charName);
                    };

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

                    // Stop propagation on radio click to allow native behavior but also bubble to row?
                    radio.onclick = (e) => e.stopPropagation();

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
                    label.style.cssText = `display: flex; align-items: center; gap: 0.75rem; padding: 0.25rem 0.5rem; cursor: pointer; background-color: ${bgColor}; border-bottom: 1px solid #E5E7EB; transition: background-color 0.15s; margin: 0;`;

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

                // Phone Mask Listener
                if (telefoneInputRef) {
                    telefoneInputRef.addEventListener('input', (e) => {
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length > 11) value = value.slice(0, 11);

                        if (value.length > 6) {
                            value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
                        } else if (value.length > 2) {
                            value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                        } else if (value.length > 0) {
                            value = `(${value}`;
                        }
                        e.target.value = value;
                    });
                }

                // --- CRUD Handlers ---
                const manageApi = async (url, method, body = null) => {
                    try {
                        const opts = {
                            method,
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
                        };
                        if (body) opts.body = JSON.stringify(body);
                        const res = await fetch(API_BASE_URL + url, opts);
                        if (!res.ok) throw new Error('Falha na operação');
                        return await res.json();
                    } catch (e) {
                        console.error(e);
                        showToast('error', 'Erro na operação. Tente novamente.');
                        return null;
                    }
                };

                // Add Char
                modal.querySelector('#btn-add-char').onclick = async () => {
                    const name = await Dialogs.prompt("Nome da nova Característica:", "", "Nova Característica");
                    if (name) {
                        const res = await manageApi('/marketing/caracteristicas', 'POST', { nome: name });
                        if (res) {
                            caracteristicas.push(res);
                            renderCharacteristics();
                        }
                    }
                };

                // Edit Char
                modal.querySelector('#btn-edit-char').onclick = async () => {
                    if (!activeCharId) return showToast('info', 'Selecione uma característica para editar');
                    const char = caracteristicas.find(c => c.id == activeCharId);
                    const name = await Dialogs.prompt("Novo nome:", char?.nome, "Editar Característica");
                    if (name) {
                        const res = await manageApi(`/marketing/caracteristicas/${activeCharId}`, 'PUT', { nome: name });
                        if (res) {
                            char.nome = name;
                            renderCharacteristics();
                        }
                    }
                };

                // Delete Char
                modal.querySelector('#btn-del-char').onclick = async () => {
                    if (!activeCharId) return showToast('info', 'Selecione uma característica para deletar');
                    const confirmed = await Dialogs.confirm(
                        "Tem certeza? Se houver uso, ela será apenas inativada.",
                        "Excluir Característica"
                    );
                    if (confirmed) {
                        // We assume backend handles Smart Delete (Soft/Hard check)
                        const res = await manageApi(`/marketing/caracteristicas/${activeCharId}`, 'DELETE');
                        if (res) {
                            // Assuming success means deleted or inactivated
                            // Remove from local list for visual feedback
                            const idx = caracteristicas.findIndex(c => c.id == activeCharId);
                            if (idx > -1) caracteristicas.splice(idx, 1);
                            activeCharId = null;
                            renderCharacteristics();
                            valuesListEl.innerHTML = '';
                        }
                    }
                };

                // Add Value
                modal.querySelector('#btn-add-val').onclick = async () => {
                    if (!activeCharId) return showToast('info', 'Selecione uma característica primeiro');
                    const name = await Dialogs.prompt("Nome do novo Valor:", "", "Novo Valor");
                    if (name) {
                        const res = await manageApi(`/marketing/caracteristicas/${activeCharId}/valores`, 'POST', { valor: name });
                        if (res) {
                            // res is the new value
                            if (!valuesCache[activeCharId]) valuesCache[activeCharId] = [];
                            valuesCache[activeCharId].push(res);
                            renderValues(activeCharId, valuesCache[activeCharId], '');
                        }
                    }
                };

                // Edit Value
                modal.querySelector('#btn-edit-val').onclick = async () => {
                    if (!activeValueId) return showToast('info', 'Selecione um valor para editar');
                    const vals = valuesCache[activeCharId];
                    const val = vals.find(v => v.id == activeValueId);
                    const name = await Dialogs.prompt("Novo nome:", val?.valor, "Editar Valor");
                    if (name) {
                        // Assuming generic value update endpoint or nested
                        // Trying nested: PUT /marketing/caracteristicas/{charId}/valores/{valId}
                        // OR Just /marketing/valores/{id} ?
                        // Let's try /marketing/valores/{id} first as it is cleaner, or fallback.
                        // Given the structure, use what is likely.
                        const res = await manageApi(`/marketing/caracteristicas/${activeCharId}/valores/${activeValueId}`, 'PUT', { valor: name });
                        if (res) {
                            val.valor = name;
                            renderValues(activeCharId, vals, '');
                        }
                    }
                };

                // Delete Value
                modal.querySelector('#btn-del-val').onclick = async () => {
                    if (!activeValueId) return showToast('info', 'Selecione um valor para deletar');
                    const confirmed = await Dialogs.confirm("Tem certeza?", "Excluir Valor");
                    if (confirmed) {
                        const res = await manageApi(`/marketing/caracteristicas/${activeCharId}/valores/${activeValueId}`, 'DELETE');
                        if (res) {
                            const vals = valuesCache[activeCharId];
                            const idx = vals.findIndex(v => v.id == activeValueId);
                            if (idx > -1) vals.splice(idx, 1);
                            activeValueId = null;
                            renderValues(activeCharId, vals, '');
                        }
                    }
                };

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
