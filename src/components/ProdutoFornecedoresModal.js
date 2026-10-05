import { getApiBaseUrl } from '../utils/apiConfig.js';
import { showToast } from '../utils/toast.js';

/**
 * Picks which suppliers can provide a product and which one is the main supplier.
 * The purchase itself still records the supplier that actually sold the item, because
 * the main supplier may not have it in stock.
 */
export const ProdutoFornecedoresModal = {
    show({ tipoId, label, projectId }) {
        return new Promise(async (resolve) => {
            const container = document.getElementById('custom-dialog-container');
            if (!container) {
                console.error('Dialog container not found');
                resolve(null);
                return;
            }

            const API_BASE_URL = getApiBaseUrl();
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

            let fornecedores = [];
            let vinculados = [];

            try {
                const [todosResponse, vinculadosResponse] = await Promise.all([
                    fetch(`${API_BASE_URL}/fornecedores?projectId=${projectId}&onlyActive=1`, { headers }),
                    fetch(`${API_BASE_URL}/fornecedores/produto/${tipoId}`, { headers })
                ]);

                if (todosResponse.ok) {
                    const json = await todosResponse.json();
                    fornecedores = Array.isArray(json) ? json : [];
                }
                if (vinculadosResponse.ok) {
                    const json = await vinculadosResponse.json();
                    vinculados = Array.isArray(json) ? json : [];
                }
            } catch (error) {
                console.error('Erro ao carregar fornecedores:', error);
                showToast('Erro ao carregar fornecedores', 'error');
                resolve(null);
                return;
            }

            const selecionados = new Map(vinculados.map(v => [Number(v.fornecedor_id), !!v.principal]));

            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '3000';

            const modal = document.createElement('div');
            modal.className = 'account-modal animate-float-in';
            modal.style.maxWidth = '620px';
            modal.style.width = '95%';

            const emptyState = `
                <p style="color: var(--color-text-muted); padding: 1rem 0;">
                    Nenhum fornecedor cadastrado ainda. Cadastre em <strong>Cadastros &gt; Fornecedores</strong>.
                </p>`;

            const rows = fornecedores.map(f => {
                const checked = selecionados.has(Number(f.id));
                const principal = selecionados.get(Number(f.id)) === true;
                return `
                    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0; border-bottom: 1px solid var(--color-border-light);">
                        <input type="checkbox" class="pf-check" data-id="${f.id}" ${checked ? 'checked' : ''}
                            style="width: 16px; height: 16px; cursor: pointer;" />
                        <span style="flex: 1;">${f.name}</span>
                        <label style="display: flex; align-items: center; gap: 0.35rem; font-weight: normal; margin: 0; cursor: pointer; white-space: nowrap;">
                            <input type="radio" name="pf-principal" class="pf-principal" data-id="${f.id}"
                                ${principal ? 'checked' : ''} ${checked ? '' : 'disabled'} style="cursor: pointer;" />
                            <span style="font-size: 0.85rem; color: var(--color-text-muted);">Principal</span>
                        </label>
                    </div>`;
            }).join('');

            modal.innerHTML = `
                <div class="account-modal-body" style="padding: 1.5rem;">
                    <h3 style="margin: 0 0 0.25rem 0; color: var(--color-primary); font-size: 1.2rem;">Fornecedores do produto</h3>
                    <p style="margin: 0 0 1rem 0; color: var(--color-text-muted); font-size: 0.9rem;">
                        <strong>${label || ''}</strong><br/>
                        Marque quem fornece este produto e indique o principal. Na compra você escolhe quem realmente vendeu.
                    </p>
                    <div style="max-height: 45vh; overflow-y: auto;">
                        ${fornecedores.length > 0 ? rows : emptyState}
                    </div>
                </div>
                <div class="account-modal-footer">
                    <button class="btn-secondary" id="pf-cancel">Cancelar</button>
                    <button class="btn-primary" id="pf-save" ${fornecedores.length === 0 ? 'disabled' : ''}>Salvar</button>
                </div>
            `;

            overlay.appendChild(modal);
            container.appendChild(overlay);

            const close = (result) => {
                document.removeEventListener('keydown', handleKeydown);
                modal.classList.add('animate-float-out');
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    if (container.contains(overlay)) container.removeChild(overlay);
                    resolve(result);
                }, 200);
            };

            const handleKeydown = (e) => {
                if (!document.body.contains(modal)) return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    close(null);
                }
            };
            document.addEventListener('keydown', handleKeydown);

            // "Principal" only makes sense for a supplier that actually serves the product.
            modal.querySelectorAll('.pf-check').forEach(check => {
                check.addEventListener('change', () => {
                    const radio = modal.querySelector(`.pf-principal[data-id="${check.dataset.id}"]`);
                    if (!radio) return;
                    radio.disabled = !check.checked;
                    if (!check.checked) radio.checked = false;
                });
            });

            modal.querySelectorAll('.pf-principal').forEach(radio => {
                radio.addEventListener('change', () => {
                    if (!radio.checked) return;
                    const check = modal.querySelector(`.pf-check[data-id="${radio.dataset.id}"]`);
                    if (check) check.checked = true;
                });
            });

            modal.querySelector('#pf-cancel').addEventListener('click', () => close(null));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(null);
            });

            modal.querySelector('#pf-save').addEventListener('click', async () => {
                const payload = [];
                modal.querySelectorAll('.pf-check').forEach(check => {
                    if (!check.checked) return;
                    const radio = modal.querySelector(`.pf-principal[data-id="${check.dataset.id}"]`);
                    payload.push({
                        fornecedorId: parseInt(check.dataset.id),
                        principal: !!(radio && radio.checked)
                    });
                });

                try {
                    const response = await fetch(`${API_BASE_URL}/fornecedores/produto/${tipoId}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({ fornecedores: payload })
                    });

                    if (response.ok) {
                        showToast('Fornecedores do produto atualizados', 'success');
                        close(payload);
                    } else {
                        const error = await response.json();
                        showToast(error.error?.message || 'Erro ao salvar fornecedores', 'error');
                    }
                } catch (error) {
                    console.error(error);
                    showToast('Erro de conexão', 'error');
                }
            });
        });
    }
};
