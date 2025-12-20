export const MonthPicker = (initialValue, onChange) => {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';

    // Parse initial value YYYY-MM
    // Safe fallback if null or invalid
    let year, month;
    if (initialValue && initialValue.includes('-')) {
        [year, month] = initialValue.split('-').map(Number);
    } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1;
    }

    let displayYear = year; // For navigation state

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const fullMonthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    // 1. The Trigger Input
    const trigger = document.createElement('div');
    trigger.className = 'form-input';
    trigger.style.cursor = 'pointer';
    trigger.style.display = 'flex';
    trigger.style.alignItems = 'center';
    trigger.style.justifyContent = 'space-between';
    trigger.style.width = '160px'; // Fixed width for consistency
    trigger.style.minWidth = '160px';
    trigger.style.height = '38px';
    trigger.style.padding = '0 0.75rem';
    trigger.style.backgroundColor = 'white';
    trigger.style.userSelect = 'none';
    trigger.style.border = '1px solid #d1d5db';
    trigger.style.borderRadius = '0.375rem';

    const updateTriggerText = () => {
        trigger.innerHTML = `
            <span style="font-weight: 500; color: #374151;">${fullMonthNames[month - 1]} / ${year}</span>
            <span style="font-size: 0.8rem; color: #9CA3AF;">▼</span>
        `;
    };
    updateTriggerText();

    // 2. The Popover
    const popover = document.createElement('div');
    popover.className = 'month-picker-popover glass-panel';
    popover.style.display = 'none';
    popover.style.position = 'absolute';
    popover.style.top = '100%';
    popover.style.left = '0';
    popover.style.marginTop = '0.25rem';
    popover.style.zIndex = '1000';
    popover.style.width = '240px';
    popover.style.padding = '0.5rem';
    popover.style.backgroundColor = 'white';
    popover.style.border = '1px solid #e5e7eb';
    popover.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
    popover.style.borderRadius = '0.5rem';

    const renderPopoverContent = () => {
        popover.innerHTML = '';

        // Header: Year Navigation
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '0.5rem';
        header.style.paddingBottom = '0.5rem';
        header.style.borderBottom = '1px solid #f3f4f6';

        const btnPrev = document.createElement('button');
        btnPrev.textContent = '◀';
        btnPrev.style.background = 'none';
        btnPrev.style.border = 'none';
        btnPrev.style.cursor = 'pointer';
        btnPrev.style.padding = '0.25rem 0.5rem';
        btnPrev.style.color = '#4B5563';
        btnPrev.onclick = (e) => {
            e.stopPropagation();
            displayYear--;
            renderPopoverContent();
        };

        const yearLabel = document.createElement('span');
        yearLabel.textContent = displayYear;
        yearLabel.style.fontWeight = 'bold';
        yearLabel.style.color = '#111827';

        const btnNext = document.createElement('button');
        btnNext.textContent = '▶';
        btnNext.style.background = 'none';
        btnNext.style.border = 'none';
        btnNext.style.cursor = 'pointer';
        btnNext.style.padding = '0.25rem 0.5rem';
        btnNext.style.color = '#4B5563';
        btnNext.onclick = (e) => {
            e.stopPropagation();
            displayYear++;
            renderPopoverContent();
        };

        header.appendChild(btnPrev);
        header.appendChild(yearLabel);
        header.appendChild(btnNext);
        popover.appendChild(header);

        // Grid: Months
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        grid.style.gap = '0.25rem';

        monthNames.forEach((mName, idx) => {
            const btnMonth = document.createElement('button');
            btnMonth.textContent = mName;
            const mNum = idx + 1;
            const isSelected = displayYear === year && mNum === month;

            btnMonth.style.padding = '0.5rem 0.25rem';
            btnMonth.style.border = 'none';
            btnMonth.style.borderRadius = '0.25rem';
            btnMonth.style.cursor = 'pointer';
            btnMonth.style.fontSize = '0.9rem';

            if (isSelected) {
                btnMonth.style.backgroundColor = 'var(--color-primary)'; // Needs global CSS or fallback
                btnMonth.style.color = 'white'; // Fallback text
                // Ideally use style directly if var not sure, but var usually exists in this app
                if (!getComputedStyle(document.documentElement).getPropertyValue('--color-primary')) {
                    btnMonth.style.backgroundColor = '#0EA5E9'; // Fallback blue
                    btnMonth.style.color = 'white';
                }
                btnMonth.style.fontWeight = '600';
            } else {
                btnMonth.style.backgroundColor = 'transparent';
                btnMonth.style.color = '#374151';
            }

            btnMonth.onmouseover = () => { if (!isSelected) btnMonth.style.backgroundColor = '#f3f4f6'; };
            btnMonth.onmouseout = () => { if (!isSelected) btnMonth.style.backgroundColor = 'transparent'; };

            btnMonth.onclick = (e) => {
                e.stopPropagation();
                year = displayYear;
                month = mNum;
                updateTriggerText();
                closePopover();

                // Format YYYY-MM
                const formatted = `${year}-${String(month).padStart(2, '0')}`;
                onChange(formatted);
            };

            grid.appendChild(btnMonth);
        });
        popover.appendChild(grid);
    };

    // Logic
    const closePopover = () => {
        popover.style.display = 'none';
        document.removeEventListener('click', outsideClickListener);
    };

    const outsideClickListener = (e) => {
        if (!wrapper.contains(e.target)) {
            closePopover();
        }
    };

    trigger.onclick = (e) => {
        e.stopPropagation();
        if (popover.style.display === 'block') {
            closePopover();
        } else {
            displayYear = year; // Reset view to selected year
            renderPopoverContent();
            popover.style.display = 'block';
            document.addEventListener('click', outsideClickListener);
        }
    };

    wrapper.appendChild(trigger);
    wrapper.appendChild(popover);

    // API for external set
    wrapper.setValue = (val) => {
        if (!val) return;
        [year, month] = val.split('-').map(Number);
        displayYear = year;
        updateTriggerText();
    };

    return wrapper;
};
