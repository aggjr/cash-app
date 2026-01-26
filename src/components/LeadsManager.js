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
    let currentCaracteristicas = [];

    const updateBulkBar = (selectedCount) => {
        const bar = container.querySelector('#bulk-actions-bar');
        if (!bar) return;

        const countSpan = bar.querySelector('#bulk-selected-count');
        if (countSpan) countSpan.textContent = `${selectedCount} selecionado${selectedCount !== 1 ? 's' : ''}`;

        if (selectedCount > 0) {
            bar.style.transform = 'translateX(-50%) translateY(-20px)';
        } else {
            bar.style.transform = 'translateX(-50%) translateY(100px)';
        }
    };

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const buildColumns = (caracteristicas) => {
        const cols = [
            {
                key: 'actions',
                label: 'Ações',
                width: '80px',
                align: 'center',
                noFilter: true,
                sticky: true, // Fixed
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
            { key: 'nome', label: 'Nome', width: '300px', align: 'left', type: 'text', sticky: true }, // Fixed
            { key: 'email', label: 'E-mail', width: '200px', align: 'left', type: 'text' },
            {
                key: 'telefone',
                label: 'Telefone',
                width: '150px',
                align: 'left',
                type: 'text',
                render: (item) => {
                    const phone = item.telefone;
                    if (!phone) return '-';
                    // Visually prepend 55 if missing (simple check for length/digits)
                    const clean = phone.replace(/\D/g, '');
                    if ((clean.length === 10 || clean.length === 11) && !clean.startsWith('55')) {
                        return `55${clean}`;
                    }
                    return phone;
                }
            },
            {
                key: 'grupos_nomes',
                label: 'Grupos',
                width: '200px',
                align: 'left',
                type: 'text',
                render: (item) => item.grupos_nomes || '-'
            }
        ];

        // Dynamic Characteristic Columns
        if (caracteristicas && caracteristicas.length > 0) {
            caracteristicas.forEach(c => {
                cols.push({
                    key: `char_${c.id}`,
                    label: c.nome,
                    width: '150px',
                    align: 'left',
                    type: 'text',
                    render: (item) => {
                        // Value is already pre-processed into char_{id} or we parse here.
                        // Let's assume pre-processing.
                        return item[`char_${c.id}`] || '-';
                    }
                });
            });
        }

        return cols;
    };

    const loadLeads = async () => {
        try {
            // Show loading state if table exists
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.add('loading');
            }

            const [leadsRes, caracsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/marketing/leads`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/marketing/caracteristicas`, { headers: getHeaders() })
            ]);

            if (!leadsRes.ok) {
                const errorData = await leadsRes.json();
                throw new Error(errorData.details || errorData.error || 'Falha ao carregar leads');
            }
            // Characteristics optional
            let caracteristicas = [];
            if (caracsRes.ok) {
                caracteristicas = await caracsRes.json();
            }
            currentCaracteristicas = caracteristicas;

            leads = await leadsRes.json();

            // Pre-process Leads for Characteristcs
            // Expecting item.caracteristicas_json (array of objects {id, nome, valor, valor_id})
            leads.forEach(lead => {
                if (lead.caracteristicas_json) {
                    try {
                        const chars = typeof lead.caracteristicas_json === 'string'
                            ? JSON.parse(lead.caracteristicas_json)
                            : lead.caracteristicas_json;

                        if (Array.isArray(chars)) {
                            chars.forEach(c => {
                                // Flatten to char_{id} = "Value"
                                lead[`char_${c.id}`] = c.valor || '-';
                            });
                        }
                    } catch (e) {
                        console.warn('Erro parsing json caracteristicas', e);
                    }
                }
            });

            // Update Total
            const totalSpan = container.querySelector('#total-count');
            if (totalSpan) totalSpan.textContent = leads.length;

            const cols = buildColumns(caracteristicas);

            if (!sharedTable) {
                try {
                    console.log('Initializing SharedTable with cols:', cols);
                    const tableContainer = container.querySelector('#table-container');
                    const footerSummaryElement = container.querySelector('#footer-summary');

                    if (!tableContainer) throw new Error('Table container not found');

                    sharedTable = new SharedTable({
                        container: tableContainer,
                        columns: cols,
                        data: leads,
                        enableSelection: true,
                        summaryLabels: { total: 'Total Visualizado', selected: 'Selecionados' },
                        onSelectionChange: (items, set) => {
                            selectedItems = set;
                            selectedItemsData = items;
                        },
                        onBulkDelete: handleBulkDelete,
                        onBulkEdit: handleBulkEdit
                    });
                    sharedTable.render(leads); // Force initial render
                } catch (renderErr) {
                    console.error('SharedTable Render Error:', renderErr);
                    showToast('Erro ao renderizar tabela: ' + renderErr.message, 'error');
                }
            } else {
                try {
                    sharedTable.columns = cols;
                    sharedTable.render(leads); // Updates data and re-renders with new columns
                } catch (renderErr) {
                    console.error('SharedTable Update Error:', renderErr);
                    showToast('Erro ao atualizar tabela: ' + renderErr.message, 'error');
                }
            }

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
            // Fetch lead details to get complete characteristics with valor_id
            const leadDetailsRes = await fetch(`${API_BASE_URL}/marketing/leads/${lead.id}`, { headers: getHeaders() });
            if (!leadDetailsRes.ok) {
                throw new Error('Erro ao carregar detalhes do lead');
            }
            const leadDetails = await leadDetailsRes.json();

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
            console.log('Lead details:', leadDetails);

            // Use leadDetails which has caracteristicas_detalhadas with valor_id
            await LeadModal.show({
                lead: leadDetails,
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

    // State for selection
    let selectedItems = new Set();
    let selectedItemsData = [];

    const handleBulkDelete = async () => {
        if (selectedItems.size === 0) return;

        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir ${selectedItems.size} leads?`,
            'Sim, Excluir'
        );

        if (!confirmed) return;

        try {
            container.querySelector('#table-container').classList.add('loading');

            // Loop delete
            const promises = Array.from(selectedItems).map(id =>
                fetch(`${API_BASE_URL}/marketing/leads/${id}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                })
            );

            await Promise.all(promises);

            showToast(`${selectedItems.size} leads excluídos com sucesso!`, 'success');
            selectedItems.clear();
            selectedItemsData = [];
            if (sharedTable) sharedTable.clearSelection();
            loadLeads();
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir leads', 'error');
        } finally {
            container.querySelector('#table-container').classList.remove('loading');
        }
    };

    const handleBulkEdit = async () => {
        if (selectedItems.size === 0) return;
        // Use existing Bulk Characteristic Modal as the default "Edit" action for now
        showBulkCharModal(Array.from(selectedItems));
    };

    // Build UI
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>🎯 Leads</h2>
        </div>

        <div style="margin-bottom: 1rem;">
            <button id="btn-new-lead" class="btn-primary">+ Novo Lead</button>
        </div>

        <div id="table-container" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;"></div>
    `;

    // Event Listeners
    container.querySelector('#btn-new-lead').addEventListener('click', createLead);

    // Initial SharedTable with empty data or headers
    const tableContainer = container.querySelector('#table-container');

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

                try {
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
                        selectedItems.clear(); // Clear local
                        selectedItemsData = [];
                        if (sharedTable) sharedTable.clearSelection(); // Clear table
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

    // Load data
    loadLeads();

    return container;
};
