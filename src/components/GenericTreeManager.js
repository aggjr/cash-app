import GenericTreeApi from '../services/genericTreeApi.js';
import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { PrintHelper } from '../utils/printHelper.js';


/**
 * Generic Tree Manager Factory
 * Creates a tree manager for any table
 * @param {string} tableName - Database table name (e.g., 'tipo_entrada')
 * @param {string} title - Display title (e.g., 'Tipo Entrada')
 * @param {string} term - Specific term for items (e.g., 'Entrada')
 */
export const createTreeManager = (tableName, title, term = 'Categoria') => {
    const api = new GenericTreeApi(tableName);
    const API_BASE_URL = getApiBaseUrl();
    let treeData = [];
    let draggedNodeId = null;

    // Filtering and search state
    let checkedNodes = new Set();
    let hideUnchecked = false;

    let searchQuery = '';

    // screenSearchValue removed to prevent live state tracking issues

    // Helper to get Auth Headers
    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Helper to get Current Project ID
    const getProjectId = () => {
        const project = JSON.parse(localStorage.getItem('currentProject'));
        return project ? project.id : null;
    };

    // Convert flat array to tree structure
    const buildTree = (flatData) => {
        const map = {};
        const roots = [];

        flatData.forEach(node => {
            map[node.id] = { ...node, children: [] };
        });

        flatData.forEach(node => {
            if (node.parent_id === null) {
                roots.push(map[node.id]);
            } else if (map[node.parent_id]) {
                map[node.parent_id].children.push(map[node.id]);
            }
        });

        const sortByOrdem = (nodes) => {
            nodes.sort((a, b) => a.ordem - b.ordem);
            nodes.forEach(node => {
                if (node.children && node.children.length > 0) {
                    sortByOrdem(node.children);
                }
            });
        };

        sortByOrdem(roots);
        return roots;
    };

    // Load data from API
    const loadTreeData = async () => {
        const loadingEl = document.getElementById('tree-loading');
        const errorEl = document.getElementById('tree-error');
        const containerEl = document.getElementById('tree-container');

        try {
            if (loadingEl) loadingEl.style.display = 'block';
            if (errorEl) errorEl.style.display = 'none';
            if (containerEl) containerEl.style.display = 'none';

            const projectId = getProjectId();
            if (!projectId) {
                throw new Error('Nenhum projeto selecionado');
            }

            // We need to pass projectId to the API. 
            // Assuming GenericTreeApi.getAll() can take query params or we modify it.
            // Since we can't easily modify GenericTreeApi class instance method signature without checking it,
            // let's assume we can pass it or we fetch directly here if the class doesn't support it.
            // But wait, I modified GenericTreeApi? No, I modified the Controller.
            // I should check GenericTreeApi.js service. 
            // For now, I'll use fetch directly here to be safe and ensure headers are passed, 
            // OR I should have updated GenericTreeApi.js. 
            // Let's use fetch directly for now to ensure we send headers and projectId.

            const response = await fetch(`${API_BASE_URL}/${tableName}?projectId=${projectId}`, {
                headers: getHeaders()
            });

            if (!response.ok) throw new Error('Failed to fetch data');

            const flatData = await response.json();
            treeData = buildTree(flatData);

            if (loadingEl) loadingEl.style.display = 'none';
            if (containerEl) containerEl.style.display = 'block';

            // Default: Select all nodes
            toggleAllCheckboxes(true);

            renderTree();
        } catch (error) {
            console.error('Error loading tree data:', error);
            if (loadingEl) loadingEl.style.display = 'none';
            if (errorEl) errorEl.style.display = 'block';
            if (errorEl) errorEl.querySelector('p').textContent = error.message;
        }
    };

    const findNode = (nodes, id) => {
        for (const node of nodes) {
            if (node.id == id) return node;
            if (node.children) {
                const found = findNode(node.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    // Helper functions for filtering and search
    const getAllNodeIds = (nodes) => {
        let ids = [];
        nodes.forEach(node => {
            ids.push(node.id);
            if (node.children && node.children.length > 0) {
                ids = ids.concat(getAllNodeIds(node.children));
            }
        });
        return ids;
    };

    const toggleCheckbox = (id, checked) => {
        if (checked) {
            checkedNodes.add(id);
        } else {
            checkedNodes.delete(id);
        }
        renderTree();
    };

    const toggleAllCheckboxes = (checked) => {
        if (checked) {
            const allIds = getAllNodeIds(treeData);
            checkedNodes = new Set(allIds);
        } else {
            checkedNodes.clear();
        }
        renderTree();
    };

    const toggleHideUnchecked = () => {
        hideUnchecked = !hideUnchecked;
        renderTree();
    };

    const triggerSearch = () => {
        const inputEl = document.getElementById(`search-input-${tableName}`);
        if (inputEl) {
            searchQuery = inputEl.value.toLowerCase();
        }

        if (searchQuery) {
            // Auto-expand ancestors of matching nodes
            const expandMatchingAncestors = (nodes) => {
                let hasMatch = false;
                nodes.forEach(node => {
                    const match = node.label.toLowerCase().includes(searchQuery);
                    let childMatch = false;
                    if (node.children && node.children.length > 0) {
                        childMatch = expandMatchingAncestors(node.children);
                    }

                    if (match || childMatch) {
                        node.expanded = true; // Temporary expansion for search
                        hasMatch = true;
                    }
                });
                return hasMatch;
            };
            expandMatchingAncestors(treeData);
        }

        renderTree();
    };

    const nodeMatchesSearch = (node) => {
        if (!searchQuery) return true;
        return node.label.toLowerCase().includes(searchQuery);
    };

    const hasMatchingDescendant = (node) => {
        if (nodeMatchesSearch(node)) return true;
        if (node.children && node.children.length > 0) {
            return node.children.some(child => hasMatchingDescendant(child));
        }
        return false;
    };

    const shouldShowNode = (node) => {
        // Search filter only highlights, does not hide
        // But if filtering by checked, we still respect that
        // if (searchQuery && !hasMatchingDescendant(node)) {
        //    return false;
        // }

        // Then check checkbox filter
        if (hideUnchecked && !checkedNodes.has(node.id)) {
            // Show if any descendant is checked
            if (node.children && node.children.length > 0) {
                return node.children.some(child => checkedNodes.has(child.id) || shouldShowNode(child));
            }
            return false;
        }

        return true;
    };

    const getVisibleLeaves = (nodes, result = []) => {
        nodes.forEach(node => {
            if (node.children && node.children.length > 0) {
                getVisibleLeaves(node.children, result);
            } else {
                // If filtering enabled, check if checked. Otherwise always include (but we only call this if filtering enabled?)
                // Actually, this function is specific for the "Hide Unchecked" mode which specifically wants to hide folders
                // So we assume we only want Checked Leaves.
                if (checkedNodes.has(node.id)) {
                    result.push(node);
                }
            }
        });
        return result;
    };

    // CRUD Operations
    const addNode = async (parentId, label) => {
        try {
            const projectId = getProjectId();
            const parent = parentId ? findNode(treeData, parentId) : null;
            const ordem = parent ? parent.children.length : treeData.length;

            const response = await fetch(`${API_BASE_URL}/${tableName}`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    label,
                    parent_id: parentId,
                    ordem,
                    expanded: true,
                    projectId
                })
            });

            if (!response.ok) throw new Error('Failed to create node');

            await loadTreeData();
        } catch (error) {
            console.error('Error adding node:', error);
            Dialogs.alert(`Erro ao criar ${term.toLowerCase()}: ${error.message}`, 'Erro');
        }
    };

    const updateNode = async (id, newLabel) => {
        try {
            const node = findNode(treeData, id);
            if (node) {
                const response = await fetch(`${API_BASE_URL}/${tableName}/${id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        label: newLabel,
                        parent_id: node.parent_id,
                        ordem: node.ordem,
                        expanded: node.expanded
                    })
                });

                if (!response.ok) throw new Error('Failed to update node');
                await loadTreeData();
            }
        } catch (error) {
            console.error('Error updating node:', error);
            Dialogs.alert(`Erro ao atualizar ${term.toLowerCase()}: ${error.message}`, 'Erro');
        }
    };

    const deleteNodeAPI = async (id) => {
        try {
            const response = await fetch(`${API_BASE_URL}/${tableName}/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            const data = await response.json();

            if (data.type === 'soft') {
                await Dialogs.alert(
                    'A deleção não foi possível pois o dado está sendo referenciado. O item foi marcado como inativo.',
                    'Item Inativado'
                );
            }
            // If hard delete, we just reload (silent success)

            await loadTreeData();
        } catch (error) {
            console.error('Error deleting node:', error);
            Dialogs.alert(`Erro ao excluir ${term.toLowerCase()}: ${error.message}`, 'Erro');
        }
    };

    const toggleNode = async (id) => {
        try {
            const node = findNode(treeData, id);
            if (node) {
                await fetch(`${API_BASE_URL}/${tableName}/${id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({ expanded: !node.expanded })
                });
                await loadTreeData();
            }
        } catch (error) {
            console.error('Error toggling node:', error);
        }
    };

    const reactivateNode = async (id) => {
        try {
            await fetch(`${API_BASE_URL}/${tableName}/${id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ active: true })
            });
            await loadTreeData();
        } catch (error) {
            console.error('Error reactivating:', error);
            Dialogs.alert('Erro ao reativar item', 'Erro');
        }
    };

    // Indent/Outdent operations
    const indentNode = async (id) => {
        try {
            let nodeIndex = -1;
            // Find node in root or children to determine siblings
            // This logic is complex for flat list, easier with tree traversal
            // Simplified: find parent, find index in parent's children

            const findParentAndIndex = (nodes, targetId, parent = null) => {
                for (let i = 0; i < nodes.length; i++) {
                    if (nodes[i].id == targetId) {
                        return { parent, index: i, node: nodes[i] };
                    }
                    if (nodes[i].children) {
                        const found = findParentAndIndex(nodes[i].children, targetId, nodes[i]);
                        if (found) return found;
                    }
                }
                return null;
            };

            const result = findParentAndIndex(treeData, id);
            if (result && result.index > 0) {
                const siblings = result.parent ? result.parent.children : treeData;
                const newParent = siblings[result.index - 1];

                await fetch(`${API_BASE_URL}/${tableName}/${id}/move`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        parent_id: newParent.id,
                        ordem: newParent.children ? newParent.children.length : 0
                    })
                });
                await loadTreeData();
            }
        } catch (error) {
            console.error('Error indenting node:', error);
            Dialogs.alert('Erro ao mover categoria', 'Erro');
        }
    };

    const outdentNode = async (id) => {
        try {
            const findParentAndIndex = (nodes, targetId, parent = null, grandparent = null) => {
                for (let i = 0; i < nodes.length; i++) {
                    if (nodes[i].id == targetId) {
                        return { parent, grandparent, index: i, node: nodes[i] };
                    }
                    if (nodes[i].children) {
                        const found = findParentAndIndex(nodes[i].children, targetId, nodes[i], parent);
                        if (found) return found;
                    }
                }
                return null;
            };

            const result = findParentAndIndex(treeData, id);
            if (result && result.parent) {
                const newParentId = result.grandparent ? result.grandparent.id : null;

                await fetch(`${API_BASE_URL}/${tableName}/${id}/move`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        parent_id: newParentId,
                        ordem: 0 // Append to end of new parent's children, or 0? Logic might need adjustment but 0 is safe for now
                    })
                });
                await loadTreeData();
            }
        } catch (error) {
            console.error('Error outdenting node:', error);
            Dialogs.alert('Erro ao mover categoria', 'Erro');
        }
    };

    // Drag and Drop
    const handleDragStart = (e, id) => {
        draggedNodeId = id;
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('dragging');
        e.stopPropagation();
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.target.closest('.tree-node-content');
        if (target) {
            target.classList.add('drag-over');
        }
    };

    const handleDragLeave = (e) => {
        const target = e.target.closest('.tree-node-content');
        if (target) {
            target.classList.remove('drag-over');
        }
    };

    const handleDrop = async (e, targetId) => {
        e.preventDefault();
        e.stopPropagation();

        const targetElement = e.target.closest('.tree-node-content');
        if (targetElement) targetElement.classList.remove('drag-over');

        document.querySelector('.dragging')?.classList.remove('dragging');

        if (!draggedNodeId || draggedNodeId == targetId) return;

        try {
            const nodeToMove = findNode(treeData, draggedNodeId);

            if (findNode(nodeToMove.children || [], targetId)) {
                Dialogs.alert('Não é possível mover uma pasta para dentro de si mesma.', 'Aviso');
                return;
            }

            if (targetId === 'root') {
                await fetch(`${API_BASE_URL}/${tableName}/${draggedNodeId}/move`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        parent_id: null,
                        ordem: treeData.length
                    })
                });
            } else {
                const targetNode = findNode(treeData, targetId);
                await fetch(`${API_BASE_URL}/${tableName}/${draggedNodeId}/move`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        parent_id: targetId,
                        ordem: targetNode.children ? targetNode.children.length : 0
                    })
                });
            }

            await loadTreeData();
        } catch (error) {
            console.error('Error moving node:', error);
            Dialogs.alert(`Erro ao mover ${term.toLowerCase()}`, 'Erro');
        }
    };

    // Rendering
    let visibleRowIndex = 0;

    const renderNode = (node, level = 0) => {
        // Check if node should be visible based on filters
        if (!shouldShowNode(node)) {
            return '';
        }

        const hasChildren = node.children && node.children.length > 0;
        const isActive = node.active !== 0 && node.active !== false;
        const inactiveClass = !isActive ? 'inactive' : '';
        const isChecked = checkedNodes.has(node.id);
        const matchesSearch = nodeMatchesSearch(node);
        const highlightClass = searchQuery && matchesSearch ? 'search-highlight' : '';

        const isEven = visibleRowIndex % 2 === 0;
        visibleRowIndex++;
        const rowClass = isEven ? 'row-even' : 'row-odd';

        // Checkbox is ALWAYS on the far left. Content is indented.
        // We removed margin-left from parent and will add padding-left to content wrapper.

        return `
    <div class="tree-node" data-id="${node.id}">
      <div class="tree-node-content ${inactiveClass} ${rowClass} ${highlightClass}" draggable="${isActive}">
        <div style="width: 20px; display: flex; justify-content: center; margin-right: 0.5rem; flex-shrink: 0;">
            <input type="checkbox" 
                   class="node-checkbox" 
                   style="margin: 0;"
                   ${isChecked ? 'checked' : ''} 
                   onchange="window.treeActions_${tableName}.toggleCheckbox(${node.id}, this.checked)"
                   onclick="event.stopPropagation()"
            />
        </div>
        
        <div style="flex: 1; display: flex; align-items: center; padding-left: ${level * 20}px;">
            <span class="node-toggle" onclick="window.treeActions_${tableName}.toggle(${node.id})">
              ${hasChildren ? (node.expanded ? '▼' : '▶') : '•'}
            </span>
            <span class="node-icon">${hasChildren ? '📁' : '📄'}</span>
            <span class="node-label" onclick="${isActive ? `window.treeActions_${tableName}.edit(${node.id})` : ''}">${node.label} ${!isActive ? '(Inativo)' : ''}</span>
            <div class="node-actions">
              ${isActive ? `
                <button onclick="window.treeActions_${tableName}.outdent(${node.id})" title="Outdent (Left)" class="btn-arrow">⬅️</button>
                <button onclick="window.treeActions_${tableName}.indent(${node.id})" title="Indent (Right)" class="btn-arrow">➡️</button>
                <button onclick="window.treeActions_${tableName}.addChild(${node.id})" title="Add Sub-item">➕</button>
                <button onclick="window.treeActions_${tableName}.edit(${node.id})" title="Edit">✏️</button>
                <button onclick="window.treeActions_${tableName}.delete(${node.id})" title="Delete" class="btn-delete">🗑️</button>
              ` : `
                <button onclick="window.treeActions_${tableName}.reactivate(${node.id})" title="Reactivate" class="btn-reactivate">♻️</button>
                <button onclick="window.treeActions_${tableName}.delete(${node.id})" title="Force Delete" class="btn-delete">🗑️</button>
              `}
            </div>
        </div>
      </div>
      ${node.expanded && hasChildren ? `
        <div class="tree-children">
          ${node.children.map(child => renderNode(child, level + 1)).join('')}
        </div>
      ` : ''}
    </div>
  `;
    };

    const exportToCSV = () => {
        ExcelExporter.exportTree(treeData, title, `${tableName}_export`);
    };

    const renderTree = () => {
        const container = document.getElementById('tree-container');
        if (!container) return;

        visibleRowIndex = 0; // Reset counter for new render

        const totalNodes = getAllNodeIds(treeData).length;
        const visibleNodes = treeData.filter(node => shouldShowNode(node)).length;
        const allChecked = totalNodes > 0 && checkedNodes.size === totalNodes;

        container.innerHTML = `
    <div class="tree-header">
      <h2>${title}</h2>
      <div class="header-actions">
        <button class="btn-secondary" onclick="window.treeActions_${tableName}.print()" title="Imprimir / Salvar PDF">🖨️ PDF</button>
        <button class="btn-secondary" onclick="window.treeActions_${tableName}.export()" title="Exportar para Excel">📊 Excel</button>
        <button class="btn-primary" onclick="window.treeActions_${tableName}.addRoot()">+ Nova ${term}</button>
      </div>
    </div>
    
    <div class="tree-controls" style="display: flex; gap: 1rem; align-items: center; padding: 0.5rem var(--row-padding-horizontal); background: var(--color-bg-secondary); border-radius: 8px; margin-bottom: 1rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <div style="width: 20px; display: flex; justify-content: center; flex-shrink: 0;">
            <input type="checkbox" 
                   id="master-checkbox-${tableName}" 
                   ${allChecked ? 'checked' : ''}
                   onchange="window.treeActions_${tableName}.toggleAll(this.checked)"
                   style="cursor: pointer; width: 18px; height: 18px; margin: 0;"
            />
        </div>
        <label for="master-checkbox-${tableName}" style="cursor: pointer; font-weight: 500; margin: 0;">Selecionar Todos</label>
      </div>

      <button class="btn-secondary" 
              onclick="window.treeActions_${tableName}.toggleHide()"
              title="Ocultar itens desmarcados da visualização"
              style="white-space: nowrap; ${hideUnchecked ? 'background: var(--color-primary); color: white;' : ''}">
        ${hideUnchecked ? '👁️ Mostrar Todos' : '🚫 Ocultar Desmarcados'}
      </button>

      <!-- Search Section: Fixed Width + Save View Button -->
      <div style="display: flex; align-items: center; gap: 0.5rem; position: relative; border-left: 1px solid var(--color-border-light); padding-left: 1rem;">
        <button onclick="window.treeActions_${tableName}.triggerSearch()" 
                style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0;"
                title="Buscar">
            🔍
        </button>
        <input type="text" 
               id="search-input-${tableName}" 
               placeholder="Buscar..."
               value="${searchQuery}"
               onkeydown="if(event.key === 'Enter') window.treeActions_${tableName}.triggerSearch()"
               style="width: 250px; padding: 0.5rem; border: 1px solid var(--color-border-light); border-radius: 6px; font-size: 0.9rem;"
        />
        ${searchQuery ? `
          <button onclick="document.getElementById('search-input-${tableName}').value = ''; window.treeActions_${tableName}.triggerSearch();" 
                  style="position: absolute; right: 45px; background: none; border: none; cursor: pointer; font-size: 1.2rem; color: var(--color-text-muted);" 
                  title="Limpar busca">✕</button>
        ` : ''}

        <button onclick="window.treeActions_${tableName}.saveView()" 
                class="btn-secondary"
                style="padding: 0.5rem 0.5rem; margin-left: 5px;"
                title="Salvar Visualização Atual">
          💾
        </button>
      </div>
      
      <div style="flex: 1; text-align: right; font-size: 0.85rem; color: var(--color-text-muted); white-space: nowrap;">
        ${visibleNodes} de ${totalNodes} itens
      </div>
    </div>
    
    <div class="tree-wrapper" id="tree-root-dropzone">
      ${hideUnchecked
                // If filtering unchecked, show flattened list of selected leaves (no folders)
                ? getVisibleLeaves(treeData).map(node => renderNode(node, 0)).join('')
                // Otherwise normal hierarchical tree
                : treeData.map(node => renderNode(node)).join('')}
      ${(hideUnchecked ? getVisibleLeaves(treeData).length : treeData.length) === 0 ? 'Nenhum item cadastrado' : ''}
    </div>
  `;

        const nodes = container.querySelectorAll('.tree-node-content');
        nodes.forEach(node => {
            const id = node.parentElement.dataset.id;
            node.addEventListener('dragstart', (e) => handleDragStart(e, id));
            node.addEventListener('dragover', handleDragOver);
            node.addEventListener('dragleave', handleDragLeave);
            node.addEventListener('drop', (e) => handleDrop(e, id));
        });

        const rootZone = document.getElementById('tree-root-dropzone');
        if (rootZone) {
            rootZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!e.target.closest('.tree-node-content')) {
                    rootZone.classList.add('drag-over-root');
                }
            });
            rootZone.addEventListener('dragleave', () => rootZone.classList.remove('drag-over-root'));
            rootZone.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!e.target.closest('.tree-node-content')) {
                    handleDrop(e, 'root');
                    rootZone.classList.remove('drag-over-root');
                }
            });
        }
    };

    // Public API
    return {
        render: () => {
            return `
    <div id="tree-manager" class="glass-panel" style="margin: var(--space-md); padding: var(--space-md); height: calc(100vh - 80px); overflow: hidden; display: flex; flex-direction: column;">
      <div id="tree-loading" style="display: none; text-align: center; padding: 2rem;">
        <p>Carregando...</p>
      </div>
      <div id="tree-error" style="display: none; text-align: center; padding: 2rem; color: #ef4444;">
        <p>Erro ao carregar dados. Verifique se o backend está rodando.</p>
      </div>
      <div id="tree-container" style="flex: 1; overflow-y: auto;"></div>
    </div>
  `;
        },

        init: () => {
            window[`treeActions_${tableName}`] = {
                addRoot: async () => {
                    const label = await Dialogs.prompt('', '', `Nova ${term}`);
                    if (label) addNode(null, label);
                },
                addChild: async (parentId) => {
                    const label = await Dialogs.prompt('', '', `Nova Sub-${term}`);
                    if (label) addNode(parentId, label);
                },
                edit: async (id) => {
                    const node = findNode(treeData, id);
                    if (node) {
                        const label = await Dialogs.prompt('', node.label, `Editar ${term}`);
                        if (label) updateNode(id, label);
                    }
                },
                delete: (id) => {
                    // No confirmation for delete as requested
                    deleteNodeAPI(id);
                },
                reactivate: async (id) => {
                    if (await Dialogs.confirm('Deseja reativar este item?', 'Reativar')) {
                        await reactivateNode(id);
                    }
                },
                toggle: toggleNode,
                indent: indentNode,
                outdent: outdentNode,
                toggleCheckbox: toggleCheckbox,
                toggleAll: toggleAllCheckboxes,
                triggerSearch: triggerSearch,
                toggleHide: toggleHideUnchecked,
                print: () => {
                    PrintHelper.autoConfigureOrientation('#tree-container');
                    window.print();
                },
                export: exportToCSV
            };

            loadTreeData();
        }
    };
};
