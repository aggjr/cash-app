import { showToast } from '../utils/toast.js';

export const CampanhaModal = {
    show({ campanha = null, onSave }) {
        return new Promise((resolve) => {
            let container = document.getElementById('custom-dialog-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'custom-dialog-container';
                document.body.appendChild(container);
            }

            const isEdit = campanha !== null;

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '1000';

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';
            modal.style.maxWidth = '600px';
            modal.style.width = '95%';

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 1.5rem;">
                    <h3 style="margin: 0 0 1.5rem 0; color: var(--color-primary); font-size: 1.25rem;">
                        ${isEdit ? '✏️ Editar Campanha' : '📢 Nova Campanha'}
                    </h3>
                    
                    <div class="form-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                        
                        <div class="form-group">
                            <label for="campanha-nome">Nome <span class="required">*</span></label>
                            <input type="text" id="campanha-nome" class="form-input" 
                                value="${campanha?.nome || ''}" placeholder="Nome da campanha" required />
                        </div>

                        <div class="form-group">
                            <label for="campanha-descricao">Descrição</label>
                            <textarea id="campanha-descricao" class="form-input" rows="2" 
                                placeholder="Descrição detalhada...">${campanha?.descricao || ''}</textarea>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label for="campanha-inicio">Data Início</label>
                                <input type="date" id="campanha-inicio" class="form-input" 
                                    value="${campanha?.data_inicio ? campanha.data_inicio.split('T')[0] : ''}" />
                            </div>
                            <div class="form-group">
                                <label for="campanha-fim">Data Fim</label>
                                <input type="date" id="campanha-fim" class="form-input" 
                                    value="${campanha?.data_fim ? campanha.data_fim.split('T')[0] : ''}" />
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="campanha-status">Status</label>
                            <select id="campanha-status" class="form-input">
                                <option value="planejamento" ${campanha?.status === 'planejamento' ? 'selected' : ''}>Planejamento</option>
                                <option value="ativa" ${campanha?.status === 'ativa' ? 'selected' : ''}>Ativa</option>
                                <option value="pausada" ${campanha?.status === 'pausada' ? 'selected' : ''}>Pausada</option>
                                <option value="concluida" ${campanha?.status === 'concluida' ? 'selected' : ''}>Concluída</option>
                                <option value="cancelada" ${campanha?.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
                            </select>
                        </div>

                    </div>
                </div>
                
                <div class="account-modal-footer" style="padding: 1rem; border-top: 1px solid var(--color-border-light);">
                    <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                    <button class="btn-primary" id="modal-save" type="button">
                        ${isEdit ? 'Salvar Alterações' : 'Criar Campanha'}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            // Elements
            const nomeInput = modal.querySelector('#campanha-nome');
            const descricaoInput = modal.querySelector('#campanha-descricao');
            const inicioInput = modal.querySelector('#campanha-inicio');
            const fimInput = modal.querySelector('#campanha-fim');
            const statusSelect = modal.querySelector('#campanha-status');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');

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
                    showToast('O nome da campanha é obrigatório', 'warning');
                    return;
                }

                const campanhaData = {
                    nome: nomeInput.value.trim(),
                    descricao: descricaoInput.value.trim() || null,
                    dataInicio: inicioInput.value || null,
                    dataFim: fimInput.value || null,
                    status: statusSelect.value
                };

                // Show saving state
                saveBtn.disabled = true;
                saveBtn.textContent = 'Salvando...';

                try {
                    await onSave(campanhaData);
                    close();
                    resolve(true);
                } catch (error) {
                    console.error(error);
                    showToast(error.message || 'Erro ao salvar', 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Campanha';
                }
            };
        });
    }
};
