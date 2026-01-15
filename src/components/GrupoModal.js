import { getApiBaseUrl } from '../utils/apiConfig.js';
import { showToast } from '../utils/toast.js';

export const GrupoModal = {
    show({ grupo = null, onSave }) {
        return new Promise(async (resolve) => {
            try {
                const API_BASE_URL = getApiBaseUrl();
                let container = document.getElementById('custom-dialog-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'custom-dialog-container';
                    document.body.appendChild(container);
                }

                const isEdit = grupo !== null;
                const token = localStorage.getItem('token');

                let allCaracteristicas = [];
                let grupoCaracteristicasIds = [];

                // Fetch All Characteristics
                try {
                    const response = await fetch(`${API_BASE_URL}/marketing/caracteristicas`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        allCaracteristicas = await response.json();
                    }
                } catch (error) {
                    console.error('Error loading characteristics:', error);
                    showToast('Erro ao carregar características', 'error');
                }

                // If editing, fetch group's characteristics
                if (isEdit) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/marketing/grupos-leads/${grupo.id}/caracteristicas`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                            const data = await response.json();
                            // Filter only direct characteristics usually, but for editing we want to manage direct ones
                            grupoCaracteristicasIds = data.filter(c => c.origem === 'direto').map(c => c.id);
                        }
                    } catch (error) {
                        console.error('Error loading group characteristics:', error);
                    }
                }

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
                            ${isEdit ? '✏️ Editar Grupo' : '👥 Novo Grupo de Leads'}
                        </h3>
                        
                        <div class="form-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                            
                            <div class="form-group">
                                <label for="grupo-nome">Nome <span class="required">*</span></label>
                                <input type="text" id="grupo-nome" class="form-input" 
                                    value="${grupo?.nome || ''}" placeholder="Nome do grupo (ex: Leads Quentes)" required />
                            </div>

                            <div class="form-group">
                                <label for="grupo-descricao">Descrição</label>
                                <textarea id="grupo-descricao" class="form-input" rows="2" 
                                    placeholder="Descrição opcional...">${grupo?.descricao || ''}</textarea>
                            </div>

                            <div class="form-group">
                                <label>Características Associadas</label>
                                <div id="caracteristicas-list" style="
                                    max-height: 200px; 
                                    overflow-y: auto; 
                                    border: 1px solid var(--color-border-light); 
                                    border-radius: 6px; 
                                    padding: 0.5rem;
                                    background: var(--color-bg-secondary);
                                ">
                                    ${allCaracteristicas.length > 0 ? allCaracteristicas.map(c => `
                                        <label style="display: flex; align-items: center; padding: 0.4rem; gap: 0.5rem; cursor: pointer; border-radius: 4px; transition: background 0.2s;">
                                            <input type="checkbox" value="${c.id}" 
                                                ${grupoCaracteristicasIds.includes(c.id) ? 'checked' : ''} 
                                                style="width: 16px; height: 16px; accent-color: var(--color-primary);">
                                            <span style="font-size: 0.95rem;">${c.nome}</span>
                                        </label>
                                    `).join('') : '<p style="color: var(--color-text-muted); padding: 0.5rem; font-size: 0.9rem;">Nenhuma característica cadastrada.</p>'}
                                </div>
                                <small style="color: var(--color-text-muted); font-size: 0.8rem; margin-top: 0.25rem; display: block;">
                                    Selecione as características que definem este grupo.
                                </small>
                            </div>

                        </div>
                    </div>
                    
                    <div class="account-modal-footer" style="padding: 1rem; border-top: 1px solid var(--color-border-light);">
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
                const caracteristicasList = modal.querySelector('#caracteristicas-list');
                const saveBtn = modal.querySelector('#modal-save');
                const cancelBtn = modal.querySelector('#modal-cancel');

                // Focus first field
                setTimeout(() => nomeInput.focus(), 100);

                // Event Listeners
                const close = () => {
                    container.removeChild(overlay);
                    resolve(null);
                };

                cancelBtn.onclick = close;
                overlay.onclick = (e) => { if (e.target === overlay) close(); };

                saveBtn.onclick = async () => {
                    if (!nomeInput.value.trim()) {
                        nomeInput.classList.add('input-error');
                        showToast('O nome do grupo é obrigatório', 'warning');
                        return;
                    }

                    const selectedCaracteristicas = Array.from(caracteristicasList.querySelectorAll('input[type="checkbox"]:checked'))
                        .map(cb => parseInt(cb.value));

                    const grupoData = {
                        nome: nomeInput.value.trim(),
                        descricao: descricaoInput.value.trim() || null,
                        caracteristicas: selectedCaracteristicas
                    };

                    // Show saving state
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
