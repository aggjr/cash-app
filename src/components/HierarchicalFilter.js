/**
 * HierarchicalFilter - Reusable hierarchical multi-select filter component
 * 
 * Usage:
 * const filter = new HierarchicalFilter({
 *   container: document.getElementById('filter-container'),
 *   data: [
 *     {
 *       id: 'parent-1',
 *       label: 'Parent Name',
 *       children: [
 *         { id: 'child-1', label: 'Child Name' },
 *         { id: 'child-2', label: 'Child Name 2' }
 *       ]
 *     }
 *   ],
 *   selectedIds: [],
 *   onChange: (selectedIds) => { console.log(selectedIds); },
 *   placeholder: 'Select items...'
 * });
 */

export class HierarchicalFilter {
    constructor({ container, data, selectedIds = [], onChange, placeholder = 'Selecione...' }) {
        this.container = container;
        this.data = data;

        // If no selectedIds provided, select all by default
        if (selectedIds.length === 0) {
            const allIds = [];
            data.forEach(parent => {
                parent.children.forEach(child => {
                    allIds.push(child.id);
                });
            });
            this.selectedIds = new Set(allIds);
        } else {
            this.selectedIds = new Set(selectedIds);
        }

        this.onChange = onChange;
        this.placeholder = placeholder;
        this.expandedParents = new Set();

        this.render();
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'hierarchical-filter';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.minWidth = '250px';

        // Display button
        const button = document.createElement('button');
        button.className = 'hierarchical-filter-button';
        button.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: var(--color-bg-primary, white);
            border: 1px solid var(--color-border, #d1d5db);
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9rem;
            color: var(--color-text-primary, #1f2937);
        `;

        const buttonText = document.createElement('span');
        buttonText.textContent = this.getButtonText();

        const arrow = document.createElement('span');
        arrow.textContent = '▼';
        arrow.style.fontSize = '0.7rem';
        arrow.style.marginLeft = '8px';

        button.appendChild(buttonText);
        button.appendChild(arrow);

        // Dropdown panel
        const panel = document.createElement('div');
        panel.className = 'hierarchical-filter-panel';
        panel.style.cssText = `
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            background: var(--color-bg-primary, white);
            border: 1px solid var(--color-border, #d1d5db);
            border-radius: 6px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            max-height: 400px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        `;

        // Render hierarchy
        this.data.forEach(parent => {
            const parentItem = this.renderParentItem(parent);
            panel.appendChild(parentItem);
        });

        // Toggle panel
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = panel.style.display === 'block';
            panel.style.display = isVisible ? 'none' : 'block';
            arrow.textContent = isVisible ? '▼' : '▲';
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                panel.style.display = 'none';
                arrow.textContent = '▼';
            }
        });

        wrapper.appendChild(button);
        wrapper.appendChild(panel);

        this.container.innerHTML = '';
        this.container.appendChild(wrapper);

        this.button = button;
        this.buttonText = buttonText;
    }

    renderParentItem(parent) {
        const container = document.createElement('div');
        container.style.borderBottom = '1px solid var(--color-border-light, #e5e7eb)';

        // Parent row
        const parentRow = document.createElement('div');
        parentRow.style.cssText = `
            padding: 10px 12px;
            display: flex;
            align-items: center;
            cursor: pointer;
            background: var(--color-bg-secondary, #f9fafb);
            font-weight: 600;
            user-select: none;
        `;

        const expandIcon = document.createElement('span');
        expandIcon.style.cssText = `
            margin-right: 8px;
            font-size: 1rem;
            font-weight: bold;
            transition: transform 0.2s;
            font-family: monospace;
        `;
        expandIcon.textContent = this.expandedParents.has(parent.id) ? '−' : '+';

        const parentCheckbox = document.createElement('input');
        parentCheckbox.type = 'checkbox';
        parentCheckbox.style.marginRight = '8px';
        parentCheckbox.checked = this.isParentSelected(parent);
        parentCheckbox.indeterminate = this.isParentIndeterminate(parent);

        const parentLabel = document.createElement('span');
        parentLabel.textContent = parent.label;
        parentLabel.style.flex = '1';

        parentRow.appendChild(expandIcon);
        parentRow.appendChild(parentCheckbox);
        parentRow.appendChild(parentLabel);

        // Children container
        const childrenContainer = document.createElement('div');
        childrenContainer.style.cssText = `
            display: ${this.expandedParents.has(parent.id) ? 'block' : 'none'};
            background: var(--color-bg-primary, white);
        `;

        parent.children.forEach(child => {
            const childRow = this.renderChildItem(child, parent);
            childrenContainer.appendChild(childRow);
        });

        // Toggle expand/collapse
        parentRow.addEventListener('click', (e) => {
            if (e.target === parentCheckbox) return;

            if (this.expandedParents.has(parent.id)) {
                this.expandedParents.delete(parent.id);
                expandIcon.textContent = '+';
                childrenContainer.style.display = 'none';
            } else {
                this.expandedParents.add(parent.id);
                expandIcon.textContent = '−';
                childrenContainer.style.display = 'block';
            }
        });

        // Parent checkbox toggle
        parentCheckbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const isChecked = parentCheckbox.checked;

            parent.children.forEach(child => {
                if (isChecked) {
                    this.selectedIds.add(child.id);
                } else {
                    this.selectedIds.delete(child.id);
                }
            });

            this.updateButtonText();
            this.notifyChange();
        });

        container.appendChild(parentRow);
        container.appendChild(childrenContainer);

        return container;
    }

    renderChildItem(child, parent) {
        const childRow = document.createElement('div');
        childRow.style.cssText = `
            padding: 8px 12px 8px 40px;
            display: flex;
            align-items: center;
            cursor: pointer;
            user-select: none;
        `;

        childRow.addEventListener('mouseenter', () => {
            childRow.style.background = 'var(--color-bg-hover, #f3f4f6)';
        });

        childRow.addEventListener('mouseleave', () => {
            childRow.style.background = 'transparent';
        });

        const childCheckbox = document.createElement('input');
        childCheckbox.type = 'checkbox';
        childCheckbox.style.marginRight = '8px';
        childCheckbox.checked = this.selectedIds.has(child.id);

        const childLabel = document.createElement('span');
        childLabel.textContent = child.label;
        childLabel.style.fontSize = '0.9rem';

        childRow.appendChild(childCheckbox);
        childRow.appendChild(childLabel);

        childRow.addEventListener('click', (e) => {
            e.stopPropagation();

            // If clicking directly on checkbox, let it handle itself
            if (e.target === childCheckbox) {
                return;
            }

            childCheckbox.checked = !childCheckbox.checked;

            if (childCheckbox.checked) {
                this.selectedIds.add(child.id);
            } else {
                this.selectedIds.delete(child.id);
            }

            this.updateButtonText();
            this.notifyChange();
        });

        // Also handle direct checkbox clicks
        childCheckbox.addEventListener('change', (e) => {
            e.stopPropagation();

            if (childCheckbox.checked) {
                this.selectedIds.add(child.id);
            } else {
                this.selectedIds.delete(child.id);
            }

            this.updateButtonText();
            this.notifyChange();
        });

        return childRow;
    }

    isParentSelected(parent) {
        return parent.children.every(child => this.selectedIds.has(child.id));
    }

    isParentIndeterminate(parent) {
        const selectedCount = parent.children.filter(child => this.selectedIds.has(child.id)).length;
        return selectedCount > 0 && selectedCount < parent.children.length;
    }

    getButtonText() {
        const count = this.selectedIds.size;
        if (count === 0) return this.placeholder;
        if (count === 1) return '1 item selecionado';
        return `${count} itens selecionados`;
    }

    updateButtonText() {
        if (this.buttonText) {
            this.buttonText.textContent = this.getButtonText();
        }
    }

    updateDisplay() {
        this.buttonText.textContent = this.getButtonText();
        this.render();
    }

    notifyChange() {
        if (this.onChange) {
            this.onChange(Array.from(this.selectedIds));
        }
    }

    getSelectedIds() {
        return Array.from(this.selectedIds);
    }

    setSelectedIds(ids) {
        this.selectedIds = new Set(ids);
        this.updateButtonText();
    }
}
