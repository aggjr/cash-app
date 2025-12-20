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

    // 2. The Popover (Created lazily or eagerly, but detached)
    const popover = document.createElement('div');
    popover.className = 'month-picker-popover glass-panel';
    popover.style.display = 'none'; // Controlled by logic
    popover.style.position = 'absolute'; // Absolute relative to BODY
    popover.style.zIndex = '2147483647'; // Max safe integer to beat ALL other layers
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
                btnMonth.style.backgroundColor = 'var(--color-primary, #0EA5E9)';
                btnMonth.style.color = 'white';
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
        if (popover.parentNode) {
            popover.parentNode.removeChild(popover);
        }
        document.removeEventListener('click', outsideClickListener);
        window.removeEventListener('scroll', reposition, true);
        window.removeEventListener('resize', reposition);
    };

    const reposition = () => {
        if (!popover.parentNode) return;
        const rect = trigger.getBoundingClientRect();
        popover.style.top = `${rect.bottom + window.scrollY + 4}px`; // +4px margin
        popover.style.left = `${rect.left + window.scrollX}px`;
    };

    const outsideClickListener = (e) => {
        if (!popover.contains(e.target) && !trigger.contains(e.target)) {
            closePopover();
        }
    };

    trigger.onclick = (e) => {
        e.stopPropagation();
        if (document.body.contains(popover)) {
            closePopover();
        } else {
            displayYear = year; // Reset view to selected year
            renderPopoverContent();

            // Append to body and Position
            document.body.appendChild(popover);
            popover.style.display = 'block';
            reposition();

            document.addEventListener('click', outsideClickListener);
            window.addEventListener('scroll', reposition, true); // Capture scroll to update pos
            window.addEventListener('resize', reposition);
        }
    };

    wrapper.appendChild(trigger);

    // cleanup logic if wrapper is removed? 
    // Hard to detect in vanilla JS without MutationObserver but for this simple app, 
    // clicks outside handle removal, so "leaks" are minimal (just the detached element).
    // If the view changes, the old popover is lost to GC if not attached. 
    // If attached, the outsideClick will likely catch it or the user navigation will rebuild.

    // API for external set
    wrapper.setValue = (val) => {
        if (!val) return;
        [year, month] = val.split('-').map(Number);
        displayYear = year;
        updateTriggerText();
    };

    return wrapper;
};
