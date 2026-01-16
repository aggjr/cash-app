import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const LeadModal = {
    show: async ({ lead = null, grupos = [], caracteristicas = [], onSave }) => {
        return new Promise((resolve) => {
            const API_BASE_URL = getApiBaseUrl();
            const token = localStorage.getItem('token');
            const isEdit = !!lead;

            // IDs for elements
            const idGruposList = `grupos-list-${Date.now()}`;
            const idGruposSearch = `grupos-search-${Date.now()}`;
            const idCaracList = `caracs-list-${Date.now()}`;
            const idCaracSearch = `caracs-search-${Date.now()}`;

            // State
            const leadGruposIds = lead?.grupos || [];
            const selectedCharValues = {};

            // Initialize selected characteristics
            if (lead?.caracteristicas_detalhadas) {
                lead.caracteristicas_detalhadas.forEach(c => {
                    selectedCharValues[c.id] = c.valor_id;
                });
            } else if (lead?.caracteristicas) {
                if (Array.isArray(lead.caracteristicas)) {
                    lead.caracteristicas.forEach(id => {
                        if (!selectedCharValues[id]) selectedCharValues[id] = null;
                    });
                }
            }

            // --- UI Helpers ---
            // Zebra-striped checkbox list (like SharedTable)
            const renderZebraList = (items, selectedIds, listId, searchId) => `
                <div style="background: white; border: 1px solid var(--color-border-light); border-radius: 6px; overflow: hidden;">
                    <div style="padding: 0.75rem; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border-light);">
                        <input type="text" id="${searchId}" class="form-input" placeholder="🔍 Buscar..." 
                            style="padding: 0.5rem; font-size: 0.9rem; margin: 0; width: 100%; border: 1px solid var(--color-border-light);" />
                    </div>
                    <div id="${listId}" style="max-height: 200px; overflow-y: auto;">
                        ${items.map((item, index) => {
                const isEven = index % 2 === 0;
                const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
                const isChecked = selectedIds.includes(item.id);
                return `
                                <label class="zebra-row" data-item-name="${item.nome.toLowerCase()}" 
                                    style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; cursor: pointer; 
                                           background-color: ${bgColor}; border-bottom: 1px solid #E5E7EB; transition: background-color 0.15s;"
                                    onmouseenter="this.style.backgroundColor='#EDD8BB'" 
                                    onmouseleave="this.style.backgroundColor='${bgColor}'">
                                    <input type="checkbox" value="${item.id}" ${isChecked ? 'checked' : ''} 
                                        style="accent-color: var(--color-primary); width: 16px; height: 16px; cursor: pointer; margin: 0;">
                                    <span style="font-size: 0.95rem; color: var(--color-text-primary);">${item.nome}</span>
                                </label>
                            `;
            }).join('')}
                    </div>
                </div>
            `;

            const container = document.body;
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';

            const modal = document.createElement('div');
            modal.className = 'account-modal';
            modal.style.cssText = 'background: white; border-radius: 12px; width: 90%; max-width: 700px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;';

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 1.5rem; max-height: 80vh; overflow-y: auto;">
                    <h3 style="margin: 0 0 1.5rem 0; color: var(--color-primary); font-size: 1.25rem;">
                        ${isEdit ? '✏️ Editar Lead' : '🎯 Novo Lead'}
                    </h3>
                    
                    <div class="form-grid" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label for="lead-nome">Nome <span class="required">*</span></label>
                                <input type="text" id="lead-nome" class="form-input" 
                                    value="${lead?.nome || ''}" placeholder="Nome do lead" required />
                            </div>
                            <div class="form-group">
                                <label for="lead-telefone">Telefone</label>
                                <input type="text" id="lead-telefone" class="form-input" 
                                    value="${lead?.telefone || ''}" placeholder="(00) 00000-0000" />
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="lead-email">E-mail</label>
                            <input type="email" id="lead-email" class="form-input" 
                                value="${lead?.email || ''}" placeholder="email@exemplo.com" />
                        </div>

                        <div class="form-group">
                             <label>Grupos de Interesse</label>
                             ${renderZebraList(grupos, leadGruposIds, idGruposList, idGruposSearch)}
                        </div>

                        <div class="form-group">
                             <label>Características</label>
                             ${renderZebraList(caracteristicas, Object.keys(selectedCharValues).map(Number), idCaracList, idCaracSearch)}
                        </div>

                        <div class="form-group">
                            <label for="lead-observacoes">Observações</label>
                            <textarea id="lead-observacoes" class="form-input" rows="2" 
                                placeholder="Anotações sobre o lead...">${lead?.observacoes || ''}</textarea>
                        </div>
                    </div>
                </div>

                <div class="account-modal-footer" style="padding: 1rem; border-top: 1px solid var(--color-border-light);">
                    <button class="btn-secondary" id="modal-cancel" type="button">Cancelar</button>
                    <button class="btn-primary" id="modal-save" type="button">
                        ${isEdit ? 'Salvar Alterações' : 'Criar Lead'}
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            // Elements
            const nomeInputRef = modal.querySelector('#lead-nome');
            const emailInputRef = modal.querySelector('#lead-email');
            const telefoneInputRef = modal.querySelector('#lead-telefone');
            const observacoesInputRef = modal.querySelector('#lead-observacoes');
            const saveBtn = modal.querySelector('#modal-save');
            const cancelBtn = modal.querySelector('#modal-cancel');

            // Setup Search Handlers
            setTimeout(() => {
                // Groups Search
                const grpSearch = modal.querySelector(`#${idGruposSearch}`);
                const grpList = modal.querySelector(`#${idGruposList}`);
                if (grpSearch && grpList) {
                    grpSearch.addEventListener('input', (e) => {
                        const term = e.target.value.toLowerCase();
                        grpList.querySelectorAll('.zebra-row').forEach(row => {
                            const itemName = row.dataset.itemName || '';
                            row.style.display = itemName.includes(term) ? 'flex' : 'none';
                        });
                    });
                }

                // Characteristics Search
                const caracSearch = modal.querySelector(`#${idCaracSearch}`);
                const caracList = modal.querySelector(`#${idCaracList}`);
                if (caracSearch && caracList) {
                    caracSearch.addEventListener('input', (e) => {
                        const term = e.target.value.toLowerCase();
                        caracList.querySelectorAll('.zebra-row').forEach(row => {
                            const itemName = row.dataset.itemName || '';
                            row.style.display = itemName.includes(term) ? 'flex' : 'none';
                        });
                    });
                }

                nomeInputRef.focus();
            }, 100);

            // --- Footer Actions ---
            const close = () => {
                const parent = overlay.parentNode;
                if (parent) parent.removeChild(overlay);
                resolve(null);
            };

            cancelBtn.onclick = close;
            overlay.onclick = (e) => { if (e.target === overlay) close(); };

            saveBtn.onclick = async () => {
                if (!nomeInputRef.value.trim()) {
                    nomeInputRef.classList.add('input-error');
                    showToast('O nome é obrigatório', 'warning');
                    return;
                }

                const selectedGrupos = Array.from(modal.querySelector(`#${idGruposList}`).querySelectorAll('input:checked'))
                    .map(cb => parseInt(cb.value));

                const selectedCaracs = Array.from(modal.querySelector(`#${idCaracList}`).querySelectorAll('input:checked'))
                    .map(cb => parseInt(cb.value));

                const data = {
                    nome: nomeInputRef.value.trim(),
                    email: emailInputRef.value.trim() || null,
                    telefone: telefoneInputRef.value.trim() || null,
                    observacoes: observacoesInputRef.value.trim() || null,
                    grupos: selectedGrupos,
                    caracteristicas: selectedCaracs
                };

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
                    saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Lead';
                }
            };
        });
    }
};
