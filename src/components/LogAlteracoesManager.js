import { SharedTable } from './SharedTable.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { showToast } from '../utils/toast.js';

export const LogAlteracoesManager = (project) => {
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

    // State
    let logs = [];
    let pagination = { page: 1, limit: 50, total: 0, pages: 1 };
    let activeFilters = {};
    let sortConfig = { key: 'created_at', direction: 'desc' };

    // Columns
    const columns = [
        {
            key: 'created_at',
            label: 'Data/Hora',
            width: '180px',
            align: 'left',
            type: 'date',
            render: (row) => {
                if (!row.created_at) return '-';
                const d = new Date(row.created_at + (row.created_at.includes('Z') ? '' : 'Z'));
                return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }
        },
        { key: 'user_name', label: 'Usuário', width: '200px', align: 'left', type: 'text' },
        {
            key: 'action',
            label: 'Ação',
            width: '120px',
            align: 'center',
            type: 'text',
            render: (row) => {
                const colors = {
                    'CREATE': 'green',
                    'UPDATE': 'blue',
                    'DELETE': 'red'
                };
                const labels = {
                    'CREATE': 'Criação',
                    'UPDATE': 'Edição',
                    'DELETE': 'Exclusão'
                };
                const color = colors[row.action] || 'black';
                const label = labels[row.action] || row.action;
                const span = document.createElement('span');
                span.style.color = color;
                span.style.fontWeight = 'bold';
                span.textContent = label;
                return span;
            }
        },
        {
            key: 'entity',
            label: 'Módulo',
            width: '150px',
            align: 'left',
            type: 'text',
            render: (row) => {
                const map = {
                    'entradas': 'Entradas',
                    'saidas': 'Saídas',
                    'producao_revenda': 'Produção',
                    'aportes': 'Aportes',
                    'retiradas': 'Retiradas',
                    'transferencias': 'Transferências'
                };
                return document.createTextNode(map[row.entity] || row.entity);
            }
        },
        {
            key: 'details',
            label: 'Detalhes',
            width: 'auto',
            align: 'left',
            type: 'custom',
            render: (row) => {
                const container = document.createElement('div');

                // Parse old_data and new_data
                let oldData = null;
                let newData = null;

                try {
                    oldData = row.old_data ? (typeof row.old_data === 'string' ? JSON.parse(row.old_data) : row.old_data) : null;
                } catch (e) {
                    console.warn('Failed to parse old_data:', e);
                }

                try {
                    newData = row.new_data ? (typeof row.new_data === 'string' ? JSON.parse(row.new_data) : row.new_data) : null;
                } catch (e) {
                    console.warn('Failed to parse new_data:', e);
                }

                // Create summary
                const summary = document.createElement('div');
                summary.style.fontSize = '0.85rem';

                if (oldData || newData) {
                    const lines = [];

                    if (oldData) {
                        const keys = Object.keys(oldData).filter(k => !k.includes('password')).slice(0, 2);
                        const preview = keys.map(k => `${k}: ${oldData[k]}`).join(', ');
                        lines.push(`<strong style="color: #3B82F6;">OLD:</strong> ${preview}${Object.keys(oldData).length > 2 ? '...' : ''}`);
                    }

                    if (newData) {
                        const keys = Object.keys(newData).filter(k => !k.includes('password')).slice(0, 2);
                        const preview = keys.map(k => `${k}: ${newData[k]}`).join(', ');
                        lines.push(`<strong style="color: #10B981;">NEW:</strong> ${preview}${Object.keys(newData).length > 2 ? '...' : ''}`);
                    }

                    summary.innerHTML = lines.join('<br>');

                    // Add expand button
                    const expandBtn = document.createElement('button');
                    expandBtn.textContent = '🔍 Ver JSON';
                    expandBtn.style.cssText = 'margin-left: 8px; padding: 2px 6px; background: #E5E7EB; border: 1px solid #D1D5DB; border-radius: 4px; cursor: pointer; font-size: 0.75rem;';
                    expandBtn.onclick = (e) => {
                        e.stopPropagation();
                        showJsonModal(row.entity, row.action, oldData, newData);
                    };

                    container.appendChild(summary);
                    container.appendChild(expandBtn);
                } else {
                    // Fallback to details field
                    try {
                        const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
                        summary.textContent = JSON.stringify(details).substring(0, 60) + '...';
                        container.appendChild(summary);
                    } catch (e) {
                        summary.textContent = row.details || '-';
                        container.appendChild(summary);
                    }
                }

                return container;
            }
        },
        {
            key: 'undo',
            label: 'Ações',
            width: '120px',
            align: 'center',
            noFilter: true,
            render: (row) => {
                // Check if already undone
                if (row.undone_at) {
                    const span = document.createElement('span');
                    span.textContent = '✅ Desfeito';
                    span.style.color = '#10B981';
                    span.style.fontSize = '0.9rem';
                    return span;
                }

                // Check if has old_data (can be undone) - INSERT doesn't need old_data
                if (row.action !== 'DELETE' && row.action !== 'UPDATE' && row.action !== 'INSERT') {
                    console.log(`[UNDO] Blocking: action "${row.action}" not supported`, row);
                    return document.createTextNode('-');
                }

                // INSERT doesn't need old_data, DELETE and UPDATE do
                if ((row.action === 'DELETE' || row.action === 'UPDATE') && !row.old_data) {
                    console.log(`[UNDO] Blocking: ${row.action} has no old_data`, row);
                    return document.createTextNode('-');
                }

                // For INSERT, we need entity_id (primary key) to delete
                if (row.action === 'INSERT' && !row.entity_id) {
                    console.log(`[UNDO] Blocking INSERT: missing entity_id`, row);
                    return document.createTextNode('-');
                }

                console.log(`[UNDO] Showing button for ${row.action}`, row);
                // Create undo button
                const btn = document.createElement('button');
                btn.innerHTML = '↩️ Desfazer';
                btn.className = 'btn-sm';
                btn.style.background = '#F59E0B';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.style.padding = '4px 8px';
                btn.style.borderRadius = '4px';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '0.85rem';
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    await undoAction(row.id, row.action, row.entity);
                };
                return btn;
            }
        }
    ];

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Show JSON modal for detailed view
    const showJsonModal = (entity, action, oldData, newData) => {
        const modalHTML = `
            <div class="json-modal-backdrop" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div class="json-modal-content" style="background: var(--color-bg-card); color: var(--color-text-dark); padding: 30px; border-radius: 12px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); font-family: monospace; border: 1px solid var(--color-border-light);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--color-border-light); padding-bottom: 15px;">
                        <h2 style="margin: 0; color: var(--color-text-dark); font-size: 1.25rem;">
                            📋 Detalhes do Log - ${entity} (${action})
                        </h2>
                        <button id="json-close-btn" style="background: #EF4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            ✕ Fechar
                        </button>
                    </div>
                    
                    ${oldData ? `
                    <div style="margin-bottom: 25px;">
                        <h3 style="color: #60A5FA; margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.5rem;">📄</span> Dados ANTES (old_data)
                        </h3>
                        <pre style="background: var(--color-bg-secondary); padding: 16px; border-radius: 8px; overflow-x: auto; border-left: 4px solid #60A5FA; margin: 0; color: var(--color-text-dark); font-size: 0.875rem; line-height: 1.5; border: 1px solid var(--color-border-light);">${JSON.stringify(oldData, null, 2)}</pre>
                    </div>
                    ` : ''}
                    
                    ${newData ? `
                    <div>
                        <h3 style="color: #34D399; margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.5rem;">📝</span> Dados DEPOIS (new_data)
                        </h3>
                        <pre style="background: var(--color-bg-secondary); padding: 16px; border-radius: 8px; overflow-x: auto; border-left: 4px solid #34D399; margin: 0; color: var(--color-text-dark); font-size: 0.875rem; line-height: 1.5; border: 1px solid var(--color-border-light);">${JSON.stringify(newData, null, 2)}</pre>
                    </div>
                    ` : ''}
                    
                    ${!oldData && !newData ? `
                    <div style="text-align: center; padding: 40px; color: var(--color-text-muted);">
                        <div style="font-size: 3rem; margin-bottom: 16px;">📭</div>
                        <p style="margin: 0; font-size: 1.125rem;">Nenhum dado disponível para exibição</p>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = modalHTML;
        document.body.appendChild(modalDiv);

        const closeBtn = modalDiv.querySelector('#json-close-btn');
        const backdrop = modalDiv.querySelector('.json-modal-backdrop');

        const cleanup = () => document.body.removeChild(modalDiv);

        closeBtn.onclick = cleanup;
        backdrop.onclick = (e) => {
            if (e.target === backdrop) cleanup();
        };

        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    };

    // Undo an action with enhanced confirmation modal
    const undoAction = async (logId, action, entity) => {
        try {
            // Fetch full log entry from API to get old_data
            const response = await fetch(`${API_BASE_URL}/audit-logs?logId=${logId}`, {
                headers: getHeaders()
            });

            if (!response.ok) {
                throw new Error('Erro ao buscar dados do log');
            }

            const result = await response.json();
            const logEntry = Array.isArray(result.data) ? result.data[0] : result[0];

            if (!logEntry) {
                showToast('❌ Log não encontrado', 'error');
                return;
            }

            const actionLabel = action === 'DELETE' ? 'exclusão' : (action === 'INSERT' ? 'criação' : 'alteração');
            const actionVerb = action === 'DELETE' ? 'restaurar' : (action === 'INSERT' ? 'deletar' : 'reverter');

            // Parse old_data and new_data to show what will be restored
            let oldDataPreview = '';
            let newDataPreview = '';
            let oldDataFull = {};
            let newDataFull = {};

            try {
                oldDataFull = logEntry.old_data ? (typeof logEntry.old_data === 'string' ? JSON.parse(logEntry.old_data) : logEntry.old_data) : {};
                newDataFull = logEntry.new_data ? (typeof logEntry.new_data === 'string' ? JSON.parse(logEntry.new_data) : logEntry.new_data) : {};

                const oldKeys = Object.keys(oldDataFull).filter(k => !k.includes('password')).slice(0, 3);
                oldDataPreview = oldKeys.map(key => `<strong>${key}:</strong> ${oldDataFull[key]}`).join('<br>');
                if (Object.keys(oldDataFull).length > 3) {
                    oldDataPreview += '<br>...';
                }

                const newKeys = Object.keys(newDataFull).filter(k => !k.includes('password')).slice(0, 3);
                newDataPreview = newKeys.map(key => `<strong>${key}:</strong> ${newDataFull[key]}`).join('<br>');
                if (Object.keys(newDataFull).length > 3) {
                    newDataPreview += '<br>...';
                }
            } catch (e) {
                console.error('Error parsing audit data:', e);
                oldDataPreview = 'Dados não disponíveis';
                newDataPreview = 'Dados não disponíveis';
            }

            // Define warning icon based on action
            let warningIcon = '';
            if (action === 'DELETE') {
                warningIcon = '♻️';
            } else if (action === 'UPDATE') {
                warningIcon = '↩️';
            } else if (action === 'INSERT') {
                warningIcon = '🗑️';
            }

            // Create enhanced confirmation modal
            const modalHTML = `
                <div class="modal-backdrop" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
                    <div class="modal-content" style="background: white; padding: 30px; border-radius: 12px; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
                            <h2 style="margin: 0; color: #DC2626; font-size: 1.5rem;">OPERAÇÃO DE ALTO RISCO</h2>
                        </div>
                        
                        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                            <strong style="color: #B45309;">⚡ ATENÇÃO:</strong>
                            <p style="margin: 8px 0 0 0; color: #92400E;">
                                Esta ação irá <strong>${actionVerb}</strong> permanentemente a ${actionLabel} realizada.
                                <br><br>
                                <strong>Entidade:</strong> ${entity}<br>
                                <strong>Operação:</strong> ${action}
                            </p>
                        </div>
                            <div style="background: var(--color-bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #F59E0B;">
                                <p style="margin: 0 0 8px 0; font-weight: 600; color: var(--color-text-dark);">📋 Detalhes:</p>
                                <p style="margin: 0; font-size: 0.95rem; color: var(--color-text-muted);">
                                    <strong>Tabela:</strong> ${entity}<br>
                                    <strong>Ação:</strong> ${actionLabel}
                                </p>
                                ${oldDataPreview ? `<p style="margin: 8px 0 0 0; font-size: 0.9rem; font-family: monospace; color: var(--color-text-muted);">${oldDataPreview}</p>` : ''}
                            </div>
                            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                <button id="cancel-undo" style="padding: 10px 24px; border: 1px solid var(--color-border-light); background: var(--color-bg-secondary); color: var(--color-text-dark); border-radius: 6px; cursor: pointer; font-weight: 500;">
                                    Cancelar
                                </button>
                                <button id="confirm-undo" style="padding: 10px 24px; border: none; background: #F59E0B; color: white; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                    ${warningIcon} Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            // Show modal
            const modalDiv = document.createElement('div');
            modalDiv.innerHTML = modalHTML;
            document.body.appendChild(modalDiv);

            // Handle buttons
            return new Promise((resolve) => {
                const confirmBtn = modalDiv.querySelector('#undo-confirm-btn');
                const cancelBtn = modalDiv.querySelector('#undo-cancel-btn');
                const backdrop = modalDiv.querySelector('.modal-backdrop');

                const cleanup = () => {
                    document.body.removeChild(modalDiv);
                };

                const handleConfirm = async () => {
                    cleanup();
                    try {
                        const undoResponse = await fetch(`${API_BASE_URL}/audit-logs/undo/${logId}`, {
                            method: 'POST',
                            headers: getHeaders()
                        });

                        const result = await undoResponse.json();

                        if (!undoResponse.ok) {
                            throw new Error(result.error || 'Erro ao desfazer ação');
                        }

                        showToast('✅ Ação desfeita com sucesso!', 'success');
                        loadLogs(pagination.page); // Reload current page
                    } catch (error) {
                        console.error('Undo error:', error);
                        if (error.message.includes('403')) {
                            showToast('❌ Acesso restrito a usuários Master', 'error');
                        } else {
                            showToast(`❌ ${error.message}`, 'error');
                        }
                    }
                    resolve();
                };

                const handleCancel = () => {
                    cleanup();
                    resolve();
                };

                confirmBtn.onclick = handleConfirm;
                cancelBtn.onclick = handleCancel;
                backdrop.onclick = (e) => {
                    if (e.target === backdrop) handleCancel();
                };
            });
        } catch (error) {
            console.error('Error loading log for undo:', error);
            showToast(`❌ Erro ao carregar log: ${error.message}`, 'error');
        }
    };

    // SharedTable Instance
    let sharedTable = null;

    const loadLogs = async (page = 1) => {
        try {
            container.querySelector('#table-container')?.classList.add('loading');

            const params = new URLSearchParams({
                projectId: project.id,
                page: page,
                limit: pagination.limit
            });

            if (sortConfig.key) {
                params.append('sortBy', sortConfig.key);
                params.append('order', sortConfig.direction);
            }

            // Map filters to API params
            Object.keys(activeFilters).forEach(key => {
                const filter = activeFilters[key];
                if (!filter) return;

                if (key === 'created_at') {
                    if (filter.start) params.append('startDate', filter.start);
                    if (filter.end) params.append('endDate', filter.end);
                } else if (filter.text) {
                    params.append('search', filter.text);
                }
            });

            const response = await fetch(`${API_BASE_URL}/audit-logs?${params.toString()}`, {
                headers: getHeaders()
            });

            if (!response.ok) throw new Error('Falha ao carregar logs');

            const result = await response.json();

            if (result.meta) {
                logs = result.data;
                pagination = result.meta;
            } else {
                logs = Array.isArray(result) ? result : [];
                pagination = { page: 1, limit: logs.length, total: logs.length, pages: 1 };
            }

            if (sharedTable) {
                sharedTable.render(logs);
            }
            renderPagination();

        } catch (error) {
            console.error('Error loading logs:', error);
            showToast(error.message, 'error');
        } finally {
            container.querySelector('#table-container')?.classList.remove('loading');
        }
    };

    const renderPagination = () => {
        const pagContainer = container.querySelector('.pagination-controls');
        if (!pagContainer) return;

        pagContainer.innerHTML = '';
        const btnPrev = document.createElement('button');
        btnPrev.className = 'btn-sm';
        btnPrev.textContent = '◀ Anterior';
        btnPrev.disabled = pagination.page <= 1;
        btnPrev.onclick = () => loadLogs(pagination.page - 1);

        const label = document.createElement('span');
        label.textContent = `Página ${pagination.page} de ${pagination.pages}`;
        label.style.margin = '0 1rem';

        const btnNext = document.createElement('button');
        btnNext.className = 'btn-sm';
        btnNext.textContent = 'Próxima ▶';
        btnNext.disabled = pagination.page >= pagination.pages;
        btnNext.onclick = () => loadLogs(pagination.page + 1);

        pagContainer.appendChild(btnPrev);
        pagContainer.appendChild(label);
        pagContainer.appendChild(btnNext);

        // Total display
        const totalDisplay = container.querySelector('#total-display');
        if (totalDisplay) {
            totalDisplay.innerHTML = `<strong>Total:</strong> ${pagination.total} registros`;
        }
    };

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>📜 Log de Alterações</h2>
            <div style="display: flex; gap: 0.5rem;">
                <span style="font-size: 0.9rem; color: var(--color-primary);">Configurações</span>
                <span style="color: var(--color-text-muted);">/</span>
                <span style="font-size: 0.9rem; color: var(--color-text-muted);">Log</span>
            </div>
        </div>
        
        <div id="table-container" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
            <!-- SharedTable renders here -->
        </div>

        <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-top: 1px solid var(--color-border-light);">
            <div id="total-display"></div>
            <div class="pagination-controls" style="display: flex; gap: 0.5rem; align-items: center;"></div>
        </div>
    `;

    // Init SharedTable
    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        projectId: project.id,
        endpointPrefix: null,
        onFilterChange: (filters) => {
            activeFilters = filters;
            loadLogs(1);
        },
        onSortChange: (sort) => {
            sortConfig = sort;
            loadLogs(1);
        }
    });

    loadLogs();

    return container;
};
