import { SharedTable } from './SharedTable.js';
import { LoanModal } from './LoanModal.js';
import { SaidaModal } from './SaidaModal.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { PrintHelper } from '../utils/printHelper.js';

export const DividasEmprestimosManager = (project) => {
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

    let installments = [];
    let pagination = { page: 1, limit: 50, total: 0, pages: 1 };
    let activeFilters = {};
    let sortConfig = { key: 'data_prevista_pagamento', direction: 'asc' };

    // Columns
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
                btnEdit.title = 'Editar/Pagar';
                btnEdit.className = 'btn-icon';
                btnEdit.onclick = (e) => { e.stopPropagation(); updateInstallment(item); };

                // Delete only if not paid? Or full delete?
                // Deleting a single installment of a loan is risky. Maybe disable?
                // Or allow with warning.
                // Let's allow editing primarily. 

                div.appendChild(btnEdit);
                return div;
            }
        },
        {
            key: 'status',
            label: 'Status',
            width: '100px',
            align: 'center',
            noFilter: true,
            render: (item) => {
                const status = item.data_real_pagamento ? 'Pago' : 'Pendente';
                const today = new Date().toISOString().split('T')[0];
                const dueDate = item.data_prevista_pagamento ? item.data_prevista_pagamento.split('T')[0] : '';
                const isLate = status === 'Pendente' && dueDate && dueDate < today;

                const badge = document.createElement('span');
                badge.style.padding = '4px 8px';
                badge.style.borderRadius = '12px';
                badge.style.fontSize = '0.8rem';
                badge.style.fontWeight = '600';

                if (status === 'Pago') {
                    badge.style.background = '#D1FAE5';
                    badge.style.color = '#065F46';
                    badge.textContent = 'Pago';
                } else if (isLate) {
                    badge.style.background = '#FEE2E2';
                    badge.style.color = '#991B1B';
                    badge.textContent = 'Atrasado';
                } else {
                    badge.style.background = '#FEF3C7';
                    badge.style.color = '#92400E';
                    badge.textContent = 'Aberto';
                }
                return badge;
            }
        },
        { key: 'data_prevista_pagamento', label: 'Vencimento', width: 'var(--col-date)', align: 'left', type: 'date' },
        { key: 'data_real_pagamento', label: 'Pagamento', width: 'var(--col-date)', align: 'left', type: 'date' },
        {
            key: 'descricao',
            label: 'Descrição',
            width: 'auto',
            align: 'left',
            type: 'text',
            render: (item) => {
                const div = document.createElement('div');
                div.innerHTML = `
                    <div style="font-weight: 500;">${item.descricao}</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-muted);">${item.loan_description || ''}</div>
                `;
                return div;
            }
        },
        { key: 'company_name', label: 'Credor', width: 'var(--col-medium)', align: 'left', type: 'text' },
        { key: 'account_name', label: 'Conta', width: 'var(--col-small)', align: 'center', type: 'text' },
        { key: 'valor', label: 'Valor', width: 'var(--col-value)', align: 'right', type: 'currency', colorLogic: 'outflow' }
    ];

    const getHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    let sharedTable = null;

    const loadData = async (page = 1) => {
        try {
            container.querySelector('#table-container')?.classList.add('loading');

            if (!project || !project.id) {
                console.error('Project ID invalid:', project);
                showToast('Erro interno: Projeto não identificado', 'error');
                return;
            }

            const params = new URLSearchParams({
                projectId: project.id,
                page: page,
                limit: pagination.limit
            });

            if (sortConfig.key) {
                params.append('sortBy', sortConfig.key);
                params.append('order', sortConfig.direction);
            }

            // Map filters
            Object.keys(activeFilters).forEach(key => {
                const filter = activeFilters[key];
                if (!filter) return;

                if (key === 'valor' && filter.min) params.append('minValue', filter.min);
                else if (key === 'company_name' && filter.text) params.append('search', filter.text);
            });

            const url = `${API_BASE_URL}/loans/installments?${params.toString()}`;
            console.log('[DividasEmprestimosManager] Fetching:', url);

            const response = await fetch(url, {
                headers: getHeaders()
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('[DividasEmprestimosManager] Error response:', response.status, errText);
                throw new Error('Falha ao carregar parcelas');
            }

            const result = await response.json();
            installments = result.data;
            pagination = result.meta;

            renderPagination();
            sharedTable.render(installments);

        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar dados', 'error');
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
        btnPrev.textContent = '◀';
        btnPrev.disabled = pagination.page <= 1;
        btnPrev.onclick = () => loadData(pagination.page - 1);

        const label = document.createElement('span');
        label.textContent = `${pagination.page} / ${pagination.pages} (${pagination.total || 0})`;

        const btnNext = document.createElement('button');
        btnNext.className = 'btn-sm';
        btnNext.textContent = '▶';
        btnNext.disabled = pagination.page >= pagination.pages;
        btnNext.onclick = () => loadData(pagination.page + 1);

        pagContainer.append(btnPrev, label, btnNext);
    };

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const createLoan = async () => {
        console.log('[DividasEmprestimosManager] Opening loan modal');

        try {
            await LoanModal.show({
                projectId: project.id,
                onSave: async (loanData) => {
                    const response = await fetch(`${API_BASE_URL}/loans`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify(loanData)
                    });

                    if (response.ok) {
                        showToast('Empréstimo contratado com sucesso!', 'success');
                        loadData();
                    } else {
                        const err = await response.json();
                        const msg = err.message || err.error || 'Erro ao contratar empréstimo';
                        showToast(msg, 'error');
                        throw new Error(msg); // Keep modal open
                    }
                }
            });
        } catch (error) {
            console.error('[DividasEmprestimosManager] Error opening modal:', error);
            showToast('Erro ao abrir formulário', 'error');
        }
    };

    const updateInstallment = async (item) => {
        // Reuse SaidaModal because it's essentially a Saida
        // But disable some fields? Or allow editing?
        // Let's allow full editing for now.
        await SaidaModal.show({
            saida: item,
            projectId: project.id,
            onSave: async (data) => {
                const response = await fetch(`${API_BASE_URL}/saidas/${item.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                if (response.ok) {
                    showToast('Parcela atualizada!', 'success');
                    loadData();
                } else {
                    const err = await response.json();
                    const msg = err.error || 'Erro ao atualizar parcela';
                    showToast(msg, 'error');
                    throw new Error(msg); // Keep modal open
                }
            }
        });
    };

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>🏦 Dívidas / Empréstimos <small style="font-size: 0.8rem; color: #888;">(v1.2)</small></h2>
            <div style="display: flex; gap: 0.5rem;">
                <span style="font-size: 0.9rem; color: var(--color-primary);">Financeiro</span>
                <span style="color: var(--color-text-muted);">/</span>
                <span style="font-size: 0.9rem; color: var(--color-text-muted);">Dívidas</span>
            </div>
        </div>

        <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
            <button id="btn-new-loan" class="btn-primary">+ Contratar Empréstimo</button>
            <div style="flex: 1;"></div>
            <button id="btn-excel" class="btn-outline">📊 Excel</button>
            <button id="btn-pdf" class="btn-outline">🖨️ PDF</button>
        </div>

        <div id="table-container" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;"></div>
        
        <div style="margin-top: 1rem; display: flex; justify-content: flex-end; align-items: center; padding: 0.5rem; border-top: 1px solid var(--color-border-light);">
            <div class="pagination-controls" style="display: flex; gap: 0.5rem; align-items: center;"></div>
        </div>
    `;

    container.querySelector('#btn-new-loan').onclick = createLoan;
    container.querySelector('#btn-pdf').onclick = () => {
        PrintHelper.autoConfigureOrientation('#table-container table');
        window.print();
    };
    // Excel export logic (simplified)
    container.querySelector('#btn-excel').onclick = () => {
        ExcelExporter.exportTable(installments, columns, 'Relatório Dívidas', 'dividas');
    };

    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        projectId: project.id,
        onFilterChange: (f) => { activeFilters = f; loadData(1); },
        onSortChange: (s) => { sortConfig = s; loadData(1); }
    });

    loadData();

    return container;
};
