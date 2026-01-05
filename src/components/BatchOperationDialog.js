/**
 * BatchOperationDialog - Dialog for selecting operation scope on installments
 * @param {Object} options
 * @param {string} options.operation - 'edit' or 'delete'
 * @param {number} options.currentNumber - Current installment number (e.g., 2)
 * @param {number} options.totalCount - Total installments in group (e.g., 5)
 * @param {string} options.description - Item description
 * @returns {Promise<string|null>} 'single', 'all', 'future', or null if cancelled
 */
export const BatchOperationDialog = {
    show: ({ operation, currentNumber, totalCount, description }) => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                animation: fadeIn 0.2s ease;
            `;

            const operationText = operation === 'delete' ? 'Exclusão' : 'Alteração';
            const operationVerb = operation === 'delete' ? 'excluir' : 'alterar';
            const futureCount = totalCount - currentNumber + 1;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: var(--color-bg, white);
                border-radius: 12px;
                padding: 2rem;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideIn 0.3s ease;
            `;

            dialog.innerHTML = `
                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes slideIn {
                        from { transform: translateY(-20px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    .batch-option {
                        display: flex;
                        align-items: flex-start;
                        padding: 1rem;
                        margin-bottom: 0.75rem;
                        border: 2px solid var(--color-border-light, #E5E7EB);
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        background: var(--color-surface, white);
                    }
                    .batch-option:hover {
                        border-color: var(--color-primary, #2563EB);
                        background: var(--color-primary-light, #EFF6FF);
                    }
                    .batch-option input[type="radio"] {
                        margin-right: 1rem;
                        margin-top: 0.25rem;
                        cursor: pointer;
                    }
                    .batch-option-content {
                        flex: 1;
                    }
                    .batch-option-title {
                        font-weight: 600;
                        color: var(--color-text, #1F2937);
                        margin-bottom: 0.25rem;
                    }
                    .batch-option-desc {
                        font-size: 0.875rem;
                        color: var(--color-text-muted, #6B7280);
                    }
                </style>

                <h2 style="margin: 0 0 0.5rem 0; color: var(--color-text, #1F2937); font-size: var(--text-table-title);">
                    ${operationText} de Parcelas
                </h2>
                <p style="margin: 0 0 1.5rem 0; color: var(--color-text-muted, #6B7280); font-size: 0.95rem;">
                    Este registro faz parte de um parcelamento (<strong>parcela ${currentNumber} de ${totalCount}</strong>)
                </p>
                <p style="margin: 0 0 1rem 0; color: var(--color-text, #1F2937); font-weight: 500;">
                    Como deseja ${operationVerb}?
                </p>

                <div id="batch-options">
                    <label class="batch-option">
                        <input type="radio" name="scope" value="single" checked>
                        <div class="batch-option-content">
                            <div class="batch-option-title">Apenas esta parcela</div>
                            <div class="batch-option-desc">${operationText === 'Alteração' ? 'Modificar' : 'Excluir'} somente a parcela ${currentNumber} de ${totalCount}</div>
                        </div>
                    </label>

                    <label class="batch-option">
                        <input type="radio" name="scope" value="all">
                        <div class="batch-option-content">
                            <div class="batch-option-title">Todas as parcelas (${totalCount} registros)</div>
                            <div class="batch-option-desc">
                                ${operationText === 'Alteração' ? 'Modificar' : 'Excluir'} todas as ${totalCount} parcelas
                                ${operation === 'edit' ? '<br><em>Nota: Parcelas antigas podem ser bloqueadas por regras de data</em>' : ''}
                            </div>
                        </div>
                    </label>

                    <label class="batch-option">
                        <input type="radio" name="scope" value="future">
                        <div class="batch-option-content">
                            <div class="batch-option-title">Esta e as próximas (${futureCount} registro${futureCount > 1 ? 's' : ''})</div>
                            <div class="batch-option-desc">${operationText === 'Alteração' ? 'Modificar' : 'Excluir'} da parcela ${currentNumber} até a ${totalCount}</div>
                        </div>
                    </label>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 2rem; justify-content: flex-end;">
                    <button id="btn-cancel" style="
                        padding: 0.75rem 1.5rem;
                        border: 1px solid var(--color-border, #D1D5DB);
                        background: transparent;
                        color: var(--color-text, #1F2937);
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s;
                    ">
                        Cancelar
                    </button>
                    <button id="btn-confirm" style="
                        padding: 0.75rem 1.5rem;
                        border: none;
                        background: var(--color-primary, #2563EB);
                        color: white;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s;
                    ">
                        Continuar
                    </button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const close = (result) => {
                overlay.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => {
                    if (document.body.contains(overlay)) {
                        document.body.removeChild(overlay);
                    }
                    resolve(result);
                }, 200);
            };

            // Add fadeOut animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);

            dialog.querySelector('#btn-cancel').onclick = () => close(null);
            dialog.querySelector('#btn-confirm').onclick = () => {
                const selected = dialog.querySelector('input[name="scope"]:checked');
                close(selected ? selected.value : null);
            };

            // Close on overlay click
            overlay.onclick = (e) => {
                if (e.target === overlay) close(null);
            };
        });
    }
};
