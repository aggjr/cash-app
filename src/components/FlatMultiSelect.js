/**
 * FlatMultiSelect - Reusable flat multi-select filter component
 * 
 * Usage:
 * const filter = new FlatMultiSelect({
 *   container: document.getElementById('filter-container'),
 *   data: [
 *     { id: 1, label: 'Company A' },
 *     { id: 2, label: 'Company B' }
 *   ],
 *   selectedIds: [], // Optional, defaults to all if empty
 *   onChange: (selectedIds) => { console.log(selectedIds); },
 *   placeholder: 'Selecione...'
 * });
 */

export class FlatMultiSelect {
    constructor({ container, data, selectedIds = [], onChange, placeholder = 'Selecione...' }) {
        this.container = container;
        this.data = data; // Array of { id, label }

        // If no selectedIds provided, select all by default
        if (selectedIds.length === 0) {
            this.selectedIds = new Set(data.map(item => item.id));
        } else {
            this.selectedIds = new Set(selectedIds);
        }

        this.onChange = onChange;
        this.placeholder = placeholder;

        this.render();
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flat-multiselect';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.minWidth = '250px';

        // Button
        const button = document.createElement('button');
        button.className = 'flat-multiselect-button';
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

        // Panel
        const panel = document.createElement('div');
        panel.className = 'flat-multiselect-panel';
        panel.style.cssText = `
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            background: var(--color-bg-primary, white);
            border: 1px solid var(--color-border, #d1d5db);
            border-radius: 6px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        `;

        // "Select All" Option
        const selectAllRow = document.createElement('div');
        selectAllRow.style.cssText = `
            padding: 8px 12px;
            display: flex;
            align-items: center;
            cursor: pointer;
            background: var(--color-bg-secondary, #f9fafb);
            border-bottom: 1px solid #e5e7eb;
            font-weight: 600;
            user-select: none;
        `;

        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.style.marginRight = '8px';
        selectAllCheckbox.checked = this.selectedIds.size === this.data.length;
        selectAllCheckbox.indeterminate = this.selectedIds.size > 0 && this.selectedIds.size < this.data.length;

        const selectAllLabel = document.createElement('span');
        selectAllLabel.textContent = 'Todas';
        selectAllLabel.style.fontSize = '0.9rem';

        selectAllRow.appendChild(selectAllCheckbox);
        selectAllRow.appendChild(selectAllLabel);

        // Select All Events
        const toggleAll = (forceState = null) => {
            const newState = forceState !== null ? forceState : !selectAllCheckbox.checked;

            if (newState) {
                this.selectedIds = new Set(this.data.map(i => i.id));
            } else {
                this.selectedIds.clear();
            }

            selectAllCheckbox.checked = newState;
            selectAllCheckbox.indeterminate = false;

            // Update all child checkboxes
            panel.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = newState);

            this.updateButtonText();
            this.notifyChange();
        };

        selectAllRow.addEventListener('click', (e) => {
            if (e.target !== selectAllCheckbox) toggleAll(!selectAllCheckbox.checked);
        });

        selectAllCheckbox.addEventListener('change', () => toggleAll(selectAllCheckbox.checked));

        panel.appendChild(selectAllRow);

        // Items
        this.data.forEach(item => {
            const row = document.createElement('div');
            row.style.cssText = `
                padding: 8px 12px;
                display: flex;
                align-items: center;
                cursor: pointer;
                user-select: none;
            `;

            row.addEventListener('mouseenter', () => row.style.background = '#f3f4f6');
            row.addEventListener('mouseleave', () => row.style.background = 'transparent');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'item-checkbox';
            checkbox.style.marginRight = '8px';
            checkbox.checked = this.selectedIds.has(item.id);

            const label = document.createElement('span');
            label.textContent = item.label;
            label.style.fontSize = '0.9rem';

            row.appendChild(checkbox);
            row.appendChild(label);

            const toggleItem = () => {
                const newState = !checkbox.checked;
                checkbox.checked = newState;

                if (newState) this.selectedIds.add(item.id);
                else this.selectedIds.delete(item.id);

                // Update Select All state
                const allSelected = this.selectedIds.size === this.data.length;
                const someSelected = this.selectedIds.size > 0;

                selectAllCheckbox.checked = allSelected;
                selectAllCheckbox.indeterminate = someSelected && !allSelected;

                this.updateButtonText();
                this.notifyChange();
            };

            row.addEventListener('click', (e) => {
                if (e.target !== checkbox) toggleItem();
            });

            checkbox.addEventListener('change', () => {
                // Determine state was already changed by browser click
                if (checkbox.checked) this.selectedIds.add(item.id);
                else this.selectedIds.delete(item.id);

                const allSelected = this.selectedIds.size === this.data.length;
                const someSelected = this.selectedIds.size > 0;

                selectAllCheckbox.checked = allSelected;
                selectAllCheckbox.indeterminate = someSelected && !allSelected;

                this.updateButtonText();
                this.notifyChange();
            });

            panel.appendChild(row);
        });

        // Toggle panel logic
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = panel.style.display === 'block';
            panel.style.display = isVisible ? 'none' : 'block';
            arrow.textContent = isVisible ? '▼' : '▲';
        });

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

        this.buttonText = buttonText;
    }

    getButtonText() {
        const count = this.selectedIds.size;
        if (count === 0) return this.placeholder;
        if (count === this.data.length) return 'Todas as Empresas';
        if (count === 1) return '1 empresa selecionada';
        return `${count} empresas selecionadas`;
    }

    updateButtonText() {
        if (this.buttonText) {
            this.buttonText.textContent = this.getButtonText();
        }
    }

    notifyChange() {
        if (this.onChange) {
            this.onChange(Array.from(this.selectedIds));
        }
    }
}
