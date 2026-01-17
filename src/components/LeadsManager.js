import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { LeadModal } from './LeadModal.js';

export const LeadsManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '1rem';
    container.style.margin = '0.5rem';
    container.style.height = 'calc(100vh - 60px)';
    container.style.width = 'calc(100% - 1rem)';
    container.style.maxWidth = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    let leads = [];
    let sharedTable = null;

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Define Columns for SharedTable
    const columns = [
        {
            key: 'actions',
            label: 'Ações',
            width: '80px',
            align: 'center',
            noFilter: true,
            render: (item) => {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.gap = '0.5rem';
                div.style.justifyContent = 'center';

                const btnEdit = document.createElement('button');
                btnEdit.innerHTML = '✏️';
                btnEdit.title = 'Editar';
                btnEdit.style.background = 'none';
                btnEdit.style.border = 'none';
                btnEdit.style.cursor = 'pointer';
                btnEdit.style.fontSize = '1.1rem';
                btnEdit.onclick = (e) => { e.stopPropagation(); updateLead(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteLead(item.id, item.nome); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        { key: 'nome', label: 'Nome', width: 'auto', align: 'left', type: 'text' },
        { key: 'email', label: 'E-mail', width: '200px', align: 'left', type: 'text' },
        { key: 'telefone', label: 'Telefone', width: '150px', align: 'left', type: 'text' },
        {
            key: 'grupos_nomes',
            label: 'Grupos',
            width: '200px',
            align: 'left',
            type: 'text',
            render: (item) => {
                if (!item.grupos_nomes) return '-';
                // Replace | with badged items or just text? User asked for text with | but badges are nicer?
                // User: "Uma alternativa é concatenar os nomes dos Grupos separados por um ' | '"
                // User asked specifically for that. But badges are cool. 
                // Let's stick to text first as requested "concatenar... separar por |".
                // I'll make it bold or something.
                return item.grupos_nomes;
            }
        },
        {
            key: 'caracteristicas_nomes',
            label: 'Características',
            width: '200px',
            align: 'left',
            type: 'text',
            render: (item) => {
                if (!item.caracteristicas_nomes) return '-';
                return item.caracteristicas_nomes;
            }
        }
    ];

    const loadLeads = async () => {
        try {
            // Show loading state if table exists
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.add('loading');
            }

            const response = await fetch(`${API_BASE_URL}/marketing/leads`, {
                headers: getHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'Falha ao carregar leads');
            }

            leads = await response.json();
            renderLeads();

        } catch (error) {
            console.error('Error loading leads:', error);
            showToast(error.message, 'error');

            // Render Error State with Fix Button
            container.querySelector('#table-container').innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; text-align: center; color: var(--color-text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h3 style="margin-bottom: 0.5rem; color: var(--color-text-primary);">Erro ao carregar dados</h3>
                    <p style="margin-bottom: 1.5rem;">O módulo de marketing parece não estar configurado corretamente.</p>
                    <button id="btn-fix-db" class="btn-primary" style="background-color: #f59e0b; border-color: #f59e0b;">
                        🛠️ Inicializar Banco de Dados
                    </button>
                    <p id="fix-status" style="margin-top: 1rem; font-size: 0.9rem; opacity: 0; transition: opacity 0.3s;">Inicializando...</p>
                </div>
            `;

            const fixBtn = container.querySelector('#btn-fix-db');
            if (fixBtn) {
                fixBtn.onclick = async () => {
                    const statusEl = container.querySelector('#fix-status');
                    fixBtn.disabled = true;
                    fixBtn.textContent = 'Processando...';
                    statusEl.style.opacity = '1';

                    try {
                        const res = await fetch(`${API_BASE_URL}/migration/run-marketing-migration`);
                        const data = await res.json();

                        if (data.success) {
                            showToast('Banco de dados configurado com sucesso! Recarregando...', 'success');
                            setTimeout(loadLeads, 1500);
                        } else {
                            throw new Error(data.details || data.error || 'Erro desconhecido');
                        }
                    } catch (err) {
                        showToast('Falha na correção: ' + err.message, 'error');
                        fixBtn.disabled = false;
                        fixBtn.textContent = 'Tentar Novamente';
                    }
                };
            }

        } finally {
            if (sharedTable && container.querySelector('#table-container') && !container.querySelector('#btn-fix-db')) {
                container.querySelector('#table-container').classList.remove('loading');
            }
        }
    };

    const renderLeads = () => {
        if (sharedTable) {
            sharedTable.render(leads);
        }
        updateFooter();
    };

    const updateFooter = () => {
        const totalCount = container.querySelector('#total-count');
        if (totalCount) {
            totalCount.textContent = leads.length;
        }
    };

    const createLead = async () => {
        try {
            // Fetch grupos and caracteristicas
            const [gruposRes, caracsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/marketing/caracteristicas`, { headers: getHeaders() })
            ]);

            if (!gruposRes.ok || !caracsRes.ok) {
                throw new Error('Erro ao carregar dados para o formulário');
            }

            const grupos = await gruposRes.json();
            const caracteristicas = await caracsRes.json();

            console.log('Loaded grupos:', grupos.length, 'caracteristicas:', caracteristicas.length);

            await LeadModal.show({
                lead: null,
                grupos: grupos,
                caracteristicas: caracteristicas,
                onSave: async (leadData) => {
                    const response = await fetch(`${API_BASE_URL}/marketing/leads`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify(leadData)
                    });

                    if (response.ok) {
                        showToast('Lead criado com sucesso!', 'success');
                        loadLeads();
                    } else {
                        const error = await response.json();
                        throw new Error(error.error || 'Erro ao criar lead');
                    }
                }
            });
        } catch (error) {
            console.error('Error in createLead:', error);
            showToast(error.message || 'Erro ao abrir formulário', 'error');
        }
    };

    const updateLead = async (lead) => {
        try {
            // Fetch grupos and caracteristicas
            const [gruposRes, caracsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/marketing/grupos-leads`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/marketing/caracteristicas`, { headers: getHeaders() })
            ]);

            if (!gruposRes.ok || !caracsRes.ok) {
                throw new Error('Erro ao carregar dados para o formulário');
            }

            const grupos = await gruposRes.json();
            const caracteristicas = await caracsRes.json();

            console.log('Loaded grupos:', grupos.length, 'caracteristicas:', caracteristicas.length);

            await LeadModal.show({
                lead: lead,
                grupos: grupos,
                caracteristicas: caracteristicas,
                onSave: async (leadData) => {
                    const response = await fetch(`${API_BASE_URL}/marketing/leads/${lead.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify(leadData)
                    });

                    if (response.ok) {
                        showToast('Lead atualizado com sucesso!', 'success');
                        loadLeads();
                    } else {
                        const error = await response.json();
                        throw new Error(error.error || 'Erro ao atualizar lead');
                    }
                }
            });
        } catch (error) {
            console.error('Error in updateLead:', error);
            showToast(error.message || 'Erro ao abrir formulário', 'error');
        }
    };

    const deleteLead = async (id, nome) => {
        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir "${nome}"?`,
            'Sim, Excluir'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/leads/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Lead excluído com sucesso!', 'success');
                loadLeads();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir lead', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    // Custom confirmation dialog
    const showCustomConfirm = (message, confirmText = 'Sim') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.background = 'rgba(0,0,0,0.4)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '100000';

            const box = document.createElement('div');
            box.style.background = 'white';
            box.style.padding = '24px';
            box.style.borderRadius = '12px';
            box.style.maxWidth = '400px';
            box.style.width = '90%';
            box.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
            box.style.textAlign = 'center';

            box.innerHTML = `
                <h3 style="margin: 0 0 16px 0; color: var(--color-primary); font-size: 1.25rem;">Confirmação</h3>
                <p style="margin: 0 0 24px 0; color: #555; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="confirm-no" style="
                        background: transparent; border: 1px solid #ccc; padding: 8px 16px; 
                        border-radius: 6px; cursor: pointer; color: #555; font-weight: 500;">
                        Não
                    </button>
                    <button id="confirm-yes" style="
                        background: var(--color-primary); border: none; padding: 8px 16px; 
                        border-radius: 6px; cursor: pointer; color: white; font-weight: 500;">
                        ${confirmText}
                    </button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const cleanup = (result) => {
                document.body.removeChild(overlay);
                resolve(result);
            };

            box.querySelector('#confirm-yes').onclick = () => cleanup(true);
            box.querySelector('#confirm-no').onclick = () => cleanup(false);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
        });
    };

    // Build UI
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>🎯 Leads</h2>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new-lead" class="btn-primary">+ Novo Lead</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden;"></div>
        
        <div id="footer-summary" style="margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted);">
            Total: <span id="total-count">0</span> lead(s)
        </div>
    `;

    // Event Listeners
    container.querySelector('#btn-new-lead').addEventListener('click', createLead);

    // Bulk Actions UI
    const bulkActionsContainer = document.createElement('div');
    bulkActionsContainer.id = 'bulk-actions-bar';
    bulkActionsContainer.style.position = 'absolute';
    bulkActionsContainer.style.bottom = '40px'; // Above footer
    bulkActionsContainer.style.left = '50%';
    bulkActionsContainer.style.transform = 'translateX(-50%) translateY(100px)'; // Hidden by default
    bulkActionsContainer.style.backgroundColor = 'var(--color-bg-primary)';
    bulkActionsContainer.style.border = '1px solid var(--color-border-light)';
    bulkActionsContainer.style.borderRadius = '8px';
    bulkActionsContainer.style.padding = '12px 24px';
    bulkActionsContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    bulkActionsContainer.style.display = 'flex';
    bulkActionsContainer.style.alignItems = 'center';
    bulkActionsContainer.style.gap = '16px';
    bulkActionsContainer.style.zIndex = '100';
    bulkActionsContainer.style.transition = 'transform 0.3s ease-out';

    bulkActionsContainer.innerHTML = `
        <span id="bulk-selected-count" style="font-weight: 600; color: var(--color-text-primary);">0 selecionados</span>
        <div style="height: 24px; width: 1px; background: var(--color-border-light);"></div>
        <button id="btn-bulk-char" class="btn-secondary" style="font-size: 0.9rem; padding: 6px 12px;">
            ✏️ Alterar Característica
        </button>
    `;

    container.appendChild(bulkActionsContainer);
    container.style.position = 'relative'; // Ensure container is relative for absolute bar

    const updateBulkBar = (selectedCount) => {
        const countSpan = bulkActionsContainer.querySelector('#bulk-selected-count');
        if (countSpan) countSpan.textContent = `${selectedCount} selecionado${selectedCount !== 1 ? 's' : ''}`;

        if (selectedCount > 0) {
            bulkActionsContainer.style.transform = 'translateX(-50%) translateY(-20px)';
        } else {
            bulkActionsContainer.style.transform = 'translateX(-50%) translateY(100px)';
        }
    };

    // Bulk Characteristic Modal
    const showBulkCharModal = async (selectedIds) => {
        try {
            const caracsRes = await fetch(`${API_BASE_URL}/marketing/caracteristicas`, { headers: getHeaders() });
            if (!caracsRes.ok) throw new Error('Erro ao carregar características');
            const caracteristicas = await caracsRes.json();

            // Create Simple Modal Overlay
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.zIndex = '10000';

            overlay.innerHTML = `
                <div class="account-modal animate-float-in" style="max-width: 400px; width: 90%; padding: 20px;">
                    <h3 style="margin-top: 0; color: var(--color-primary);">Alterar Característica em Massa</h3>
                    <p style="color: #666; font-size: 0.9rem; margin-bottom: 20px;">
                        Aplicar alteração para <strong>${selectedIds.length}</strong> leads selecionados.
                    </p>

                    <div class="form-group">
                        <label>Característica</label>
                        <select id="bulk-char-select" class="form-input">
                            <option value="">Selecione...</option>
                            ${caracteristicas.map(c => `<option value="${c.id}" data-type="${c.tipo}">${c.nome}</option>`).join('')}
                        </select>
                    </div>

                    <div id="bulk-value-container" class="form-group" style="display: none;">
                        <label>Valor</label>
                        <div id="bulk-value-input-wrapper"></div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                        <button id="bulk-cancel" class="btn-secondary">Cancelar</button>
                        <button id="bulk-confirm" class="btn-primary" disabled>Aplicar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const selectChar = overlay.querySelector('#bulk-char-select');
            const valueContainer = overlay.querySelector('#bulk-value-container');
            const valueWrapper = overlay.querySelector('#bulk-value-input-wrapper');
            const confirmBtn = overlay.querySelector('#bulk-confirm');
            const cancelBtn = overlay.querySelector('#bulk-cancel');

            let selectedCharValues = [];

            selectChar.addEventListener('change', async (e) => {
                const charId = e.target.value;
                confirmBtn.disabled = true;

                if (!charId) {
                    valueContainer.style.display = 'none';
                    return;
                }

                // Fetch values for this characteristic to check if it has preset values
                // Or use the 'tipo' if we had it. 
                // Let's assume we need to fetch possible values if it's a list type?
                // Actually, backend query `marketing/caracteristicas` might not return values.
                // We should check `caracteristicasController`. `getAll` just returns chars.
                // We need to fetch values for the selected char OR assume boolean/text.
                // Let's safe fetch values.

                try {
                    // Try to fetch values. If 404 or empty, assume text input?
                    // Or if backend `caracteristicas` object implies type?
                    // Currently `caracteristicas` table has `tipo`. 
                    // Let's stick to consistent UI. If it has predefined values, show select.
                    // If not, show text.
                    // We can check `caracteristicas/:id/valores`.
                    const valsRes = await fetch(`${API_BASE_URL}/marketing/caracteristicas/${charId}/valores`, { headers: getHeaders() });
                    if (valsRes.ok) {
                        selectedCharValues = await valsRes.json();
                    } else {
                        selectedCharValues = [];
                    }
                } catch (err) { selectedCharValues = []; }

                valueContainer.style.display = 'block';
                valueWrapper.innerHTML = '';

                if (selectedCharValues.length > 0) {
                    const sel = document.createElement('select');
                    sel.className = 'form-input';
                    sel.innerHTML = `
                        <option value="">Selecione o valor...</option>
                        ${selectedCharValues.map(v => `<option value="${v.id}">${v.valor}</option>`).join('')}
                    `;
                    sel.onchange = () => { confirmBtn.disabled = !sel.value; };
                    valueWrapper.appendChild(sel);
                } else {
                    // If no values, maybe it's a simple tag (Boolean) or Text?
                    // Currently system seems to rely on `valor_id` (from `caracteristica_valores`). 
                    // If there are no `caracteristica_valores`, we can't assign a `valor_id`.
                    // Does the system support free text values? 
                    // `leads_caracteristicas` has `valor_id` FK. It might NOT verify FK if nullable?
                    // But `marketingController` uses `valor_id`.
                    // So we MUST have a `valor_id`.
                    // If a characteristic has no values, we cannot assign it? 
                    // Or maybe "Sim" is a default value?
                    // Let's warn user if no values found.
                    valueWrapper.innerHTML = '<span style="color: orange; font-size: 0.9rem;">Esta característica não possui valores pré-definidos. Cadastre valores em Marketing > Características antes de usar.</span>';
                }
            });

            confirmBtn.onclick = async () => {
                const charId = selectChar.value;
                const valSelect = valueWrapper.querySelector('select');
                const valId = valSelect ? valSelect.value : null;

                if (!charId || !valId) return;

                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Aplicando...';

                try {
                    const res = await fetch(`${API_BASE_URL}/marketing/leads/bulk-characteristic`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            leadsIds: selectedIds,
                            caracteristicaId: charId,
                            valorId: valId
                        })
                    });

                    if (res.ok) {
                        showToast('Alteração em massa realizada!', 'success');
                        document.body.removeChild(overlay);
                        sharedTable.section = new Set(); // Clear
                        updateBulkBar(0);
                        loadLeads();
                    } else {
                        throw new Error('Falha na atualização');
                    }
                } catch (err) {
                    showToast('Erro ao aplicar alteração', 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Aplicar';
                }
            };

            cancelBtn.onclick = () => document.body.removeChild(overlay);
            overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };

        } catch (error) {
            console.error(error);
            showToast('Erro ao abrir alteração em massa', 'error');
        }
    };

    bulkActionsContainer.querySelector('#btn-bulk-char').addEventListener('click', () => {
        if (sharedTable && sharedTable.selection.size > 0) {
            showBulkCharModal(Array.from(sharedTable.selection));
        }
    });

    // Initialize SharedTable
    const tableContainer = container.querySelector('#table-container');
    const footerElement = container.querySelector('#footer-summary');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        data: [],
        footer: footerElement,
        enableSelection: true,
        onSelectionChange: (items, set) => {
            updateBulkBar(set.size);
        }
    });

    // Load data
    loadLeads();

    return container;
};
