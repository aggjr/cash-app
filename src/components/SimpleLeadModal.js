
import { showToast } from '../utils/toast.js';

export const SimpleLeadModal = {
    show({ lead, onSave }) {
        return new Promise((resolve) => {
            try {
                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                const overlay = document.createElement('div');
                overlay.className = 'dialog-overlay';
                overlay.style.zIndex = '1000';

                const modal = document.createElement('div');
                modal.className = 'account-modal animate-float-in';
                modal.style.maxWidth = '500px';
                modal.style.width = '90%';
                modal.style.display = 'flex';
                modal.style.flexDirection = 'column';

                modal.innerHTML = `
                    <div class="account-modal-body" style="padding: 1.5rem;">
                        <h3 style="margin: 0 0 1.5rem 0; color: var(--color-primary); font-size: 1.25rem;">
                            ✏️ Editar Lead
                        </h3>
                        
                        <div class="form-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                            
                            <div class="form-group">
                                <label for="lead-nome">Nome do Lead <span class="required">*</span></label>
                                <input type="text" id="lead-nome" class="form-input" 
                                    value="${lead?.nome || ''}" placeholder="Nome do Lead" required />
                            </div>

                            <div class="form-group">
                                <label for="lead-descricao">Descrição <span class="required">*</span></label>
                                <textarea id="lead-descricao" class="form-input" rows="3" 
                                    placeholder="Descrição do lead..." required>${lead?.descricao || ''}</textarea>
                            </div>

                        </div>
                    </div>
                    
                    <div class="account-modal-footer" style="padding: 1rem; border-top: 1px solid var(--color-border-light); display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                        <button class="btn-primary" id="modal-save" type="button">
                            Salvar Alterações
                        </button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // Elements
                const nomeInput = modal.querySelector('#lead-nome');
                const descricaoInput = modal.querySelector('#lead-descricao');
                const saveBtn = modal.querySelector('#modal-save');
                const cancelBtn = modal.querySelector('#modal-cancel');

                // Focus
                setTimeout(() => nomeInput.focus(), 100);

                const close = () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(null);
                };

                cancelBtn.onclick = close;
                overlay.onclick = (e) => { if (e.target === overlay) close(); };

                saveBtn.onclick = async () => {
                    // Validation
                    if (!nomeInput.value.trim()) {
                        nomeInput.classList.add('input-error');
                        showToast('O nome do lead é obrigatório', 'warning');
                        return;
                    }
                    if (!descricaoInput.value.trim()) {
                        descricaoInput.classList.add('input-error');
                        showToast('A descrição do lead é obrigatória', 'warning');
                        return;
                    }

                    const leadData = {
                        nome: nomeInput.value.trim(),
                        descricao: descricaoInput.value.trim()
                    };

                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Salvando...';

                    try {
                        await onSave(leadData);
                        close();
                        resolve(true);
                    } catch (error) {
                        console.error(error);
                        showToast(error.message || 'Erro ao salvar', 'error');
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Salvar Alterações';
                    }
                };

            } catch (error) {
                console.error('Error in SimpleLeadModal:', error);
                resolve(null);
            }
        });
    }
};
