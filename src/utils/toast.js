export const showToast = (input, type = 'info') => {
    let message = input;
    let detail = '';
    let code = '';

    // Handle new error format
    if (input && typeof input === 'object' && input.error) {
        if (typeof input.error === 'string') {
            message = input.error;
        } else {
            code = input.error.code ? `[${input.error.code}] ` : '';
            message = input.error.message || 'Erro desconhecido';
            detail = input.error.details || '';
            type = 'error'; // Enforce error type if it comes from error object
        }
    } else if (input && typeof input === 'object' && input.message) {
        // Handle standard Error object
        message = input.message;
        type = 'error';
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Structure with optional Code and Detail
    toast.innerHTML = `
        <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 500;">${code}${message}</span>
            ${detail ? `<span style="font-size: 0.8em; opacity: 0.9; margin-top: 2px;">${detail}</span>` : ''}
        </div>
    `;

    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        padding: 1rem 1.5rem;
        background: ${type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#3B82F6'};
        color: white;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        min-width: 300px;
        max-width: 450px;
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};
