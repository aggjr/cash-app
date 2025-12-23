export const TreeSelector = {
    render(container, data, selectedId, onSelect) {
        // Build Tree Structure
        const buildTree = (flatData) => {
            const map = {};
            const roots = [];

            // First pass: create nodes
            flatData.forEach(node => {
                map[node.id] = { ...node, children: [] };
            });

            // Second pass: link parents
            flatData.forEach(node => {
                if (node.parent_id === null) {
                    roots.push(map[node.id]);
                } else if (map[node.parent_id]) {
                    map[node.parent_id].children.push(map[node.id]);
                }
            });

            // Sort by 'ordem'
            const sortByOrdem = (nodes) => {
                nodes.sort((a, b) => a.ordem - b.ordem);
                nodes.forEach(node => {
                    if (node.children.length > 0) sortByOrdem(node.children);
                });
            };

            sortByOrdem(roots);
            return roots;
        };

        const treeRoots = buildTree(data);

        // Styling
        const style = document.createElement('style');
        style.textContent = `
            .tree-selector {
                border: 1px solid var(--color-border-light);
                border-radius: 8px;
                max-height: 200px;
                overflow: auto;
                background: var(--color-bg-secondary);
                padding: 0.5rem;
                white-space: nowrap;
            }
            .ts-node {
                margin-left: 1.2rem;
                position: relative;
            }
            .ts-root {
                margin-left: 0;
            }
            .ts-content {
                display: flex;
                align-items: center;
                padding: 0.25rem 0.5rem;
                cursor: default;
                border-radius: 4px;
                transition: background 0.2s;
            }
            .ts-content.selectable {
                cursor: pointer;
            }
            .ts-content.selectable:hover {
                background: rgba(47, 108, 129, 0.1);
            }
            .ts-content.selected {
                background: var(--color-primary);
                color: white;
            }
            .ts-icon {
                margin-right: 0.5rem;
                font-size: 0.9rem;
                width: 16px;
                display: flex;
                justify-content: center;
            }
            .ts-label {
                font-size: 0.9rem;
            }
            .ts-toggle {
                margin-right: 0.25rem;
                cursor: pointer;
                width: 16px;
                text-align: center;
                color: var(--color-text-muted);
                font-size: 0.8rem;
            }
            .ts-toggle:hover {
                color: var(--color-primary);
            }
            .tree-selector.input-error {
                background-color: #FEF2F2 !important;
                border: 2px solid #EF4444 !important;
            }
        `;
        container.appendChild(style);

        const treeContainer = document.createElement('div');
        treeContainer.className = 'tree-selector';

        const renderNode = (node) => {
            const hasChildren = node.children && node.children.length > 0;
            const isLeaf = !hasChildren;
            const isSelected = node.id === selectedId;

            const nodeEl = document.createElement('div');
            nodeEl.className = `ts-node ${node.parent_id === null ? 'ts-root' : ''}`;

            // Check expansion state (defaults to expanded)
            // Use a dataset or internal state if we want to persist toggle over re-renders, 
            // but for simple selector, default expanded is usually fine.

            const content = document.createElement('div');
            content.className = `ts-content ${isLeaf ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`;

            content.innerHTML = `
                ${hasChildren ? `<span class="ts-toggle">▼</span>` : `<span class="ts-toggle" style="opacity:0">•</span>`}
                <span class="ts-icon">${hasChildren ? '📁' : '📄'}</span>
                <span class="ts-label">${node.label}</span>
            `;

            if (isLeaf) {
                content.addEventListener('click', () => {
                    // Deselect previous
                    container.querySelectorAll('.ts-content.selected').forEach(el => el.classList.remove('selected'));
                    content.classList.add('selected');
                    onSelect(node.id);
                });
            } else {
                // Toggle expansion
                const toggleBtn = content.querySelector('.ts-toggle');
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const childrenContainer = nodeEl.querySelector('.ts-children');
                    if (childrenContainer) {
                        const isHidden = childrenContainer.style.display === 'none';
                        childrenContainer.style.display = isHidden ? 'block' : 'none';
                        toggleBtn.textContent = isHidden ? '▼' : '▶';
                    }
                });
            }

            nodeEl.appendChild(content);

            if (hasChildren) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'ts-children';
                node.children.forEach(child => {
                    childrenContainer.appendChild(renderNode(child));
                });
                nodeEl.appendChild(childrenContainer);
            }

            return nodeEl;
        };

        if (treeRoots.length === 0) {
            treeContainer.innerHTML = '<div style="padding:1rem; text-align:center; color:#999;">Nenhum tipo cadastrado</div>';
        } else {
            treeRoots.forEach(root => {
                treeContainer.appendChild(renderNode(root));
            });
        }

        container.appendChild(treeContainer);
    }
};
