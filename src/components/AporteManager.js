import { AporteModal } from './AporteModal.js';
import { SharedTable } from './SharedTable.js'; // Import SharedTable
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';

export const AporteManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '1rem'; // Matching IncomeManager padding
    container.style.margin = '0.5rem';
    container.style.height = 'calc(100vh - 60px)';
    container.style.width = 'calc(100% - 1rem)';
    container.style.maxWidth = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    // State for filtering & pagination
    let aportes = [];
    let pagination = { page: 1, limit: 50, total: 0, pages: 1 };
    let activeFilters = {};
    let sortConfig = { key: 'data_fato', direction: 'desc' };

    // Define Columns for SharedTable
    const columns = [
        { key: 'data_fato', label: 'Dt Fato', width: '90px', align: 'center', type: 'date' },
        {
            key: 'data_real',
            label: 'Dt Real',
            width: '90px',
            align: 'center',
            type: 'date'
        },
        { key: 'descricao', label: 'Descrição', width: 'auto', align: 'left', type: 'text' },
        { key: 'company_name', label: 'Empresa', width: '180px', align: 'left', type: 'text' },
        { key: 'account_name', label: 'Conta', width: '150px', align: 'left', type: 'text' },
        {
            key: 'valor',
            label: 'Valor',
            width: '120px',
            align: 'right',
            type: 'currency',
            colorLogic: 'inflow' // Green for positive, Red for negative
        },
        {
            key: 'link',
            label: 'Link',
            width: '60px',
            align: 'center',
            type: 'link', // Enable link filter logic
            noTextSearch: true,
            render: (item) => {
                const btn = document.createElement('button');
                btn.innerHTML = '📎'; // Paperclip
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
        },
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
                btnEdit.onclick = (e) => { e.stopPropagation(); updateAporte(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteAporte(item.id, item.descricao); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
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

    const loadAportes = async (page = 1) => {
        try {
            console.log('=== LOAD APORTES DEBUG START ===');
            console.log('Step 1: Starting loadAportes, page:', page);
            console.log('Step 2: Project ID:', project.id);

            container.querySelector('#table-container')?.classList.add('loading');

            const params = new URLSearchParams({
                projectId: project.id,
                page: page,
                limit: pagination.limit
            });

            // Handle Sorting
            if (sortConfig.key) {
                params.append('sortBy', sortConfig.key);
                params.append('order', sortConfig.direction);
            }

            // Handle Filters (Robust Logic)
            Object.keys(activeFilters).forEach(key => {
                const filter = activeFilters[key];
                if (!filter) return;

                if (key === 'valor') {
                    // Operator-based format (advanced filter)
                    if (filter.operator && filter.val1) {
                        if (filter.operator === 'eq') {
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
                        if (filter.numIn.length === 1) {
                            params.append('minValue', filter.numIn[0]);
                            params.append('maxValue', filter.numIn[0]);
                        } else {
                            const values = filter.numIn.map(v => parseFloat(v));
                            params.append('minValue', Math.min(...values));
                            params.append('maxValue', Math.max(...values));
                        }
                    }
                    // Legacy min/max format
                    else if (filter.min || filter.max) {
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
                    if (key === 'descricao' && filter.text) params.append('description', filter.text);
                    if (key === 'account_name' && filter.text) params.append('account', filter.text);
                    if (key === 'company_name' && filter.text) params.append('company', filter.text);

                    // Fallback / Generic Search
                    if (filter.val1 && filter.operator === 'contains') {
                        if (key === 'descricao') params.append('description', filter.val1);
                        else if (key === 'account_name') params.append('account', filter.val1);
                        else if (key === 'company_name') params.append('company', filter.val1);
                        else params.append('search', filter.val1);
                    } else if (filter.text && !['descricao', 'account_name', 'company_name'].includes(key)) {
                        params.append('search', filter.text);
                    }
                }
            });


            console.group('🔍 AporteManager Filter Debug');
            console.log('Active Filters:', JSON.stringify(activeFilters, null, 2));
            console.log('Sort Config:', JSON.stringify(sortConfig, null, 2));
            console.log('Generated Params:', params.toString());
            console.groupEnd();

            console.log('Step 3: Calling API...');
            const url = `${API_BASE_URL}/aportes?${params.toString()}`;
            console.log('Step 4: URL:', url);

            const response = await fetch(url, {
                headers: getHeaders()
            });

            console.log('Step 5: Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Step 6 ERROR: Response not ok');
                console.error('Error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('Step 7: Result received:', result);

            if (result.meta) {
                aportes = result.data;
                pagination = result.meta;
            } else {
                aportes = Array.isArray(result) ? result : [];
                pagination = { page: 1, limit: aportes.length, total: aportes.length, pages: 1 };
            }

            console.log('Step 8: Aportes count:', aportes.length);
            console.log('Step 9: Pagination:', pagination);

            renderAportes();
            renderPagination();

            console.log('Step 10: SUCCESS - Render complete');
            console.log('=== LOAD APORTES DEBUG END ===');
        } catch (error) {
            console.error('=== LOAD APORTES ERROR ===');
            console.error('Error:', error);
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
            showToast('Erro ao carregar aportes', 'error');
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
        btnPrev.onclick = () => loadAportes(pagination.page - 1);

        const label = document.createElement('span');
        label.textContent = `Página ${pagination.page} de ${pagination.pages}`;
        label.style.margin = '0 1rem';

        const btnNext = document.createElement('button');
        btnNext.className = 'btn-sm';
        btnNext.textContent = 'Próxima ▶';
        btnNext.disabled = pagination.page >= pagination.pages;
        btnNext.onclick = () => loadAportes(pagination.page + 1);

        pagContainer.appendChild(btnPrev);
        pagContainer.appendChild(label);
        pagContainer.appendChild(btnNext);

        // Update Total
        const totalContainer = container.querySelector('#total-display');
        if (totalContainer) {
            const totalVal = aportes.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
            // Logic: Green if positive, Red if negative
            const color = totalVal >= 0 ? '#10B981' : '#EF4444';
            totalContainer.innerHTML = `
                <span style="font-size: 1.1rem; margin-right: 0.5rem;">Total (Página):</span>
                <span style="font-weight: 700; font-size: 1.1rem; color: ${color};">
                    ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal)}
                </span>
            `;
        }
    };

    const createAporte = async () => {
        await AporteModal.show({
            aporte: null,
            projectId: project.id,
            onSave: async (aporteData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/aportes`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            ...aporteData,
                            projectId: project.id
                        })
                    });

                    if (response.ok) {
                        showToast('Aporte criado com sucesso!', 'success');
                        loadAportes();
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao criar aporte', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const updateAporte = async (aporte) => {
        await AporteModal.show({
            aporte: aporte,
            projectId: project.id,
            onSave: async (aporteData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/aportes/${aporte.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify(aporteData)
                    });

                    if (response.ok) {
                        showToast('Aporte atualizado com sucesso!', 'success');
                        loadAportes();
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao atualizar aporte', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const deleteAporte = async (id, description) => {
        const displayText = description || 'este aporte';
        if (!confirm(`Tem certeza que deseja excluir "${displayText}"?`)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/aportes/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Aporte excluído com sucesso!', 'success');
                loadAportes();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir aporte', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    // Initial Render
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>➕ Aportes</h2>
             <div style="display: flex; gap: 0.5rem;">
                 <span style="font-size: 0.9rem; color: var(--color-primary);">Movimentações</span>
                 <span style="color: var(--color-text-muted);">/</span>
                 <span style="font-size: 0.9rem; color: var(--color-text-muted);">Aportes</span>
            </div>
        </div>

        <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
            <button id="btn-new-aporte" class="btn-primary">+ Novo Aporte</button>
            <div style="flex: 1;"></div>
            <button id="btn-excel" class="btn-outline">📊 Excel</button>
            <button id="btn-pdf" class="btn-outline">🖨️ PDF</button>
        </div>

        <div id="table-container" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
            <!-- SharedTable will render here -->
        </div>
        
        <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-top: 1px solid var(--color-border-light);">
            <div id="total-display"></div>
            <div class="pagination-controls" style="display: flex; gap: 0.5rem; align-items: center;"></div>
        </div>
    `;

    container.querySelector('#btn-new-aporte').onclick = createAporte;

    // Export Handlers
    container.querySelector('#btn-excel').onclick = async () => {
        try {
            if (!aportes || aportes.length === 0) {
                showToast('Sem dados para exportar', 'warning');
                return;
            }

            const exportData = aportes.map(item => ({ ...item }));

            await ExcelExporter.exportTable(
                exportData,
                columns.filter(c => c.key !== 'actions' && c.key !== 'link').map(c => ({
                    header: c.label,
                    key: c.key,
                    width: parseInt(c.width) / 7 || 15,
                    type: c.type
                })),
                'Relatório de Aportes',
                'aportes'
            );
        } catch (error) {
            console.error('Error during Excel export:', error);
            showToast(`Erro ao exportar: ${error.message}`, 'error');
        }
    };

    container.querySelector('#btn-pdf').onclick = () => window.print();

    // Initialize SharedTable
    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        projectId: project.id,
        endpointPrefix: null,
        onFilterChange: (filters) => {
            activeFilters = filters;
            loadAportes(1);
        },
        onSortChange: (sort) => {
            sortConfig = sort;
            loadAportes(1);
        }
    });

    const renderAportes = () => {
        sharedTable.render(aportes);
    };

    loadAportes();
    return container;
};
