import { RetiradaModal } from './RetiradaModal.js';
import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import * as filterUtils from '../utils/filterUtils.js'; // Assuming this exists or we inline logic
import { ExcelExporter } from '../utils/ExcelExporter.js';

export const RetiradaManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '1rem';
    container.style.margin = '0.5rem';
    container.style.height = 'calc(100vh - 60px)';
    container.style.width = 'calc(100% - 1rem)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // State
    let retiradas = [];
    let pagination = { page: 1, limit: 50, total: 0, pages: 1 };
    let activeFilters = {};
    let sortConfig = { key: 'data_fato', direction: 'desc' };

    // Columns
    const columns = [
        { key: 'data_fato', label: 'Data Fato', width: '100px', align: 'center', type: 'date' },
        { key: 'data_prevista', label: 'Data Prevista', width: '100px', align: 'center', type: 'date' },
        { key: 'data_real', label: 'Data Real', width: '100px', align: 'center', type: 'date' },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        { key: 'company_name', label: 'Empresa', width: '200px', align: 'left', type: 'text' },
        { key: 'account_name', label: 'Conta', width: '200px', align: 'left', type: 'text' },
        {
            key: 'valor',
            label: 'Valor',
            width: '120px',
            align: 'right',
            type: 'currency',
            colorLogic: 'outflow' // Red for negative/outflow
        },
        {
            key: 'link',
            label: 'Link',
            width: '60px',
            align: 'center',
            type: 'link',
            noTextSearch: true,
            render: (item) => {
                const btn = document.createElement('button');
                btn.innerHTML = '📎';
                btn.style.background = 'none';
                btn.style.border = 'none';
                btn.style.fontSize = '1.2rem';
                btn.style.padding = '0';

                if (item.comprovante_url) {
                    btn.style.cursor = 'pointer';
                    btn.title = 'Ver Comprovante';
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        // Open in new tab
                        window.open(`${API_BASE_URL}${item.comprovante_url}`, '_blank');
                    };
                } else {
                    btn.style.cursor = 'default';
                    btn.style.opacity = '0.3';
                    btn.title = 'Sem anexo';
                }
                return btn;
            }
        },
        {
            key: 'actions',
            label: 'Ações',
            width: '100px',
            align: 'center',
            noFilter: true,
            render: (item) => {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.gap = '0.5rem';
                div.style.justifyContent = 'center';

                const btnEdit = document.createElement('button');
                btnEdit.innerHTML = '✏️';
                btnEdit.style.background = 'none'; btnEdit.style.border = 'none'; btnEdit.style.cursor = 'pointer';
                btnEdit.onclick = (e) => { e.stopPropagation(); updateRetirada(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.style.background = 'none'; btnDelete.style.border = 'none'; btnDelete.style.cursor = 'pointer';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteRetirada(item.id, item.descricao); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        {
            key: 'status',
            label: '',
            width: '40px',
            align: 'center',
            noFilter: true,
            render: (item) => {
                // Status Logic
                let statusColor = '#F59E0B'; // Pending
                let statusTitle = 'Pendente';
                if (item.data_real) {
                    statusColor = '#10B981'; statusTitle = 'Realizado';
                } else {
                    const today = new Date().toISOString().split('T')[0];
                    const prev = item.data_prevista ? item.data_prevista.split('T')[0] : '';
                    if (prev && prev < today) { statusColor = '#EF4444'; statusTitle = 'Atrasado'; }
                }
                const dot = document.createElement('div');
                dot.style.width = '10px'; dot.style.height = '10px'; dot.style.borderRadius = '50%';
                dot.style.backgroundColor = statusColor;
                dot.style.margin = '0 auto';
                dot.title = statusTitle;
                return dot;
            }
        }
    ];

    let sharedTable = null;

    const getHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    const loadRetiradas = async (page = 1) => {
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

            // Filter Mapping (Similar to AporteManager logic)
            Object.keys(activeFilters).forEach(key => {
                const filter = activeFilters[key];
                if (!filter) return;

                if (key === 'valor') {
                    if (filter.operator && filter.val1) {
                        if (filter.operator === 'eq') { params.append('minValue', filter.val1); params.append('maxValue', filter.val1); }
                        else if (filter.operator === 'gt') params.append('minValue', String(Number(filter.val1) + 0.01));
                        else if (filter.operator === 'gte') params.append('minValue', filter.val1);
                        else if (filter.operator === 'lt') params.append('maxValue', String(Number(filter.val1) - 0.01));
                        else if (filter.operator === 'lte') params.append('maxValue', filter.val1);
                        else if (filter.operator === 'bt' && filter.val2) { params.append('minValue', filter.val1); params.append('maxValue', filter.val2); }
                    } else if (filter.min || filter.max) {
                        // Old fallback
                        if (filter.min) params.append('minValue', filter.min);
                        if (filter.max) params.append('maxValue', filter.max);
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
                    // Link Filter
                    if (filter.value === 'true' || filter.value === 'with_link') params.append('hasAttachment', '1');
                    else if (filter.value === 'false' || filter.value === 'without_link') params.append('hasAttachment', '0');
                } else {
                    // Text Filters
                    // Handle specific text columns (account, company, description)
                    // We map them to specific backend params which use LIKE %...%
                    let textVal = filter.text || filter.val1;

                    if (key === 'account_name' && textVal) params.append('account', textVal);
                    else if (key === 'company_name' && textVal) params.append('company', textVal);
                    else if (key === 'descricao' && textVal) params.append('description', textVal);

                    // Generic Search or other text columns
                    else if (textVal) {
                        params.append('search', textVal);
                    }

                    // Checkbox list (textIn)
                    if (filter.textIn && filter.textIn.length > 0 && !filter.textIn.includes('__NONE__')) {
                        // Backend support for list filtering on text columns might be limited,
                        // fallback to search or implement specific logic if needed.
                        // For now we skip or log warning.
                    }
                }
            });

            const response = await fetch(`${API_BASE_URL}/retiradas?${params.toString()}`, { headers: getHeaders() });
            const result = await response.json();


            if (result.meta) {
                retiradas = result.data;
                pagination = result.meta;
            } else {
                retiradas = Array.isArray(result) ? result : [];
                pagination = { page: 1, limit: retiradas.length, total: retiradas.length, pages: 1 };
            }

            if (sharedTable) {
                sharedTable.render(retiradas);
                renderPagination();
            } else {
                console.warn('SharedTable not initialized yet');
            }

        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar retiradas', 'error');
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
        btnPrev.onclick = () => loadRetiradas(pagination.page - 1);

        const label = document.createElement('span');
        label.textContent = `Página ${pagination.page} de ${pagination.pages}`;
        label.style.margin = '0 1rem';

        const btnNext = document.createElement('button');
        btnNext.className = 'btn-sm';
        btnNext.textContent = 'Próxima ▶';
        btnNext.disabled = pagination.page >= pagination.pages;
        btnNext.onclick = () => loadRetiradas(pagination.page + 1);

        pagContainer.appendChild(btnPrev);
        pagContainer.appendChild(label);
        pagContainer.appendChild(btnNext);

        // Update Total
        const totalContainer = container.querySelector('#total-display');
        if (totalContainer) {
            const totalVal = retiradas.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
            const color = '#EF4444'; // Always Red for Retiradas
            totalContainer.innerHTML = `
                <span style="font-size: 1.1rem; margin-right: 0.5rem;">Total (Página):</span>
                <span style="font-weight: 700; font-size: 1.1rem; color: ${color};">
                    ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal)}
                </span>
            `;
        }
    };

    const createRetirada = async () => {
        await RetiradaModal.show({
            retirada: null, projectId: project.id,
            onSave: async (data) => {
                const res = await fetch(`${API_BASE_URL}/retiradas`, {
                    method: 'POST', headers: getHeaders(),
                    body: JSON.stringify({ ...data, projectId: project.id })
                });
                if (res.ok) { showToast('Criado com sucesso!', 'success'); loadRetiradas(); }
                else { const err = await res.json(); showToast(err.error || 'Erro', 'error'); }
            }
        });
    };

    const updateRetirada = async (item) => {
        await RetiradaModal.show({
            retirada: item, projectId: project.id,
            onSave: async (data) => {
                const res = await fetch(`${API_BASE_URL}/retiradas/${item.id}`, {
                    method: 'PUT', headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                if (res.ok) { showToast('Atualizado com sucesso!', 'success'); loadRetiradas(); }
                else { const err = await res.json(); showToast(err.error || 'Erro', 'error'); }
            }
        });
    };

    const deleteRetirada = async (id, title) => {
        if (!confirm(`Excluir "${title || 'item'}"?`)) return;
        const res = await fetch(`${API_BASE_URL}/retiradas/${id}`, { method: 'DELETE', headers: getHeaders() });
        if (res.ok) { showToast('Excluído!', 'success'); loadRetiradas(); }
        else showToast('Erro ao excluir', 'error');
    };

    // Initialize UI
    const titleArea = document.createElement('div');
    titleArea.style.marginBottom = '1rem';
    titleArea.innerHTML = `<h2>➖ Retiradas</h2>`;
    container.appendChild(titleArea);

    const btnArea = document.createElement('div');
    btnArea.style.marginBottom = '1rem';
    btnArea.style.display = 'flex';
    btnArea.style.gap = '0.5rem';

    const btnNew = document.createElement('button');
    btnNew.className = 'btn-primary';
    btnNew.textContent = '+ Nova Retirada';
    btnNew.onclick = createRetirada;
    btnArea.appendChild(btnNew);

    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    btnArea.appendChild(spacer);

    const btnExcel = document.createElement('button');
    btnExcel.id = 'btn-excel';
    btnExcel.className = 'btn-outline';
    btnExcel.textContent = '📊 Excel';
    btnArea.appendChild(btnExcel);

    const btnPdf = document.createElement('button');
    btnPdf.id = 'btn-pdf';
    btnPdf.className = 'btn-outline';
    btnPdf.textContent = '🖨️ PDF';
    btnArea.appendChild(btnPdf);

    container.appendChild(btnArea);

    const tableContainer = document.createElement('div');
    tableContainer.id = 'table-container';
    tableContainer.style.flex = '1';
    tableContainer.style.overflow = 'hidden';
    tableContainer.style.display = 'flex';
    tableContainer.style.flexDirection = 'column';
    container.appendChild(tableContainer);

    // Footer with Total and Pagination
    const footer = document.createElement('div');
    footer.style.marginTop = '1rem';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';
    footer.style.padding = '0.5rem';
    footer.style.borderTop = '1px solid var(--color-border-light)';

    footer.innerHTML = `
        <div id="total-display"></div>
        <div class="pagination-controls" style="display: flex; gap: 0.5rem; align-items: center;"></div>
    `;
    container.appendChild(footer);

    // Export Handlers
    container.querySelector('#btn-excel').onclick = async () => {
        try {
            if (!retiradas || retiradas.length === 0) {
                showToast('Sem dados para exportar', 'warning');
                return;
            }

            const exportData = retiradas.map(item => ({ ...item }));

            await ExcelExporter.exportTable(
                exportData,
                columns.filter(c => c.key !== 'actions' && c.key !== 'link' && c.key !== 'status').map(c => ({
                    header: c.label,
                    key: c.key,
                    width: parseInt(c.width) / 7 || 15,
                    type: c.type
                })),
                'Relatório de Retiradas',
                'retiradas'
            );
        } catch (error) {
            console.error('Error during Excel export:', error);
            showToast(`Erro ao exportar: ${error.message}`, 'error');
        }
    };

    container.querySelector('#btn-pdf').onclick = () => window.print();

    // Init SharedTable
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        projectId: project.id,
        endpointPrefix: null, // Client-side distinct or add backend support later
        onSortChange: (sort) => { sortConfig = sort; loadRetiradas(pagination.page); },
        onFilterChange: (newFilters) => { activeFilters = newFilters; loadRetiradas(1); }
    });

    loadRetiradas();

    return container;
};
