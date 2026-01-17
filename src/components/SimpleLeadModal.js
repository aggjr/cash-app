import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const SimpleLeadModal = {
    show: ({ lead = null, onSave }) => {
        return new Promise((resolve) => {
            const isEdit = !!lead;

            // Create Overlay
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.background = 'rgba(0,0,0,0.5)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '10005'; // High z-index

            // Create Modal Box
            const modal = document.createElement('div');
            modal.style.background = 'white';
            modal.style.borderRadius = '12px';
            modal.style.width = '90%';
            modal.style.maxWidth = '400px';
            modal.style.padding = '24px';
            modal.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.gap = '16px';

            modal.innerHTML = `
                <h3 style="margin: 0; color: var(--color-primary); font-size: 1.25rem;">
                    ${isEdit ? '✏️ Editar Lead' : '👤 Novo Lead'}
                </h3>
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label for="simple-lead-nome" style="font-weight: 500; font-size: 0.9rem;">Nome <span style="color:red">*</span></label>
                    <input type="text" id="simple-lead-nome" class="form-input" 
                        value="${lead?.nome || ''}" placeholder="Nome do lead" 
                        style="padding: 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem;" />
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label for="simple-lead-desc" style="font-weight: 500; font-size: 0.9rem;">Descrição / Observações</label>
                    <textarea id="simple-lead-desc" class="form-input" rows="3"
                        placeholder="Descrição breve..." 
                        style="padding: 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; resize: vertical;">${lead?.observacoes || ''}</textarea>
                </div>
                
                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;">
                    <button id="btn-cancel" style="
                        background: transparent; border: 1px solid #ccc; padding: 8px 16px; 
                        border-radius: 6px; cursor: pointer; color: #555; font-weight: 500;">
                        Cancelar
                    </button>
                    <button id="btn-save" style="
                        background: var(--color-primary); border: none; padding: 8px 16px; 
                        border-radius: 6px; cursor: pointer; color: white; font-weight: 500;">
                        Salvar
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Focus Name
            setTimeout(() => modal.querySelector('#simple-lead-nome').focus(), 100);

            // Handlers
            const close = () => {
                document.body.removeChild(overlay);
                resolve();
            };

            const save = () => {
                const nome = modal.querySelector('#simple-lead-nome').value.trim();
                const observacoes = modal.querySelector('#simple-lead-desc').value.trim();

                if (!nome) {
                    showToast('O nome é obrigatório', 'warning');
                    return;
                }

                if (onSave) {
                    onSave({
                        ...lead,
                        nome,
                        observacoes
                    });
                }
                close();
            };

            modal.querySelector('#btn-cancel').onclick = close;
            modal.querySelector('#btn-save').onclick = save;

            // Enter key to save (if not in textarea)
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                    save();
                }
                if (e.key === 'Escape') close();
            });

            overlay.onclick = (e) => {
                if (e.target === overlay) close();
            };
        });
    }
};
