import { TransferenciaModal } from './TransferenciaModal.js';
import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { PrintHelper } from '../utils/printHelper.js';
import { createPagedData } from '../utils/pagedData.js';

export const TransferenciaManager = (project) => {
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
    let transferencias = [];
    let pagination = { page: 1, limit: 50, total: 0, pages: 1 };
    let activeFilters = {};
    let sortConfig = { key: 'data_prevista', direction: 'desc' };

    // Define Columns for SharedTable
    const columns = [
        {
            key: 'actions',
            label: 'Ações',
            width: '80px',
            align: 'center',
            noFilter: true,
            sticky: true,
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
                btnEdit.onclick = (e) => { e.stopPropagation(); updateTransferencia(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteTransferencia(item.id); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        { key: 'data_prevista', label: 'Prevista', width: '90px', align: 'center', type: 'date' },
        { key: 'data_real', label: 'Real', width: '90px', align: 'center', type: 'date' },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        { key: 'source_account_name', label: 'Origem (Sai)', width: '180px', align: 'left', type: 'text' },
        { key: 'destination_account_name', label: 'Destino (Entra)', width: '180px', align: 'left', type: 'text' },
        {
            key: 'valor',
            label: 'Valor',
            width: '120px',
            align: 'right',
            type: 'currency',
            colorLogic: 'blue' // Blue color for neutral transfers
        },
        {
            key: 'link',
            label: 'Link',
            width: '60px',
            align: 'center',
            type: 'link',
            render: (item) => {
                const btn = document.createElement('button');
                btn.innerHTML = '📎';
                btn.style.background = 'none';
                btn.style.border = 'none';
                btn.style.fontSize = '1.2rem';
                btn.style.padding = '0';
                if (item.comprovante_url) {
                    btn.style.cursor = 'pointer';
                    btn.title = 'Ver anexo';
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        window.open(`${API_BASE_URL}${item.comprovante_url}`, '_blank');
                    };
                } else {
                    btn.style.cursor = 'default';
                    btn.style.opacity = '0.3';
                    btn.title = 'Sem anexo';
                }
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

    // SharedTable Instance
    let sharedTable = null;

    const buildListParams = (page, limit) => {
            const params = new URLSearchParams({
                projectId: project.id,
                page: page,
                limit: limit
            });

            // Handle Sorting
            if (sortConfig.key) {
                params.append('sortBy', sortConfig.key);
                params.append('order', sortConfig.direction);
            }

            // Handle Filters
            Object.keys(activeFilters).forEach(key => {
                const filter = activeFilters[key];
                if (!filter) return;

                if (key === 'valor') {
                    console.log('💰 VALOR FILTER:', filter);

                    // Operator-based format (advanced filter)
                    if (filter.operator && filter.val1) {
                        console.log(`  ➡️ Operator: ${filter.operator}, Value: ${filter.val1}`);
                        if (filter.operator === 'eq') {
                            // Exact match - using min/max range for equality
                            console.log('  ➡️ Adding min/max for exact match:', filter.val1);
                            params.append('minValue', filter.val1);
                            params.append('maxValue', filter.val1);
                        } else if (filter.operator === 'gt' || filter.operator === 'gte') {
                            params.append('minValue', filter.val1);
                        } else if (filter.operator === 'lt' || filter.operator === 'lte') {
                            params.append('maxValue', filter.val1);
                        } else if (filter.operator === 'between' && filter.val2) {
                            params.append('minValue', filter.val1);
                            params.append('maxValue', filter.val2);
                        }
                    }
                    // Numeric IN list (quick filter - exact match)
                    else if (filter.numIn && filter.numIn.length > 0) {
                        console.log('  ➡️ Quick filter - NumIn list (exact match):', filter.numIn);
                        if (filter.numIn.length === 1) {
                            // Single value - exact match using min/max
                            console.log('  ➡️ Adding min/max for exact match:', filter.numIn[0]);
                            params.append('minValue', filter.numIn[0]);
                            params.append('maxValue', filter.numIn[0]);
                        } else {
                            // Multiple values - use range (min to max)
                            const values = filter.numIn.map(v => parseFloat(v));
                            params.append('minValue', Math.min(...values));
                            params.append('maxValue', Math.max(...values));
                        }
                    }
                    // Legacy min/max format
                    else if (filter.min || filter.max) {
                        if (filter.min) {
                            console.log('  ➡️ Adding minValue:', filter.min);
                            params.append('minValue', filter.min);
                        }
                        if (filter.max) {
                            console.log('  ➡️ Adding maxValue:', filter.max);
                            params.append('maxValue', filter.max);
                        }
                    }
                } else if (key.startsWith('data')) {
                    // Date Filters
                    let useAdvanced = false;

                    if (filter.operator) {
                        useAdvanced = true;
                        if (filter.operator === 'eq' && filter.val1) {
                            params.append(`${key}Start`, filter.val1);
                            params.append(`${key}End`, filter.val1);
                        } else if (filter.operator === 'before' && filter.val1) {
                            params.append(`${key}End`, filter.val1);
                        } else if (filter.operator === 'after' && filter.val1) {
                            params.append(`${key}Start`, filter.val1);
                        } else if (filter.operator === 'between' && filter.val1 && filter.val2) {
                            params.append(`${key}Start`, filter.val1);
                            params.append(`${key}End`, filter.val2);
                        }
                    } else if (filter.start || filter.end) {
                        useAdvanced = true;
                        if (filter.start) params.append(`${key}Start`, filter.start);
                        if (filter.end) params.append(`${key}End`, filter.end);
                    }

                    if (!useAdvanced && filter.dateIn && filter.dateIn.length > 0 && !filter.dateIn.includes('__NONE__')) {
                        filter.dateIn.forEach(d => params.append(`${key}List`, d));
                    }
                } else if (key === 'link') {
                    // Link/Attachment Filter
                    console.log('🔗 LINK FILTER in TransferenciaManager:', filter);
                    if (filter.value === 'with_file' || filter.value === 'true' || filter.value === true) {
                        console.log('  ➡️ Adding hasAttachment=1');
                        params.append('hasAttachment', '1');
                    } else if (filter.value === 'without_file' || filter.value === 'false' || filter.value === false) {
                        console.log('  ➡️ Adding hasAttachment=0');
                        params.append('hasAttachment', '0');
                    }
                } else {
                    // Text Filters
                    console.log(`📝 TEXT FILTER for ${key}:`, filter);
                    if (filter.text) {
                        console.log(`  ➡️ Adding ${key}=${filter.text}`);
                        params.append(key, filter.text);
                    }
                    if (filter.val1 && filter.operator === 'contains') {
                        console.log(`  ➡️ Adding ${key}=${filter.val1}`);
                        params.append(key, filter.val1);
                    }
                }
            });

        return params;
    };

    const pagedTransferencias = createPagedData({
        pageSize: 50,
        fetchRange: async (offset, limit) => {
            const params = buildListParams(Math.floor(offset / limit) + 1, limit);

            const response = await fetch(`${API_BASE_URL}/transferencias?${params.toString()}`, {
                headers: getHeaders()
            });

            if (!response.ok) throw new Error('Falha ao carregar transferências');

            const result = await response.json();

            if (result.meta) {
                return { rows: result.data, total: result.meta.total };
            }

            const all = Array.isArray(result) ? result : [];
            return { rows: all, total: all.length, complete: true };
        }
    });

    pagedTransferencias.onProgress(() => renderPagination());

    const loadTransferencias = async (page = 1, { useCache = false } = {}) => {
        try {
            container.querySelector('#table-container')?.classList.add('loading');

            if (!useCache) pagedTransferencias.reset();

            const { rows, meta } = await pagedTransferencias.getPage(page);
            transferencias = rows;
            pagination = meta;

            renderTransferencias();
            renderPagination();

            // Keeps downloading the rest of the filter in the background.
            pagedTransferencias.prefetchRest();

        } catch (error) {
            console.error('Error loading transferências:', error);
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
        btnPrev.onclick = () => loadTransferencias(pagination.page - 1, { useCache: true });

        const label = document.createElement('span');
        label.textContent = `Página ${pagination.page} de ${pagination.pages} (${pagination.total} registros)`;
        label.style.margin = '0 1rem';

        const btnNext = document.createElement('button');
        btnNext.className = 'btn-sm';
        btnNext.textContent = 'Próxima ▶';
        btnNext.disabled = pagination.page >= pagination.pages;
        btnNext.onclick = () => loadTransferencias(pagination.page + 1, { useCache: true });

        pagContainer.appendChild(btnPrev);
        pagContainer.appendChild(label);
        pagContainer.appendChild(btnNext);
    };

    const createTransferencia = async () => {
        await TransferenciaModal.show({
            transferencia: null,
            projectId: project.id,
            onSave: async (data) => {
                const response = await fetch(`${API_BASE_URL}/transferencias`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        ...data,
                        projectId: project.id
                    })
                });

                if (response.ok) {
                    showToast('Transferência criada com sucesso!', 'success');
                    loadTransferencias();
                } else {
                    const error = await response.json();
                    const msg = error.error || 'Erro ao criar transferência';
                    showToast(msg, 'error');
                    throw new Error(msg); // Keep modal open
                }
            }
        });
    };

    const updateTransferencia = async (transferencia) => {
        await TransferenciaModal.show({
            transferencia: transferencia,
            projectId: project.id,
            onSave: async (data) => {
                const response = await fetch(`${API_BASE_URL}/transferencias/${transferencia.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showToast('Transferência atualizada com sucesso!', 'success');
                    loadTransferencias();
                } else {
                    const error = await response.json();
                    const msg = error.error || 'Erro ao atualizar transferência';
                    showToast(msg, 'error');
                    throw new Error(msg); // Keep modal open
                }
            }
        });
    };

    const deleteTransferencia = async (id) => {
        if (!confirm('Deseja excluir esta transferência e reverter os saldos?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/transferencias/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Transferência excluída com sucesso!', 'success');
                loadTransferencias();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir transferência', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    // State for selection
    let selectedItems = new Set();

    const handleBulkDelete = async () => {
        if (selectedItems.size === 0) return;

        const confirmed = await confirm(`Tem certeza que deseja excluir ${selectedItems.size} transferências? Os saldos envolvidos serão revertidos.`);
        if (!confirmed) return;

        try {
            container.querySelector('#table-container').classList.add('loading');

            const promises = Array.from(selectedItems).map(id =>
                fetch(`${API_BASE_URL}/transferencias/${id}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                })
            );

            await Promise.all(promises);
            showToast(`${selectedItems.size} transferências excluídas e revertidas!`, 'success');

            selectedItems.clear();
            sharedTable.clearSelection();
            loadTransferencias();
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir transferências', 'error');
        } finally {
            container.querySelector('#table-container').classList.remove('loading');
        }
    };

    // Initial Render of Container Structure
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>↔️ Transferências</h2>
            <div style="display: flex; gap: 0.5rem;">
                    <span style="font-size: 0.9rem; color: var(--color-primary);">Movimentações</span>
                    <span style="color: var(--color-text-muted);">/</span>
                    <span style="font-size: 0.9rem; color: var(--color-text-muted);">Transferências</span>
            </div>
        </div>

        <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
            <button id="btn-new-transf" class="btn-primary">+ Nova Transferência</button>
            <div style="flex: 1;"></div>
            <button id="btn-excel" class="btn-outline">📊 Excel</button>
            <button id="btn-pdf" class="btn-outline">🖨️ PDF</button>
        </div>

        <div id="table-container" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
            <!-- SharedTable will render here -->
        </div>
        
        <div style="margin-top: 1rem; display: flex; justify-content: flex-end; align-items: center; padding: 0.5rem; border-top: 1px solid var(--color-border-light);">
            <div class="pagination-controls" style="display: flex; gap: 0.5rem; align-items: center;"></div>
        </div>
    `;

    container.querySelector('#btn-new-transf').addEventListener('click', createTransferencia);

    // Export Handlers
    container.querySelector('#btn-excel').onclick = async () => {
        if (!transferencias || transferencias.length === 0) {
            showToast('Sem dados para exportar', 'warning');
            return;
        }

        try {
            // Exports the whole filter, not only the page on screen.
            const exportData = (await pagedTransferencias.getAllRows()).map(item => ({
                ...item
            }));

            ExcelExporter.exportTable(
                exportData,
                columns.filter(c => c.key !== 'actions' && c.key !== 'link').map(c => ({
                    header: c.label,
                    key: c.key,
                    width: parseInt(c.width) / 7 || 15,
                    type: c.type
                })),
                'Relatório de Transferências',
                'transferencias'
            );
        } catch (error) {
            console.error(error);
            showToast('Erro ao exportar todos os registros do filtro', 'error');
        }
    };

    container.querySelector('#btn-pdf').onclick = () => {
        PrintHelper.printWithChoice({
            getState: () => pagination,
            loadAllRows: () => pagedTransferencias.getAllRows(),
            renderRows: (rows) => sharedTable.render(rows),
            restore: () => renderTransferencias(),
            selector: '#table-container table'
        });
    };

    // Initialize SharedTable
    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        projectId: project.id,
        endpointPrefix: null, // Client-side distinct values
        onFilterChange: (filters) => {
            activeFilters = filters;
            loadTransferencias(1);
        },
        enableSelection: true,
        onSelectionChange: (items, ids) => {
            selectedItems = ids;
        },
        onBulkDelete: handleBulkDelete
    });

    const renderTransferencias = () => {
        // Pass data to SharedTable
        sharedTable.render(transferencias);
    };

    loadTransferencias();

    return container;
};
