import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { GrupoModal } from './GrupoModal.js';
import { LeadModal } from './LeadModal.js';
import { SimpleLeadModal } from './SimpleLeadModal.js'; // Added import

export const GruposLeadsManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '0'; // Remover padding interno para usar layout split
    container.style.margin = '0.5rem';
    container.style.height = 'calc(100vh - 60px)';
    container.style.width = 'calc(100% - 1rem)';
    container.style.maxWidth = 'none';
    container.style.display = 'flex';
    container.style.overflow = 'hidden';

    // State
    let grupos = [];
    let leads = [];
    let selectedGroupId = null;
    let isEditingGroup = false; // New: Controls Read-Only state
    let expandedGroups = new Set(['ALL']); // Always start with ALL expanded
    let leadsTable = null;
    let initialGroupSelection = new Set(); // To track changes during edit
    let caracteristicas = []; // Added for LeadModal

    // --- Layout Split ---

    // Left Panel (Hierarchy)
    const leftPanel = document.createElement('div');
    leftPanel.style.width = '400px';
    leftPanel.style.minWidth = '300px';
    leftPanel.style.borderRight = '1px solid var(--color-border-light)';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.backgroundColor = '#fafafa';

    // Right Panel (Leads List)
    const rightPanel = document.createElement('div');
    rightPanel.style.flex = '1';
    rightPanel.style.display = 'flex';
    rightPanel.style.flexDirection = 'column';
    rightPanel.style.padding = '1rem';
    rightPanel.style.overflow = 'hidden';
    rightPanel.style.backgroundColor = '#ffffff';

    container.appendChild(leftPanel);
    container.appendChild(rightPanel);

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // --- LEFT PANEL LOGIC (GROUPS) ---

    const renderLeftHeader = () => {
        const header = document.createElement('div');
        header.style.padding = '1rem';
        header.style.borderBottom = '1px solid var(--color-border-light)';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.backgroundColor = 'white';

        header.innerHTML = `
            <h3 style="margin:0; font-size:1.1rem; color:var(--color-primary);">👥 Grupos de Leads</h3>
            <div style="display:flex; gap:0.5rem;">
                <!-- Botão 'Atualizar' -->
                <button id="btn-refresh-groups" title="Atualizar Lista" style="
                    background: none; border: 1px solid var(--color-border-light); border-radius: 4px; 
                    cursor: pointer; padding: 4px 8px; color: var(--color-text-secondary);">
                    🔄
                </button>
                <button id="btn-edit-group-members" title="Editar Membros do Grupo" disabled style="
                    background: none; border: 1px solid var(--color-border-light); border-radius: 4px; 
                    cursor: pointer; padding: 4px 8px; color: var(--color-text-secondary); opacity: 0.5;">
                    <div style="display:flex; align-items:center; gap:1px;">
                        <span style="font-size:0.8rem;">✏️</span>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                    </div>
                </button>
                <button id="btn-new-root-group" class="btn-primary" style="padding: 4px 10px; font-size: 1.1rem; line-height: 1;">
                    +
                </button>
            </div>
        `;

        header.querySelector('#btn-edit-group-members').onclick = enterEditMode;
        header.querySelector('#btn-refresh-groups').onclick = loadData;
        header.querySelector('#btn-new-root-group').onclick = () => createGrupo(null);

        return header;
    };

    const buildTree = (items) => {
        const rootItems = [];
        const lookup = {};
        items.forEach(item => {
            item.children = [];
            lookup[item.id] = item;
        });
        items.forEach(item => {
            if (item.parent_id && lookup[item.parent_id]) {
                lookup[item.parent_id].children.push(item);
            } else {
                rootItems.push(item);
            }
        });
        return rootItems;
    };

    const selectGroup = (groupId) => {
        selectedGroupId = groupId;
        isEditingGroup = false; // Reset edit state on switch

        // Toggle Edit Button
        const editBtn = leftPanel.querySelector('#btn-edit-group-members');
        if (editBtn) {
            if (groupId && groupId !== 'ALL') {
                editBtn.disabled = false;
                editBtn.style.opacity = '1';
                editBtn.style.color = 'var(--color-primary)';
            } else {
                editBtn.disabled = true;
                editBtn.style.opacity = '0.5';
                editBtn.style.color = 'var(--color-text-secondary)';
            }
        }

        if (leadsTable) {
            // Default to Read-Only effectively
            // But wait, if groupId is ALL, maybe enable? 
            // User Request: "Ao selecionar um determinado grupo, ele deve vir travado... Para editar... clicar no lápis"
            // Implies All groups are read-only initially.
            // What about 'ALL'? 'ALL' is standard list. Can we edit 'ALL'? Probably not add to 'ALL', just edit leads.
            // Let's keep it consistent: always locked for 'membership editing'.
            // But 'ALL' doesn't have membership editing (it's dynamic).
            // So for ALL, we should disable the 'Edit' button? Yes, logic in updateRightHeaderTitle handles that.
            // For Checkboxes in ALL? They serve no purpose if we can't 'Remove from ALL'.
            // So ALL should be read-only always for checkboxes.

            leadsTable.updateOptions({ enabled: true });
        }

        renderGroupsTree(); // Re-render para atualizar destaque
        updateLeadsTableSelection(); // Atualizar tabela da direita
    };

    const toggleExpand = (e, groupId) => {
        e.stopPropagation();
        if (expandedGroups.has(groupId)) expandedGroups.delete(groupId);
        else expandedGroups.add(groupId);
        renderGroupsTree();
    };

    const renderGroupNode = (group, level = 0) => {
        const hasChildren = group.children && group.children.length > 0;
        const isExpanded = expandedGroups.has(group.id);
        const isSelected = selectedGroupId === group.id;
        const paddingLeft = level * 1.5;

        // Container do Node
        const nodeContainer = document.createElement('div');
        nodeContainer.className = 'group-node';

        // Estilo da Linha
        const row = document.createElement('div');
        row.className = 'group-row';
        row.dataset.groupId = group.id; // Add ID for lookup
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.padding = '8px 12px';
        row.style.cursor = 'pointer';
        row.style.userSelect = 'none';
        row.style.borderBottom = '1px solid #f0f0f0';
        row.style.backgroundColor = isSelected ? '#e0f2fe' : 'transparent'; // Destaque se selecionado

        row.onmouseover = () => { if (!isSelected) row.style.backgroundColor = '#f9fafb'; };
        row.onmouseout = () => { if (!isSelected) row.style.backgroundColor = 'transparent'; };
        row.onclick = () => selectGroup(group.id);

        // Identação
        const indent = document.createElement('div');
        indent.style.width = `${paddingLeft}rem`;
        row.appendChild(indent);

        // Ícone Toggle (Seta)
        const toggleIcon = document.createElement('span');
        toggleIcon.style.width = '20px';
        toggleIcon.style.display = 'inline-flex';
        toggleIcon.style.justifyContent = 'center';
        toggleIcon.style.marginRight = '4px';
        toggleIcon.style.color = '#6b7280';
        toggleIcon.style.fontSize = '0.7rem';

        if (hasChildren) {
            toggleIcon.textContent = isExpanded ? '▼' : '▶';
            toggleIcon.style.cursor = 'pointer';
            toggleIcon.onclick = (e) => toggleExpand(e, group.id);
        } else {
            toggleIcon.innerHTML = '&nbsp;';
        }
        row.appendChild(toggleIcon);

        // Checkbox Visual (conforme mockup) - Logic: Checkbox reflects selection state of the folder
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isSelected; // Checkbox indicates "This group is active"
        checkbox.style.marginRight = '8px';
        checkbox.style.cursor = 'pointer';

        // Clicking checkbox acts same as clicking row (selects group)
        checkbox.onclick = (e) => {
            e.stopPropagation();
            // If already checked (selected), maybe we want to unselect? 
            // For now, let's enforce "Click to Select". If user clicks checked box, it stays selected.
            // Or toggle? User request: "se um grupo for selecionado... leads devem ser marcados".
            // So checkbox = selection activator.
            if (!isSelected) {
                selectGroup(group.id);
            } else {
                // Optional: Unselect if clicking active? 
                selectGroup(null);
            }
        };
        row.appendChild(checkbox);

        // Ícone Pasta
        const folderIcon = document.createElement('span');
        folderIcon.textContent = isExpanded ? '📂' : '📁';
        folderIcon.style.marginRight = '8px';
        row.appendChild(folderIcon);

        // Nome com Contagem
        const nameSpan = document.createElement('span');
        nameSpan.className = 'group-name-span';
        const countText = group.total_leads ? ` (${group.total_leads})` : ' (0)';
        nameSpan.textContent = `${group.nome}${countText}`;
        nameSpan.style.flex = '1';
        nameSpan.style.fontWeight = isSelected ? '600' : '400';
        nameSpan.style.color = isSelected ? 'var(--color-primary)' : 'inherit';

        // Inline Rename (Double Click)
        if (group.id !== 'ALL') {
            nameSpan.title = 'Duplo clique para renomear';
            nameSpan.ondblclick = (e) => {
                e.stopPropagation();

                const currentName = group.nome;
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentName;
                input.style.border = '1px solid var(--color-primary)';
                input.style.borderRadius = '4px';
                input.style.padding = '2px 4px';
                input.style.fontSize = 'inherit';
                input.style.width = '100%';

                const save = async () => {
                    const newName = input.value.trim();
                    if (!newName || newName === currentName) {
                        nameSpan.textContent = `${currentName}${countText}`;
                        return;
                    }

                    nameSpan.innerHTML = '<i>Salvando...</i>';

                    try {
                        const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${group.id}`, {
                            method: 'PUT',
                            headers: getHeaders(),
                            body: JSON.stringify({ nome: newName, descricao: group.descricao || '' }) // backend might require desc?
                        });

                        if (response.ok) {
                            showToast('Grupo renomeado!', 'success');
                            loadData(); // Reload to refresh tree order/names
                        } else {
                            throw new Error('Erro ao salvar');
                        }
                    } catch (err) {
                        showToast('Erro ao renomear', 'error');
                        nameSpan.textContent = `${currentName}${countText}`;
                    }
                };

                input.onkeydown = (k) => {
                    if (k.key === 'Enter') { k.preventDefault(); input.blur(); } // blur triggers save
                    if (k.key === 'Escape') {
                        nameSpan.textContent = `${currentName}${countText}`;
                        input.onblur = null; // Disable save
                    }
                };

                input.onblur = save;
                input.onclick = (ev) => ev.stopPropagation(); // Prevent row selection logic

                nameSpan.textContent = '';
                nameSpan.appendChild(input);
                input.focus();
            };
        }

        row.appendChild(nameSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'group-actions';
        actionsDiv.style.marginLeft = '8px';
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '4px';

        // Botões Pequenos
        const createActionBtn = (icon, title, color, handler) => {
            const btn = document.createElement('button');
            if (icon.startsWith('<')) btn.innerHTML = icon;
            else btn.textContent = icon;
            btn.title = title;
            btn.style.border = 'none';
            btn.style.background = 'none';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '0.9rem';
            btn.style.padding = '2px';
            btn.style.color = color || '#6b7280';
            btn.onclick = (e) => { e.stopPropagation(); handler(); };
            return btn;
        };

        // Add Subgroup
        actionsDiv.appendChild(createActionBtn('➕', 'Novo Sub-grupo', '#10b981', () => createGrupo(group.id)));

        // Actions only for real groups (not 'ALL')
        if (group.id !== 'ALL') {
            // Edit Group Members (New)
            const editMembersIcon = `<div style="display:flex; align-items:center; justify-content:center;"><span style="font-size:0.75rem; margin-right: -2px;">✏️</span><svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div>`;
            actionsDiv.appendChild(createActionBtn(editMembersIcon, 'Editar Membros do Grupo', '#3B82F6', () => {
                selectedGroupId = group.id; // Correctly set selection first
                selectGroup(group.id);
                setTimeout(enterEditMode, 100);
            }));

            // Edit Group (Name/Desc)
            actionsDiv.appendChild(createActionBtn('✏️', 'Editar Nome/Descrição', '#f59e0b', () => updateGrupo(group)));

            // Delete
            actionsDiv.appendChild(createActionBtn('🗑️', 'Excluir Grupo', '#ef4444', () => deleteGrupo(group)));
        }

        row.appendChild(actionsDiv);

        nodeContainer.appendChild(row);

        // Render Children
        if (hasChildren && isExpanded) {
            const childrenContainer = document.createElement('div');
            group.children.forEach(child => {
                childrenContainer.appendChild(renderGroupNode(child, level + 1));
            });
            nodeContainer.appendChild(childrenContainer);
        }

        return nodeContainer;
    };

    const renderGroupsTree = () => {
        const treeContainer = leftPanel.querySelector('#groups-tree-container');
        if (!treeContainer) return;

        treeContainer.innerHTML = '';
        const realRoots = buildTree(grupos);

        // Virtual Root: "Todos os Leads"
        // This group acts as a container for all other groups and represents "All Leads"
        const virtualRoot = {
            id: 'ALL',
            nome: 'Todos os Leads',
            children: realRoots,
            total_leads: leads.length // All leads count
        };

        // Render just the virtual root
        // Force expand ALL for better UX since it's the container
        if (!expandedGroups.has('ALL')) expandedGroups.add('ALL');

        treeContainer.appendChild(renderGroupNode(virtualRoot));
    };

    // --- RIGHT PANEL LOGIC (LEADS) ---

    // Define Columns for SharedTable
    // Define Columns for SharedTable (Dynamic)
    const getColumns = () => {
        const fixedColumns = [
            {
                key: 'actions',
                label: 'Ações',
                width: '60px',
                align: 'center',
                noFilter: true,
                render: (item) => {
                    const btn = document.createElement('button');
                    btn.innerHTML = '✏️';
                    btn.title = 'Editar Lead';
                    btn.style.background = 'none';
                    btn.style.border = 'none';
                    btn.style.cursor = 'pointer';
                    btn.onclick = (e) => { e.stopPropagation(); updateLead(item); }; // Changed to updateLead (Full Modal) based on context, but user image showed Simple? No, let's stick to updateSimpleLead if that's what was there, OR use the full modal if that's preferred. The user's previous request "coloquei em modo de edição... Para o ícone de edição dos leads, usar uma cabeça" was about group members.
                    // Actually, let's stick to updateSimpleLead as per code I viewed, BUT maybe user wants full edit? 
                    // Let's keep updateSimpleLead for consistency with what I saw, unless I see 'updateLead' being used elsewhere.
                    // Wait, I see 'updateLead' defined in the file (lines 779+), using LeadModal.
                    // The 'actions' column in previous code used 'updateSimpleLead'. I'll stick to that to avoid scope creep, but dynamic columns is the main goal.
                    // Actually, if I look at `LeadsManager`, it uses `updateLead`.
                    // User complained about features not matching Leads screen (dynamic cols).
                    // I will stick to `updateSimpleLead` for now to be safe, as it was explicitly added recently.
                    btn.onclick = (e) => { e.stopPropagation(); updateSimpleLead(item); };
                    return btn;
                }
            },
            { key: 'nome', label: 'Nome', width: '200px', align: 'left', type: 'text', sticky: true }, // Sticky Name!
            { key: 'telefone', label: 'Whatsapp', width: '140px', align: 'left', type: 'text' },
            { key: 'email', label: 'E-mail', width: '200px', align: 'left', type: 'text' }
        ];

        const charColumns = caracteristicas.map(c => ({
            key: `char_${c.id}`,
            label: c.nome,
            width: '150px',
            align: 'left',
            type: 'text',
            render: (item) => item[`char_${c.id}`] || '-'
        }));

        return [...fixedColumns, ...charColumns];
    };

    const getCaracteristicaValor = (item, charName) => {
        if (!item.caracteristicas_detalhadas) return '-';
        if (typeof item.caracteristicas_detalhadas === 'string') {
            try { item.caracteristicas_detalhadas = JSON.parse(item.caracteristicas_detalhadas); } catch (e) { }
        }
        if (Array.isArray(item.caracteristicas_detalhadas)) {
            const char = item.caracteristicas_detalhadas.find(c => c.nome === charName);
            return char ? char.valor : '-';
        }
        return '-';
    };

    const updateLeadsTableSelection = () => {
        if (!leadsTable || !selectedGroupId) {
            if (leadsTable) leadsTable.clearSelection();
            return;
        }

        const selectedGroupIds = new Set();

        if (selectedGroupId === 'ALL') {
            // Select ALL leads
            leads.forEach(lead => selectedGroupIds.add(lead.id));
        } else {
            // Select leads in specific group
            leads.forEach(lead => {
                if (lead.grupos && Array.isArray(lead.grupos)) {
                    if (lead.grupos.includes(selectedGroupId) || lead.grupos.includes(String(selectedGroupId))) {
                        selectedGroupIds.add(lead.id);
                    }
                }
            });
        }

        leadsTable.selection = selectedGroupIds;
        leadsTable.render(leads); // Re-render para atualizar checkboxes visuais
        leadsTable.updateFooterSummary();

        updateRightHeaderTitle();
    };

    const refreshRightHeader = () => {
        const oldHeader = rightPanel.querySelector('#right-panel-header');
        if (oldHeader) oldHeader.remove();
        const newHeader = renderRightHeader();
        rightPanel.insertBefore(newHeader, rightPanel.firstChild);
    };

    const updateRightHeaderTitle = () => {
        const titleEl = rightPanel.querySelector('#right-panel-title');
        if (titleEl) {
            if (selectedGroupId) {
                const group = grupos.find(g => g.id === selectedGroupId);
                // Preserve 'Editando:' prefix if in edit mode
                const prefix = isEditingGroup ? 'Editando: ' : '';
                const baseTitle = group ? `Leads em: ${group.nome}` : 'Listagem geral dos leads';
                titleEl.textContent = prefix + baseTitle;
            } else {
                titleEl.textContent = 'Listagem geral dos leads';
            }
        }
    };

    const renderRightHeader = () => {
        const header = document.createElement('div');
        header.id = 'right-panel-header'; // Add ID for replacement
        header.style.padding = '0 0 1rem 0';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        let title = 'Listagem geral dos leads';
        if (selectedGroupId && selectedGroupId !== 'ALL') {
            const g = grupos.find(x => x.id === selectedGroupId);
            if (g) title = `Leads em: ${g.nome}`;
        }

        if (selectedGroupId && selectedGroupId !== 'ALL') {
            // In Edit Mode?
            if (isEditingGroup) {
                // Save / Cancel
                header.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 id="right-panel-title" style="margin:0; font-size:1.1rem; color:var(--color-primary);">Editando: ${title}</h3>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button id="btn-cancel-edit" class="btn-secondary" style="padding: 4px 12px; font-size: 0.9rem;">
                            ❌ Cancelar
                        </button>
                        <button id="btn-save-edit" class="btn-primary" style="padding: 4px 12px; font-size: 0.9rem; background-color: #10B981; border-color: #10B981;">
                            💾 Salvar Alterações
                        </button>
                    </div>
                 `;
                header.querySelector('#btn-cancel-edit').onclick = cancelEditMode;
                header.querySelector('#btn-save-edit').onclick = saveGroupChanges;
            } else {
                // View Mode - Show Edit Button (REMOVED - MOVED TO LEFT PANEL)
                // Just Show Title and + Lead
                header.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 id="right-panel-title" style="margin:0; font-size:1.1rem; color:var(--color-primary);">${title}</h3>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button id="btn-new-lead" class="btn-primary" title="Novo Lead Completo" style="padding: 4px 12px; font-size: 0.9rem;">
                            + Lead
                        </button>
                    </div>
                 `;
                header.querySelector('#btn-new-lead').onclick = createLead;
            }
        } else {
            // Default View (ALL or None)
            header.innerHTML = `
                <h3 id="right-panel-title" style="margin:0; font-size:1.1rem; color:var(--color-primary);">${title}</h3>
                 <div style="display:flex; gap:0.5rem;">
                    <button id="btn-new-lead" class="btn-primary" title="Novo Lead Completo" style="padding: 4px 12px; font-size: 0.9rem;">
                        + Lead
                    </button>
                 </div>
            `;
            header.querySelector('#btn-new-lead').onclick = createLead;
        }

        return header;
    };

    // --- ACTIONS ---

    const loadData = async () => {
        try {
            leftPanel.style.opacity = '0.7';
            if (leadsTable) container.querySelector('#table-container')?.classList.add('loading');

            const [gruposRes, leadsRes, caracsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/marketing/leads`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/marketing/caracteristicas`, { headers: getHeaders() })
            ]);

            if (!gruposRes.ok || !leadsRes.ok || !caracsRes.ok) throw new Error('Falha ao carregar dados');

            grupos = await gruposRes.json();
            leads = await leadsRes.json();
            caracteristicas = await caracsRes.json(); // Global var needs to be defined

            // Pre-process Leads for Characteristics (Parse JSON)
            leads.forEach(lead => {
                if (lead.caracteristicas_json) {
                    try {
                        const chars = typeof lead.caracteristicas_json === 'string'
                            ? JSON.parse(lead.caracteristicas_json)
                            : lead.caracteristicas_json;

                        if (Array.isArray(chars)) {
                            chars.forEach(c => {
                                // Flatten to char_{id} = "Value"
                                if (c.id) {
                                    lead[`char_${c.id}`] = c.valor || '-';
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('Erro parsing json caracteristicas', e);
                    }
                }
            });

            renderGroupsTree();

            if (leadsTable) {
                // Update Columns dynamically based on fetched characteristics
                leadsTable.columns = getColumns();
                leadsTable.render(leads);
            }

            if (selectedGroupId && !grupos.find(g => g.id === selectedGroupId)) {
                selectedGroupId = null;
            }
            updateLeadsTableSelection();

        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Erro ao carregar dados.', 'error');
        } finally {
            leftPanel.style.opacity = '1';
            if (leadsTable) container.querySelector('#table-container')?.classList.remove('loading');
        }
    };

    const createGrupo = async (parentId = null) => {
        // 'ALL' is the virtual root, so creating a child of ALL means creating a Root Group (parent_id = null)
        const realParentId = (parentId === 'ALL') ? null : parentId;

        await GrupoModal.show({
            grupo: realParentId ? { parent_id: realParentId } : null,
            minimal: true, // Minimal Creation Mode
            onSave: async (grupoData) => {
                const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(grupoData)
                });

                if (response.ok) {
                    const result = await response.json();
                    showToast('Grupo criado com sucesso!', 'success');

                    // Reload Data
                    await loadData();

                    // Auto-Select the new Group and Enter Edit Mode
                    if (result.id) {
                        selectGroup(result.id);

                        // Small delay to ensure render completes? 
                        // selectGroup calls renderGroupsTree and updateLeadsTableSelection.
                        // Then we enter edit mode.
                        setTimeout(() => {
                            console.log('Auto-entering edit mode for new group:', result.id);
                            enterEditMode();
                        }, 500);
                    }

                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao criar grupo');
                }
            }
        });
    };

    const updateGrupo = async (grupo) => {
        await GrupoModal.show({
            grupo: grupo,
            onSave: async (grupoData) => {
                const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${grupo.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(grupoData)
                });

                if (response.ok) {
                    showToast('Grupo atualizado com sucesso!', 'success');
                    loadData();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao atualizar grupo');
                }
            }
        });
    };

    const deleteGrupo = async (grupo) => {
        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir o grupo "${grupo.nome}"?`,
            'Sim, Excluir'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${grupo.id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Grupo excluído com sucesso!', 'success');
                if (selectedGroupId === grupo.id) selectedGroupId = null;
                loadData();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir grupo: ' + error.error, 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    // --- EDIT MODE LOGIC ---

    const enterEditMode = () => {
        isEditingGroup = true;

        // Force recalculation of selection from source to ensure accuracy
        const groupMembers = new Set();
        if (leads && selectedGroupId) {
            leads.forEach(lead => {
                if (lead.grupos && Array.isArray(lead.grupos)) {
                    if (lead.grupos.includes(selectedGroupId) || lead.grupos.includes(String(selectedGroupId))) {
                        groupMembers.add(lead.id);
                    }
                }
            });
        }

        leadsTable.selection = groupMembers;
        initialGroupSelection = new Set(groupMembers); // Snapshot

        leadsTable.updateOptions({ enabled: true }); // Unlock table (triggers render)
        refreshRightHeader(); // Correctly update UI
        showToast('Modo de edição ativado. Selecione/Desmarque leads.', 'info');
    };

    const cancelEditMode = () => {
        isEditingGroup = false;
        // Revert selection
        leadsTable.selection = new Set(initialGroupSelection);
        leadsTable.render(leads); // Force re-render to visually revert
        leadsTable.updateOptions({ enabled: true }); // Keep enabled for view mode
        leadsTable.updateFooterSummary();
        refreshRightHeader(); // Correctly update UI
    };

    const saveGroupChanges = async () => {
        if (!selectedGroupId) return;

        const currentSelection = leadsTable.selection;

        // Diff Logic: initial (snapshot) vs current (user edits)
        const toAdd = [...currentSelection].filter(id => !initialGroupSelection.has(id));
        const toRemove = [...initialGroupSelection].filter(id => !currentSelection.has(id));

        if (toAdd.length === 0 && toRemove.length === 0) {
            isEditingGroup = false;
            leadsTable.updateOptions({ enabled: false });
            refreshRightHeader();
            return;
        }

        const confirm = await showToast(`Salvando... (+${toAdd.length}, -${toRemove.length})`, 'info');

        try {
            const promises = [];

            // Add new members
            toAdd.forEach(leadId => {
                promises.push(
                    fetch(`${API_BASE_URL}/marketing/leads/${leadId}/groups`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ group_id: selectedGroupId })
                    })
                );
            });

            // Remove unselected members
            toRemove.forEach(leadId => {
                promises.push(
                    fetch(`${API_BASE_URL}/marketing/leads/${leadId}/groups/${selectedGroupId}`, {
                        method: 'DELETE',
                        headers: getHeaders()
                    })
                );
            });

            await Promise.all(promises);

            showToast('Grupo atualizado com sucesso!', 'success');

            isEditingGroup = false;
            // Important: Disable table immediately to prevent further edits while reloading
            leadsTable.updateOptions({ enabled: false });

            // Reload to reflect changes definitively from server
            await loadData();
            refreshRightHeader(); // Update UI back to View Mode

        } catch (error) {
            console.error('Erro ao salvar grupo:', error);
            showToast('Erro ao salvar alterações.', 'error');
            // Do not exit edit mode on error so user can retry?
            // Or exit and let them see what happened? 
            // Better to stay in edit mode if it fails.
        }
    };

    // --- FULL LEAD MODAL ---

    const createLead = async () => {
        await LeadModal.show({
            lead: null,
            grupos: grupos,
            caracteristicas: caracteristicas,
            onSave: async (leadData) => {
                try {
                    // If created while in a group, auto-add?
                    if (selectedGroupId && selectedGroupId !== 'ALL') {
                        leadData.grupos = [selectedGroupId];
                    }

                    const response = await fetch(`${API_BASE_URL}/marketing/leads`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify(leadData)
                    });

                    if (response.ok) {
                        showToast('Lead criado com sucesso!', 'success');
                        loadData();
                    } else {
                        const error = await response.json();
                        throw new Error(error.error || 'Erro ao criar lead');
                    }
                } catch (e) {
                    showToast(e.message, 'error');
                }
            }
        });
    };

    const updateSimpleLead = async (lead) => {
        await SimpleLeadModal.show({
            lead: lead,
            onSave: async (leadData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/marketing/leads/${lead.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify(leadData)
                    });

                    if (response.ok) {
                        showToast('Lead atualizado com sucesso!', 'success');
                        loadData();
                    } else {
                        const error = await response.json();
                        throw new Error(error.error || 'Erro ao atualizar lead');
                    }
                } catch (e) {
                    showToast(e.message, 'error');
                }
            }
        });
    };

    const updateLead = async (lead) => {
        await LeadModal.show({
            lead: lead,
            grupos: grupos,
            caracteristicas: caracteristicas,
            onSave: async (leadData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/marketing/leads/${lead.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify(leadData)
                    });

                    if (response.ok) {
                        showToast('Lead atualizado com sucesso!', 'success');
                        loadData();
                    } else {
                        const error = await response.json();
                        throw new Error(error.error || 'Erro ao atualizar lead');
                    }
                } catch (e) {
                    showToast(e.message, 'error');
                }
            }
        });
    };

    const handleMembershipChange = async (selectedIds, allSelectedSet) => {
        if (!selectedGroupId) return;

        const currentGroupMembers = leads.filter(l =>
            l.grupos && (l.grupos.includes(selectedGroupId) || l.grupos.includes(String(selectedGroupId)))
        ).map(l => l.id);

        const newSelection = Array.from(allSelectedSet);

        const toAdd = newSelection.filter(id => !currentGroupMembers.includes(id));
        const toRemove = currentGroupMembers.filter(id => !newSelection.includes(id));

        if (toAdd.length === 0 && toRemove.length === 0) return;

        console.log(`Updating Group ${selectedGroupId}: +${toAdd.length} / -${toRemove.length}`);

        try {
            const promises = [];

            toAdd.forEach(leadId => {
                promises.push(
                    fetch(`${API_BASE_URL}/marketing/leads/${leadId}/groups`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ group_id: selectedGroupId })
                    })
                );
            });

            toRemove.forEach(leadId => {
                promises.push(
                    fetch(`${API_BASE_URL}/marketing/leads/${leadId}/groups/${selectedGroupId}`, {
                        method: 'DELETE',
                        headers: getHeaders()
                    })
                );
            });

            await Promise.all(promises);
            showToast('Associações atualizadas', 'success');

            leads.forEach(l => {
                if (toAdd.includes(l.id)) {
                    if (!l.grupos) l.grupos = [];
                    if (!l.grupos.includes(selectedGroupId)) l.grupos.push(selectedGroupId);
                }
                if (toRemove.includes(l.id)) {
                    if (l.grupos) l.grupos = l.grupos.filter(g => g != selectedGroupId);
                }
            });

            const gr = grupos.find(g => g.id === selectedGroupId);
            if (gr) {
                gr.total_leads = (gr.total_leads || 0) + toAdd.length - toRemove.length;
                renderGroupsTree();
            }

        } catch (e) {
            console.error(e);
            showToast('Erro ao atualizar associações', 'error');
            loadData();
        }
    };

    const createGroupFromSelection = async () => {
        if (!leadsTable || leadsTable.selection.size === 0) {
            return showToast('Selecione leads primeiro', 'warning');
        }

        await GrupoModal.show({
            grupo: null,
            onSave: async (grupoData) => {
                const res = await fetch(`${API_BASE_URL}/marketing/grupos-leads`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(grupoData)
                });

                if (!res.ok) throw new Error('Falha ao criar grupo');
                const newGroup = await res.json();

                const selectedIds = Array.from(leadsTable.selection);
                const promises = selectedIds.map(leadId =>
                    fetch(`${API_BASE_URL}/marketing/leads/${leadId}/groups`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ group_id: newGroup.id })
                    })
                );

                await Promise.all(promises);

                showToast(`Grupo "${newGroup.nome}" criado com ${selectedIds.length} leads!`, 'success');
                loadData();
            }
        });
    };

    // --- INITIALIZATION ---

    leftPanel.appendChild(renderLeftHeader());

    const treeContainer = document.createElement('div');
    treeContainer.id = 'groups-tree-container';
    treeContainer.style.flex = '1';
    treeContainer.style.overflowY = 'auto';
    leftPanel.appendChild(treeContainer);

    rightPanel.appendChild(renderRightHeader());

    const tableContainer = document.createElement('div');
    tableContainer.id = 'table-container';
    tableContainer.style.flex = '1';
    tableContainer.style.display = 'flex';
    tableContainer.style.flexDirection = 'column';
    tableContainer.style.overflow = 'hidden';
    rightPanel.appendChild(tableContainer);

    const footerSummary = document.createElement('div');
    footerSummary.id = 'footer-summary';
    rightPanel.appendChild(footerSummary);

    // Handlers
    const handleBulkDelete = async () => {
        const selected = leadsTable.selection;
        if (selected.size === 0) return;

        // If in Edit Mode, do not process bulk delete from DB (safety)
        // Or maybe strictly forbid?
        if (isEditingGroup) {
            showToast('Finalize a edição do grupo antes de excluir leads.', 'warning');
            return;
        }

        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir ${selected.size} leads?`,
            'Sim, Excluir'
        );
        if (!confirmed) return;

        try {
            if (leadsTable) container.querySelector('#table-container')?.classList.add('loading');

            const promises = Array.from(selected).map(id =>
                fetch(`${API_BASE_URL}/marketing/leads/${id}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                })
            );

            await Promise.all(promises);
            showToast(`${selected.size} leads excluídos!`, 'success');
            leadsTable.clearSelection();
            loadData();
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir leads', 'error');
        } finally {
            if (leadsTable) container.querySelector('#table-container')?.classList.remove('loading');
        }
    };

    const handleBulkEdit = async () => {
        const selected = leadsTable.selection;
        if (selected.size === 0) return;

        // Use existing Bulk Char Modal
        showBulkCharModal(Array.from(selected));
    };

    leadsTable = new SharedTable({
        container: tableContainer,
        columns: getColumns(),
        data: [],
        enabled: true, // Always enabled
        enableSelection: true,
        summaryLabels: {
            total: 'Total Geral de Leads Cadastrados',
            selected: 'Leads Selecionados'
        },
        onSelectionChange: (items, set) => {
            // Dynamic Group Counter Update (Only in Edit Mode)
            if (isEditingGroup && selectedGroupId && selectedGroupId !== 'ALL') {
                const count = set.size;
                const groupRow = container.querySelector(`.group-row[data-group-id="${selectedGroupId}"]`);
                if (groupRow) {
                    const nameSpan = groupRow.querySelector('.group-name-span');

                    const findGroup = (list, id) => {
                        for (const g of list) {
                            if (g.id === id) return g;
                            if (g.children) {
                                const found = findGroup(g.children, id);
                                if (found) return found;
                            }
                        }
                        return null;
                    };
                    const groupData = findGroup(grupos, selectedGroupId);

                    if (nameSpan && groupData) {
                        nameSpan.textContent = `${groupData.nome} (${count})`;
                        nameSpan.style.color = '#eab308'; // Transition color
                        setTimeout(() => {
                            if (selectedGroupId === groupData.id) nameSpan.style.color = 'var(--color-primary)';
                        }, 500);
                    }
                }
            }
        },
        onBulkDelete: handleBulkDelete,
        onBulkEdit: handleBulkEdit
    });

    // Bulk Modal Logic (Copy from LeadsManager)
    const showBulkCharModal = async (selectedIds) => {
        try {
            const caracsRes = await fetch(`${API_BASE_URL}/marketing/caracteristicas`, { headers: getHeaders() });
            if (!caracsRes.ok) throw new Error('Erro ao carregar características');
            const caracteristicas = await caracsRes.json();

            // Create Simple Modal Overlay
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '10000';

            overlay.innerHTML = `
                <div class="account-modal animate-float-in" style="max-width: 400px; width: 90%; padding: 20px;">
                    <h3 style="margin-top: 0; color: var(--color-primary);">Alterar Característica em Massa</h3>
                    <p style="color: #666; font-size: 0.9rem; margin-bottom: 20px;">
                        Aplicar alteração para <strong>${selectedIds.length}</strong> leads selecionados.
                    </p>

                    <div class="form-group">
                        <label>Característica</label>
                        <select id="bulk-char-select" class="form-input">
                            <option value="">Selecione...</option>
                            ${caracteristicas.map(c => `<option value="${c.id}" data-type="${c.tipo}">${c.nome}</option>`).join('')}
                        </select>
                    </div>

                    <div id="bulk-value-container" class="form-group" style="display: none;">
                        <label>Valor</label>
                        <div id="bulk-value-input-wrapper"></div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                        <button id="bulk-cancel" class="btn-secondary">Cancelar</button>
                        <button id="bulk-confirm" class="btn-primary" disabled>Aplicar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const selectChar = overlay.querySelector('#bulk-char-select');
            const valueContainer = overlay.querySelector('#bulk-value-container');
            const valueWrapper = overlay.querySelector('#bulk-value-input-wrapper');
            const confirmBtn = overlay.querySelector('#bulk-confirm');
            const cancelBtn = overlay.querySelector('#bulk-cancel');

            let selectedCharValues = [];

            selectChar.addEventListener('change', async (e) => {
                const charId = e.target.value;
                confirmBtn.disabled = true;

                if (!charId) {
                    valueContainer.style.display = 'none';
                    return;
                }

                try {
                    const valsRes = await fetch(`${API_BASE_URL}/marketing/caracteristicas/${charId}/valores`, { headers: getHeaders() });
                    if (valsRes.ok) {
                        selectedCharValues = await valsRes.json();
                    } else {
                        selectedCharValues = [];
                    }
                } catch (err) { selectedCharValues = []; }

                valueContainer.style.display = 'block';
                valueWrapper.innerHTML = '';

                if (selectedCharValues.length > 0) {
                    const sel = document.createElement('select');
                    sel.className = 'form-input';
                    sel.innerHTML = `
                        <option value="">Selecione o valor...</option>
                        ${selectedCharValues.map(v => `<option value="${v.id}">${v.valor}</option>`).join('')}
                    `;
                    sel.onchange = () => { confirmBtn.disabled = !sel.value; };
                    valueWrapper.appendChild(sel);
                } else {
                    valueWrapper.innerHTML = '<span style="color: orange; font-size: 0.9rem;">Esta característica não possui valores pré-definidos.</span>';
                }
            });

            confirmBtn.onclick = async () => {
                const charId = selectChar.value;
                const valSelect = valueWrapper.querySelector('select');
                const valId = valSelect ? valSelect.value : null;

                if (!charId || !valId) return;

                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Aplicando...';

                try {
                    const res = await fetch(`${API_BASE_URL}/marketing/leads/bulk-characteristic`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            leadsIds: selectedIds,
                            caracteristicaId: charId,
                            valorId: valId
                        })
                    });

                    if (res.ok) {
                        showToast('Alteração em massa realizada!', 'success');
                        document.body.removeChild(overlay);
                        loadData(); // Simplest.
                    } else {
                        throw new Error('Falha na atualização');
                    }
                } catch (err) {
                    showToast('Erro ao aplicar alteração', 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Aplicar';
                }
            };

            cancelBtn.onclick = () => document.body.removeChild(overlay);
            overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };

        } catch (error) {
            console.error(error);
            showToast('Erro ao abrir alteração em massa', 'error');
        }
    };


    const showCustomConfirm = (message, confirmText = 'Sim') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.background = 'rgba(0,0,0,0.4)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '100000';

            const box = document.createElement('div');
            box.style.background = 'white';
            box.style.padding = '24px';
            box.style.borderRadius = '12px';
            box.style.maxWidth = '400px';
            box.style.width = '90%';
            box.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
            box.style.textAlign = 'center';

            box.innerHTML = `
                <h3 style="margin: 0 0 16px 0; color: var(--color-primary); font-size: 1.25rem;">Confirmação</h3>
                <p style="margin: 0 0 24px 0; color: #555; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="confirm-no" style="
                        background: transparent; border: 1px solid #ccc; padding: 8px 16px; 
                        border-radius: 6px; cursor: pointer; color: #555; font-weight: 500;">
                        Não
                    </button>
                    <button id="confirm-yes" style="
                        background: var(--color-primary); border: none; padding: 8px 16px; 
                        border-radius: 6px; cursor: pointer; color: white; font-weight: 500;">
                        ${confirmText}
                    </button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const cleanup = (result) => {
                document.body.removeChild(overlay);
                resolve(result);
            };

            box.querySelector('#confirm-yes').onclick = () => cleanup(true);
            box.querySelector('#confirm-no').onclick = () => cleanup(false);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
        });
    };

    loadData();

    return container;
};
