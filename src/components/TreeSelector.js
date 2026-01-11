export const TreeSelector = {
    render(container, data, selectedId, onSelect, allowedIds = null) {
        // State for search
        let searchQuery = '';
        const allowedSet = allowedIds ? (allowedIds instanceof Set ? allowedIds : new Set(allowedIds.map(String))) : null;

        // Container implementation
        container.innerHTML = '';

        // Styling
        const style = document.createElement('style');
        style.textContent = `
            .tree-selector-wrapper {
                display: flex;
                flex-direction: column;
                border: 1px solid var(--color-border-light);
                border-radius: 8px;
                background: var(--color-bg-secondary);
                height: 100%;
                overflow: hidden;
            }
            .ts-search-container {
                padding: 4px 8px;
                border-bottom: 1px solid var(--color-border-light);
                background: white;
                display: flex;
                align-items: center;
                gap: 5px;
                height: 36px;
                flex-shrink: 0;
            }
            .ts-search-input {
                flex: 1;
                border: none;
                outline: none;
                font-size: 0.85rem;
                padding: 2px 4px;
            }
            .ts-search-icon {
                color: #9CA3AF;
                font-size: 0.85rem;
            }
            .ts-clear-btn {
                background: none;
                border: none;
                cursor: pointer;
                color: #9CA3AF;
                padding: 0 4px;
                font-size: 0.8rem;
            }
            .tree-selector-scroll {
                flex: 1;
                overflow: auto;
                padding: 0.5rem;
                white-space: nowrap;
            }
            .ts-node {
                margin-left: 1.2rem;
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
                font-size: 0.85rem;
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
            .tree-selector-wrapper.input-error {
                background-color: #FEF2F2 !important;
                border: 2px solid #EF4444 !important;
            }
            .ts-match {
                background-color: #fef08a;
                color: black;
                border-radius: 2px;
            }
        `;
        container.appendChild(style);

        const wrapper = document.createElement('div');
        wrapper.className = 'tree-selector-wrapper';

        const searchContainer = document.createElement('div');
        searchContainer.className = 'ts-search-container';
        searchContainer.innerHTML = `
            <span class="ts-search-icon">🔍</span>
            <input type="text" class="ts-search-input" placeholder="Buscar tipo...">
            <button class="ts-clear-btn" style="display:none;">✕</button>
        `;

        const searchInput = searchContainer.querySelector('.ts-search-input');
        const clearBtn = searchContainer.querySelector('.ts-clear-btn');

        const treeScroll = document.createElement('div');
        treeScroll.className = 'tree-selector-scroll';

        wrapper.appendChild(searchContainer);
        wrapper.appendChild(treeScroll);
        container.appendChild(wrapper);

        // Build Tree Structure
        const buildTree = (flatData) => {
            const map = {};
            const roots = [];
            flatData.forEach(node => { map[node.id] = { ...node, children: [] }; });
            flatData.forEach(node => {
                if (node.parent_id === null) roots.push(map[node.id]);
                else if (map[node.parent_id]) map[node.parent_id].children.push(map[node.id]);
            });
            const sortByOrdem = (nodes) => {
                nodes.sort((a, b) => a.ordem - b.ordem);
                nodes.forEach(node => { if (node.children.length > 0) sortByOrdem(node.children); });
            };
            sortByOrdem(roots);
            return roots;
        };

        const treeRoots = buildTree(data);

        // Recursive reveal helper (to find if node or any child matches)
        const checkVisibility = (node, query) => {
            const matchesSearch = !query || node.label.toLowerCase().includes(query.toLowerCase());
            const matchesAllowed = !allowedSet || allowedSet.has(String(node.id));

            let childrenVisible = false;
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    if (checkVisibility(child, query)) childrenVisible = true;
                });
            }

            // Visible if: (Matches search OR has visible children) AND (Matches allowed OR has visible children)
            // But simplified: 
            // 1. If matches search -> visible
            // 2. If has visible children -> visible and expanded
            node.matchesSearch = matchesSearch;
            node.visibleBySearch = matchesSearch || childrenVisible;
            node.visibleByAllowed = matchesAllowed || childrenVisible;
            node.isVisible = node.visibleBySearch && node.visibleByAllowed;

            if (childrenVisible && query) node.expanded = true;
            else if (!query) node.expanded = false; // Collapse all when search is cleared

            return node.isVisible;
        };

        const renderTreeContent = (query = '') => {
            treeScroll.innerHTML = '';
            searchQuery = query;

            // Re-calculate visibility
            treeRoots.forEach(root => checkVisibility(root, query));

            const renderNode = (node) => {
                if (!node.isVisible) return null;

                const hasChildren = node.children && node.children.length > 0;
                const isLeaf = !hasChildren;
                const isSelected = String(node.id) === String(selectedId);
                const isExpanded = node.expanded || false;

                const nodeEl = document.createElement('div');
                nodeEl.className = `ts-node ${node.parent_id === null ? 'ts-root' : ''}`;

                const content = document.createElement('div');
                content.className = `ts-content ${isLeaf ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`;

                let labelHtml = node.label;
                if (query && node.label.toLowerCase().includes(query.toLowerCase())) {
                    const idx = node.label.toLowerCase().indexOf(query.toLowerCase());
                    const match = node.label.substr(idx, query.length);
                    labelHtml = node.label.replace(new RegExp(query, 'gi'), `<span class="ts-match">${match}</span>`);
                }

                content.innerHTML = `
                    ${hasChildren ? `<span class="ts-toggle">${isExpanded ? '▼' : '▶'}</span>` : `<span class="ts-toggle" style="opacity:0">•</span>`}
                    <span class="ts-icon">${hasChildren ? '📁' : '📄'}</span>
                    <span class="ts-label">${labelHtml}</span>
                `;

                if (isLeaf) {
                    content.onclick = () => {
                        treeScroll.querySelectorAll('.ts-content.selected').forEach(el => el.classList.remove('selected'));
                        content.classList.add('selected');
                        onSelect(node.id);
                    };
                } else {
                    const toggleBtn = content.querySelector('.ts-toggle');
                    const toggleAction = (e) => {
                        if (e) e.stopPropagation();
                        const childrenContainer = nodeEl.querySelector('.ts-children');
                        if (childrenContainer) {
                            const isHidden = childrenContainer.style.display === 'none';
                            childrenContainer.style.display = isHidden ? 'block' : 'none';
                            toggleBtn.textContent = isHidden ? '▼' : '▶';
                        }
                    };
                    toggleBtn.onclick = toggleAction;
                    // If not search mode, allow clicking label to toggle folders too? 
                    // No, following existing convention where only leaf is selectable.
                }

                nodeEl.appendChild(content);

                if (hasChildren) {
                    const childrenContainer = document.createElement('div');
                    childrenContainer.className = 'ts-children';
                    childrenContainer.style.display = isExpanded ? 'block' : 'none';
                    node.children.forEach(child => {
                        const childEl = renderNode(child);
                        if (childEl) childrenContainer.appendChild(childEl);
                    });
                    nodeEl.appendChild(childrenContainer);
                }

                return nodeEl;
            };

            const fragment = document.createDocumentFragment();
            let renderedCount = 0;
            treeRoots.forEach(root => {
                const rootEl = renderNode(root);
                if (rootEl) {
                    fragment.appendChild(rootEl);
                    renderedCount++;
                }
            });

            if (renderedCount === 0) {
                treeScroll.innerHTML = `<div style="padding:1rem; text-align:center; color:#999; font-size:0.85rem;">${query ? 'Nenhum resultado encontrado' : 'Nenhum item disponível'}</div>`;
            } else {
                treeScroll.appendChild(fragment);
            }
        };

        // Initial render
        renderTreeContent();

        // Search events
        searchInput.oninput = (e) => {
            const query = e.target.value.trim();
            clearBtn.style.display = query ? 'block' : 'none';
            renderTreeContent(query);
        };

        clearBtn.onclick = () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            renderTreeContent('');
        };
    }
};
