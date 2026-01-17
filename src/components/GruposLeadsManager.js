import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { GrupoModal } from './GrupoModal.js';
import { SimpleLeadModal } from './SimpleLeadModal.js';

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
    let expandedGroups = new Set(['ALL']); // Always start with ALL expanded
    let leadsTable = null;

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
                <button id="btn-new-root-group" class="btn-primary" style="padding: 4px 12px; font-size: 0.9rem;">
                    + Novo
                </button>
            </div>
        `;

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
        const countText = group.total_leads ? ` (${group.total_leads})` : ' (0)';
        nameSpan.textContent = `${group.nome}${countText}`;
        nameSpan.style.flex = '1';
        nameSpan.style.fontWeight = isSelected ? '600' : '400';
        nameSpan.style.color = isSelected ? 'var(--color-primary)' : 'inherit';
        row.appendChild(nameSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'group-actions';
        actionsDiv.style.marginLeft = '8px';
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '4px';

        // Botões Pequenos
        const createActionBtn = (icon, title, color, handler) => {
            const btn = document.createElement('button');
            btn.innerHTML = icon;
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
            // Edit
            actionsDiv.appendChild(createActionBtn('✏️', 'Editar Grupo', '#f59e0b', () => updateGrupo(group)));

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
    const getColumns = () => [
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
                btn.onclick = (e) => { e.stopPropagation(); updateSimpleLead(item); };
                return btn;
            }
        },
        { key: 'nome', label: 'Nome', width: 'auto', align: 'left', type: 'text' },
        { key: 'telefone', label: 'Whatsapp', width: '140px', align: 'left', type: 'text' },
        { key: 'email', label: 'E-mail', width: '200px', align: 'left', type: 'text' },
        {
            key: 'classe_social',
            label: 'Classe Social',
            width: '120px',
            align: 'left',
            render: (item) => getCaracteristicaValor(item, 'Classe Social')
        },
        {
            key: 'profissao',
            label: 'Profissão',
            width: '150px',
            align: 'left',
            render: (item) => getCaracteristicaValor(item, 'Profissão')
        },
        {
            key: 'sexo',
            label: 'Sexo',
            width: '100px',
            align: 'left',
            render: (item) => getCaracteristicaValor(item, 'Sexo')
        },
    ];

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

    const updateRightHeaderTitle = () => {
        const titleEl = rightPanel.querySelector('#right-panel-title');
        if (titleEl) {
            if (selectedGroupId) {
                const group = grupos.find(g => g.id === selectedGroupId);
                titleEl.textContent = group ? `Leads em: ${group.nome}` : 'Listagem geral dos leads';
            } else {
                titleEl.textContent = 'Listagem geral dos leads';
            }
        }
    };

    const renderRightHeader = () => {
        const header = document.createElement('div');
        header.style.padding = '0 0 1rem 0';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        header.innerHTML = `
            <h3 id="right-panel-title" style="margin:0; font-size:1.1rem; color:var(--color-primary);">Listagem geral dos leads</h3>
             <div style="display:flex; gap:0.5rem;">
                <button id="btn-new-simple-lead" class="btn-primary" title="Novo Lead Simplificado" style="padding: 4px 12px; font-size: 0.9rem;">
                    + Lead
                </button>
                <button id="btn-create-group-from-filter" class="btn-secondary" title="Criar novo grupo com os leads selecionados/filtrados">
                    ⚡ Criar Grupo da Seleção
                </button>
             </div>
        `;

        header.querySelector('#btn-create-group-from-filter').onclick = createGroupFromSelection;
        header.querySelector('#btn-new-simple-lead').onclick = createSimpleLead;

        return header;
    };

    // --- ACTIONS ---

    const loadData = async () => {
        try {
            leftPanel.style.opacity = '0.7';
            if (leadsTable) container.querySelector('#table-container')?.classList.add('loading');

            const [gruposRes, leadsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/marketing/leads`, { headers: getHeaders() })
            ]);

            if (!gruposRes.ok || !leadsRes.ok) throw new Error('Falha ao carregar dados');

            grupos = await gruposRes.json();
            leads = await leadsRes.json();

            renderGroupsTree();

            if (leadsTable) {
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
        await GrupoModal.show({
            grupo: parentId ? { parent_id: parentId } : null,
            onSave: async (grupoData) => {
                const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(grupoData)
                });

                if (response.ok) {
                    showToast('Grupo criado com sucesso!', 'success');
                    loadData();
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

    const createSimpleLead = async () => {
        await SimpleLeadModal.show({
            lead: null,
            onSave: async (leadData) => {
                try {
                    if (selectedGroupId) {
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
    tableContainer.style.overflow = 'hidden';
    rightPanel.appendChild(tableContainer);

    const footerSummary = document.createElement('div');
    footerSummary.id = 'footer-summary';
    rightPanel.appendChild(footerSummary);

    leadsTable = new SharedTable({
        container: tableContainer,
        columns: getColumns(),
        data: [],
        enableSelection: true,
        footer: footerSummary,
        summaryLabels: {
            total: 'Total Geral de Leads Cadastrados',
            selected: 'Leads Selecionados (no Grupo)'
        },
        onSelectionChange: (items, set) => {
            if (selectedGroupId && items) {
                handleMembershipChange(null, set);
            }
        }
    });

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
