export const Dialogs = {
    init() {
        if (!document.getElementById('custom-dialog-container')) {
            const container = document.createElement('div');
            container.id = 'custom-dialog-container';
            document.body.appendChild(container);
        }
    },

    show({ title, message, type = 'alert', onConfirm, onCancel, inputValue = '' }) {
        return new Promise((resolve) => {
            const container = document.getElementById('custom-dialog-container');

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'dialog-box animate-float-in';

            let content = `
        <div class="dialog-header">
          <h3>${title}</h3>
        </div>
        <div class="dialog-body">
          <p>${message}</p>
          ${type === 'prompt' ? `<input type="text" class="dialog-input" value="${inputValue}" />` : ''}
        </div>
        <div class="dialog-footer">
          ${type !== 'alert' ? `<button class="btn-secondary dialog-cancel-btn">Cancelar</button>` : ''}
          <button class="btn-primary dialog-confirm-btn">OK</button>
        </div>
      `;

            dialog.innerHTML = content;
            overlay.appendChild(dialog);
            container.appendChild(overlay);

            const input = dialog.querySelector('.dialog-input');
            const confirmBtn = dialog.querySelector('.dialog-confirm-btn');
            const cancelBtn = dialog.querySelector('.dialog-cancel-btn');

            if (input) {
                // Small timeout to ensure DOM is ready and transition doesn't eat the focus
                setTimeout(() => {
                    input.focus();
                    input.select();
                }, 50);
            } else {
                // If no input, focus the confirm button so Enter works natively too
                setTimeout(() => {
                    confirmBtn.focus();
                }, 50);
            }

            const close = (result) => {
                document.removeEventListener('keydown', handleKeydown);
                dialog.classList.add('animate-float-out');
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    if (container.contains(overlay)) {
                        container.removeChild(overlay);
                    }
                    resolve(result);
                }, 200);
            };

            const handleKeydown = (e) => {
                // Ensure we only handle events for the top-most dialog if multiple existed (though unlikely here)
                if (!document.body.contains(dialog)) return;

                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (type === 'alert') {
                        close(true);
                    } else {
                        close(false); // Cancel
                        if (type === 'prompt') resolve(null);
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    confirmBtn.click();
                }
            };

            // Use capture to ensure we get the event before others if needed, 
            // but standard bubbling is usually fine. 
            // Adding to document to catch everything.
            document.addEventListener('keydown', handleKeydown);

            confirmBtn.addEventListener('click', () => {
                if (type === 'prompt') {
                    const val = input ? input.value.trim() : '';
                    if (val) close(val);
                } else {
                    close(true);
                }
            });

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    close(false);
                    if (type === 'prompt') resolve(null);
                });
            }
        });
    },

    alert(message, title = 'Aviso') {
        return this.show({ title, message, type: 'alert' });
    },

    confirm(message, title = 'Confirmação') {
        return this.show({ title, message, type: 'confirm' });
    },

    prompt(message, defaultValue = '', title = 'Entrada') {
        return this.show({ title, message, type: 'prompt', inputValue: defaultValue });
    }
};
