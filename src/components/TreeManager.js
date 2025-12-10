import api from '../services/api.js';

export const TreeManager = () => {
    return `
    <div id="tree-manager" class="glass-panel" style="margin: var(--space-md); padding: var(--space-md); height: calc(100vh - 150px); overflow: hidden; display: flex; flex-direction: column;">
      <div id="tree-loading" style="display: none; text-align: center; padding: 2rem;">
        <p>Carregando...</p>
      </div>
      <div id="tree-error" style="display: none; text-align: center; padding: 2rem; color: #ef4444;">
        <p>Erro ao carregar dados. Verifique se o backend está rodando.</p>
      </div>
      <div id="tree-container" style="flex: 1; overflow-y: auto;"></div>
    </div>
  `;
};

// State management
let treeData = [];
let draggedNodeId = null;

// Convert flat array to tree structure
const buildTree = (flatData) => {
    const map = {};
    const roots = [];

    // Create map of all nodes
    flatData.forEach(node => {
        map[node.id] = { ...node, children: [] };
    });

    // Build tree structure
    flatData.forEach(node => {
        if (node.parent_id === null) {
            roots.push(map[node.id]);
        } else if (map[node.parent_id]) {
            map[node.parent_id].children.push(map[node.id]);
        }
    });

    // Sort by ordem
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

        const flatData = await api.getTipoEntrada();
        treeData = buildTree(flatData);

        if (loadingEl) loadingEl.style.display = 'none';
        if (containerEl) containerEl.style.display = 'block';

        renderTree();
    } catch (error) {
        console.error('Error loading tree data:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'block';
    }
};

// Helper functions
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

// CRUD Operations with API
const addNode = async (parentId, label) => {
    try {
        const parent = parentId ? findNode(treeData, parentId) : null;
        const ordem = parent ? parent.children.length : treeData.length;

        await api.createTipoEntrada({
            label,
            parent_id: parentId,
            ordem,
            expanded: true
        });

        await loadTreeData();
    } catch (error) {
        console.error('Error adding node:', error);
        alert('Erro ao criar categoria');
    }
};

const updateNode = async (id, newLabel) => {
    try {
        const node = findNode(treeData, id);
        if (node) {
            await api.updateTipoEntrada(id, {
                label: newLabel,
                parent_id: node.parent_id,
                ordem: node.ordem,
                expanded: node.expanded
            });
            await loadTreeData();
        }
    } catch (error) {
        console.error('Error updating node:', error);
        alert('Erro ao atualizar categoria');
    }
};

const deleteNodeAPI = async (id) => {
    try {
        await api.deleteTipoEntrada(id);
        await loadTreeData();
    } catch (error) {
        console.error('Error deleting node:', error);
        alert('Erro ao excluir categoria');
    }
};

const toggleNode = async (id) => {
    try {
        const node = findNode(treeData, id);
        if (node) {
            await api.updateTipoEntrada(id, {
                label: node.label,
                parent_id: node.parent_id,
                ordem: node.ordem,
                expanded: !node.expanded
            });
            await loadTreeData();
        }
    } catch (error) {
        console.error('Error toggling node:', error);
    }
};

// Indent/Outdent operations
const indentNode = async (id) => {
    try {
        // Find node and get previous sibling
        let parentId = null;
        let nodeIndex = -1;
        let parentNode = null;

        // Check root level
        nodeIndex = treeData.findIndex(n => n.id == id);
        if (nodeIndex !== -1 && nodeIndex > 0) {
            const newParent = treeData[nodeIndex - 1];
            await api.moveTipoEntrada(id, {
                parent_id: newParent.id,
                ordem: newParent.children ? newParent.children.length : 0
            });
            await loadTreeData();
            return;
        }

        // Check nested levels
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
            const newParent = result.parent.children[result.index - 1];
            await api.moveTipoEntrada(id, {
                parent_id: newParent.id,
                ordem: newParent.children ? newParent.children.length : 0
            });
            await loadTreeData();
        }
    } catch (error) {
        console.error('Error indenting node:', error);
        alert('Erro ao mover categoria');
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
            await api.moveTipoEntrada(id, {
                parent_id: newParentId,
                ordem: 0
            });
            await loadTreeData();
        }
    } catch (error) {
        console.error('Error outdenting node:', error);
        alert('Erro ao mover categoria');
    }
};

// Drag and Drop Logic
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

        // Check circular reference
        if (findNode(nodeToMove.children || [], targetId)) {
            alert('Não é possível mover uma pasta para dentro de si mesma.');
            return;
        }

        if (targetId === 'root') {
            await api.moveTipoEntrada(draggedNodeId, {
                parent_id: null,
                ordem: treeData.length
            });
        } else {
            const targetNode = findNode(treeData, targetId);
            await api.moveTipoEntrada(draggedNodeId, {
                parent_id: targetId,
                ordem: targetNode.children ? targetNode.children.length : 0
            });
        }

        await loadTreeData();
    } catch (error) {
        console.error('Error moving node:', error);
        alert('Erro ao mover categoria');
    }
};

// Rendering
const renderNode = (node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;

    return `
    <div class="tree-node" data-id="${node.id}" style="margin-left: ${level * 20}px">
      <div class="tree-node-content" draggable="true">
        <span class="node-toggle" onclick="window.treeActions.toggle(${node.id})">
          ${hasChildren ? (node.expanded ? '▼' : '▶') : '•'}
        </span>
        <span class="node-icon">${hasChildren ? '📁' : '📄'}</span>
        <span class="node-label" onclick="window.treeActions.edit(${node.id})">${node.label}</span>
        <div class="node-actions">
          <button onclick="window.treeActions.outdent(${node.id})" title="Outdent (Left)" class="btn-arrow">⬅️</button>
          <button onclick="window.treeActions.indent(${node.id})" title="Indent (Right)" class="btn-arrow">➡️</button>
          <button onclick="window.treeActions.addChild(${node.id})" title="Add Sub-item">➕</button>
          <button onclick="window.treeActions.edit(${node.id})" title="Edit">✏️</button>
          <button onclick="window.treeActions.delete(${node.id})" title="Delete" class="btn-delete">🗑️</button>
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

const renderTree = () => {
    const container = document.getElementById('tree-container');
    if (!container) return;

    container.innerHTML = `
    <div class="tree-header">
      <h2>Tipo Entrada</h2>
      <button class="btn-primary" onclick="window.treeActions.addRoot()">+ Nova Categoria</button>
    </div>
    <div class="tree-wrapper" id="tree-root-dropzone">
      ${treeData.map(node => renderNode(node)).join('')}
      ${treeData.length === 0 ? '<div class="empty-state">Nenhum item cadastrado</div>' : ''}
    </div>
  `;

    // Re-attach event listeners for DnD
    const nodes = container.querySelectorAll('.tree-node-content');
    nodes.forEach(node => {
        const id = node.parentElement.dataset.id;
        node.addEventListener('dragstart', (e) => handleDragStart(e, id));
        node.addEventListener('dragover', handleDragOver);
        node.addEventListener('dragleave', handleDragLeave);
        node.addEventListener('drop', (e) => handleDrop(e, id));
    });

    // Root dropzone
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

export const initTreeManager = () => {
    // Expose actions
    window.treeActions = {
        addRoot: () => {
            const label = prompt('Nome da nova categoria:');
            if (label) addNode(null, label);
        },
        addChild: (parentId) => {
            const label = prompt('Nome da sub-categoria:');
            if (label) addNode(parentId, label);
        },
        edit: (id) => {
            const node = findNode(treeData, id);
            if (node) {
                const label = prompt('Novo nome:', node.label);
                if (label) updateNode(id, label);
            }
        },
        delete: (id) => {
            if (confirm('Tem certeza que deseja excluir este item e seus filhos?')) {
                deleteNodeAPI(id);
            }
        },
        toggle: toggleNode,
        indent: indentNode,
        outdent: outdentNode
    };

    // Load initial data
    loadTreeData();
};
