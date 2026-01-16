// Imports at top
import { showToast } from '../utils/toast.js';
import { CaracteristicaValoresGrid } from './CaracteristicaValoresGrid.js';

export const CaracteristicaModal = {
    show({ caracteristica = null, onSave }) {
        return new Promise((resolve) => {
            let container = document.getElementById('custom-dialog-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'custom-dialog-container';
                document.body.appendChild(container);
            }

            const isEdit = caracteristica !== null;

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '1000';

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';
            modal.style.maxWidth = '500px';
            modal.style.width = '95%';
            modal.style.maxHeight = '90vh';
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 1.5rem; overflow-y: auto;">
                    <h3 style="margin: 0 0 1.5rem 0; color: var(--color-primary); font-size: 1.25rem;">
                        ${isEdit ? '✏️ Editar Característica' : '🏷️ Nova Característica'}
                    </h3>
                    
                    <div class="form-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                        
                        <div class="form-group">
                            <label for="caracteristica-nome">Nome <span class="required">*</span></label>
                            <input type="text" id="caracteristica-nome" class="form-input" 
                                value="${caracteristica?.nome || ''}" placeholder="Nome da característica" required />
                        </div>

                        <div class="form-group">
                            <label for="caracteristica-descricao">Descrição</label>
                            <textarea id="caracteristica-descricao" class="form-input" rows="3" 
                                placeholder="Descrição detalhada...">${caracteristica?.descricao || ''}</textarea>
                        </div>

                        <!-- Container for Values Grid -->
                        <div id="values-grid-container" style="display: block;"></div>

                    </div>
                </div>
                
                <div class="account-modal-footer" style="padding: 1rem; border-top: 1px solid var(--color-border-light);">
                    <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                    <button class="btn-primary" id="modal-save" type="button">
                        ${isEdit ? 'Salvar Alterações' : 'Criar Característica'}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            // Elements
            const nomeInput = modal.querySelector('#caracteristica-nome');
            const descricaoInput = modal.querySelector('#caracteristica-descricao');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');
            const valuesContainer = modal.querySelector('#values-grid-container');

            let localValues = []; // Stores values when in create mode

            // Initialize Grid
            if (isEdit) {
                // Edit Mode: Fetch existing
                fetch(`${document.location.origin}/api/marketing/caracteristicas/${caracteristica.id}/valores`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                })
                    .then(res => res.json())
                    .then(values => {
                        if (Array.isArray(values)) {
                            // Edit mode uses immediate API mode (isLocal: false)
                            CaracteristicaValoresGrid.render(valuesContainer, caracteristica.id, values, {
                                isLocal: false
                            });
                        }
                    })
                    .catch(err => console.error('Erro ao carregar valores:', err));
            } else {
                // Create Mode: Local state
                CaracteristicaValoresGrid.render(valuesContainer, null, [], {
                    isLocal: true,
                    onChange: (values) => {
                        localValues = values; // Update local state
                    }
                });
            }

            // Focus first field
            setTimeout(() => nomeInput.focus(), 100);

            // Event Listeners
            const close = () => {
                const parent = overlay.parentNode;
                if (parent) parent.removeChild(overlay);
                resolve(null);
            };

            cancelBtn.onclick = close;
            overlay.onclick = (e) => { if (e.target === overlay) close(); };

            saveBtn.onclick = async () => {
                if (!nomeInput.value.trim()) {
                    nomeInput.classList.add('input-error');
                    showToast('O nome é obrigatório', 'warning');
                    return;
                }

                const data = {
                    nome: nomeInput.value.trim(),
                    descricao: descricaoInput.value.trim() || null,
                    valores: isEdit ? undefined : localValues // Send values only on create
                };

                // Show saving state
                saveBtn.disabled = true;
                saveBtn.textContent = 'Salvando...';

                try {
                    await onSave(data);
                    close();
                    resolve(true);
                } catch (error) {
                    console.error(error);
                    showToast(error.message || 'Erro ao salvar', 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Característica';
                }
            };
        });
    }
};
