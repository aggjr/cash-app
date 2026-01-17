
import { showToast } from '../utils/toast.js';

export const GrupoModal = {
    show({ grupo = null, onSave }) {
        return new Promise((resolve) => {
            try {
                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                const isEdit = grupo !== null;

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
                            ${isEdit ? '✏️ Editar Grupo' : '👥 Novo Grupo'}
                        </h3>
                        
                        <div class="form-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                            
                            <div class="form-group">
                                <label for="grupo-nome">Nome do Grupo <span class="required">*</span></label>
                                <input type="text" id="grupo-nome" class="form-input" 
                                    value="${grupo?.nome || ''}" placeholder="Ex: Leads Quentes" required />
                            </div>

                            <div class="form-group">
                                <label for="grupo-descricao">Descrição <span class="required">*</span></label>
                                <textarea id="grupo-descricao" class="form-input" rows="3" 
                                    placeholder="Descrição do grupo..." required>${grupo?.descricao || ''}</textarea>
                            </div>

                        </div>
                    </div>
                    
                    <div class="account-modal-footer" style="padding: 1rem; border-top: 1px solid var(--color-border-light); display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                        <button class="btn-primary" id="modal-save" type="button">
                            ${isEdit ? 'Salvar Alterações' : 'Criar Grupo'}
                        </button>
                    </div>
                `;

                overlay.appendChild(modal);
                container.appendChild(overlay);

                // Elements
                const nomeInput = modal.querySelector('#grupo-nome');
                const descricaoInput = modal.querySelector('#grupo-descricao');
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
                        showToast('O nome do grupo é obrigatório', 'warning');
                        return;
                    }
                    if (!descricaoInput.value.trim()) {
                        descricaoInput.classList.add('input-error');
                        showToast('A descrição do grupo é obrigatória', 'warning');
                        return;
                    }

                    const grupoData = {
                        nome: nomeInput.value.trim(),
                        descricao: descricaoInput.value.trim(),
                        // Explicitly send undefined/null for relations to ensure we don't accidentally wipe them if backend expects arrays?
                        // Actually better to send ONLY properly updated fields. 
                        // If backend uses "replace if present", preventing sending leads/subgroups is safer.
                    };

                    // If isEdit, we might need to preserve parent_id if it's not editable here?
                    // User didn't ask to edit parent_id here. 
                    // `createGrupo` in Manager passes `parent_id` in `grupo` object or `grupoData`.
                    // But here `grupoData` is constructed fresh.
                    // If creating sub-group, `grupo` passed to `show` contains `parent_id`.
                    // We must preserve it.
                    if (grupo && grupo.parent_id) {
                        grupoData.parent_id = grupo.parent_id;
                    }

                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Salvando...';

                    try {
                        await onSave(grupoData);
                        close();
                        resolve(true);
                    } catch (error) {
                        console.error(error);
                        showToast(error.message || 'Erro ao salvar', 'error');
                        saveBtn.disabled = false;
                        saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Grupo';
                    }
                };

            } catch (error) {
                console.error('Error in GrupoModal:', error);
                resolve(null);
            }
        });
    }
};
