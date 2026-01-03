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
                const d = new Date(row.created_at);
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
            type: 'text',
            render: (row) => {
                try {
                    const json = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
                    const text = JSON.stringify(json);
                    return document.createTextNode(text.length > 80 ? text.substring(0, 80) + '...' : text);
                } catch (e) {
                    return document.createTextNode(row.details || '-');
                }
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
