import { CompanyModal } from './CompanyModal.js';
import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';

export const CompanyManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel';
    const API_BASE_URL = getApiBaseUrl();
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.height = 'calc(100vh - 150px)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Date formatter
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    // CNPJ formatter
    const formatCNPJ = (cnpj) => {
        if (!cnpj) return '-';
        return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    };

    const loadCompanies = async () => {
        try {
            container.querySelector('.companies-table-wrapper')?.classList.add('loading');

            const response = await fetch(`${API_BASE_URL}/companies?projectId=${project.id}`, {
                headers: getHeaders()
            });
            const companies = await response.json();

            renderCompanies(companies);
        } catch (error) {
            console.error('Error loading companies:', error);
            showToast('Erro ao carregar empresas', 'error');
        }
    };

    const showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            background: ${type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#3B82F6'};
            color: white;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    const createCompany = async () => {
        const data = await CompanyModal.show({
            company: null,
            onSave: async (companyData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/companies`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            name: companyData.name,
                            cnpj: companyData.cnpj,
                            description: companyData.description,
                            projectId: project.id
                        })
                    });

                    if (response.ok) {
                        showToast('Empresa criada com sucesso!', 'success');
                        loadCompanies();
                    } else {
                        const error = await response.json();
                        showToast(error.error?.message || error.error || 'Erro ao criar empresa', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const updateCompany = async (company) => {
        const data = await CompanyModal.show({
            company: company,
            onSave: async (companyData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/companies/${company.id}`, {
                        method: 'PUT',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            name: companyData.name,
                            cnpj: companyData.cnpj,
                            description: companyData.description,
                            active: companyData.active
                        })
                    });

                    if (response.ok) {
                        showToast('Empresa atualizada com sucesso!', 'success');
                        loadCompanies();
                    } else {
                        const error = await response.json();
                        showToast(error.error?.message || error.error || 'Erro ao atualizar empresa', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const deleteCompany = async (id, name) => {
        const confirmed = await Dialogs.confirm(`Tem certeza que deseja processar a empresa "${name}"?`);
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/companies/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Empresa excluída com sucesso!', 'success');
                loadCompanies();
            } else {
                const data = await response.json();

                // Check if it's a dependency error (Smart Delete Flow)
                if (response.status === 409 && data.error?.code === 'DEPENDENCY_EXISTS') {
                    const inactivate = await Dialogs.confirm(
                        `Esta empresa não pode ser excluída pois possui ${data.error.counts?.accounts || 0} contas e ${data.error.counts?.incomes + data.error.counts?.expenses || 0} lançamentos vinculados.\n\nDeseja INATIVAR a empresa para manter o histórico?`,
                        'Atenção: Vínculos Encontrados'
                    );

                    if (inactivate) {
                        // Proceed to inactivate
                        try {
                            const updateResponse = await fetch(`${API_BASE_URL}/companies/${id}`, {
                                method: 'PUT',
                                headers: getHeaders(),
                                body: JSON.stringify({ active: false })
                            });

                            if (updateResponse.ok) {
                                showToast('Empresa inativada com sucesso!', 'success');
                                loadCompanies();
                            } else {
                                showToast('Erro ao inativar empresa.', 'error');
                            }
                        } catch (err) {
                            showToast('Erro de conexão ao tentar inativar.', 'error');
                        }
                    }
                } else {
                    const errorMessage = data.error?.message || data.error || 'Erro ao excluir empresa';
                    showToast(errorMessage, 'error');
                }
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const exportToExcel = async (companies) => {
        const columns = [
            { header: 'Nome', key: 'name', width: 30 },
            { header: 'CNPJ', key: 'cnpj_formatted', width: 20 },
            { header: 'Descrição', key: 'description', width: 40 },
            { header: 'Status', key: 'active', width: 15, type: 'center' },
            { header: 'Criado em', key: 'created_at_formatted', width: 15, type: 'center' }
        ];

        // Prepare data for export
        const exportData = companies.map(c => ({
            ...c,
            cnpj_formatted: formatCNPJ(c.cnpj),
            created_at_formatted: formatDate(c.created_at)
        }));

        await ExcelExporter.exportTable(exportData, columns, 'Empresas', 'empresas_export');
    };

    const renderCompanies = (companies) => {
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>🏢 Empresas</h2>
                <div style="display: flex; gap: 0.5rem;">
                     <!-- <a href="#" style="font-size: 0.9rem; color: var(--color-primary);">Lar</a>
                     <span style="color: var(--color-text-muted);">/</span>
                     <span style="font-size: 0.9rem; color: var(--color-text-muted);">Empresas</span> -->
                     <button id="btn-print-pdf" class="btn-secondary" title="Imprimir / Salvar PDF" style="margin-right: 0.5rem;">🖨️ PDF</button>
                     <button id="btn-export-excel" class="btn-secondary" title="Exportar Excel">📊 Excel</button>
                </div>
            </div>

            <div style="margin-bottom: 1rem;">
                <button id="btn-new-company" class="btn-primary">+ Nova Empresa</button>
            </div>

            <div class="companies-table-wrapper" style="flex: 1; overflow: auto; border: 1px solid var(--color-border-light); border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead class="sticky-header">
                        <tr>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Nome</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">CNPJ</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Descrição</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Status</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Criado em</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${companies.map((company, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
            return `
                            <tr style="border-bottom: 1px solid var(--color-border-light); background-color: ${bgColor}; transition: background 0.2s;" 
                                onmouseover="this.style.background='rgba(218, 177, 119, 0.5)'" 
                                onmouseout="this.style.background='${bgColor}'">
                                <td style="padding: 0.32rem 1rem; font-size: 0.9rem; font-weight: 500;">
                                    ${company.name}
                                </td>
                                <td style="padding: 0.32rem 1rem; font-size: 0.9rem; font-family: monospace;">
                                    ${formatCNPJ(company.cnpj)}
                                </td>
                                <td style="padding: 0.32rem 1rem; font-size: 0.9rem; color: var(--color-text-muted);">
                                    ${company.description || '-'}
                                </td>
                                <td style="padding: 0.32rem 1rem; text-align: center;">
                                    <span class="badge-${company.active ? 'active' : 'inactive'}">
                                        ${company.active ? '✓ Ativo' : '✕ Inativo'}
                                    </span>
                                </td>
                                <td style="padding: 0.32rem 1rem; font-size: 0.85rem; text-align: center; color: var(--color-text-muted);">
                                    ${formatDate(company.created_at)}
                                </td>
                                <td style="padding: 0.32rem 1rem; text-align: right;">
                                    <button class="btn-edit" data-id="${company.id}" style="color: #10B981; margin-right: 0.5rem; font-size: 1.2rem; background: none; border: none; cursor: pointer; transition: transform 0.2s;" 
                                        onmouseover="this.style.transform='scale(1.2)'" 
                                        onmouseout="this.style.transform='scale(1)'">✏️</button>
                                    <button class="btn-delete" data-id="${company.id}" style="color: #EF4444; font-size: 1.2rem; background: none; border: none; cursor: pointer; transition: transform 0.2s;" 
                                        onmouseover="this.style.transform='scale(1.2)'" 
                                        onmouseout="this.style.transform='scale(1)'">🗑️</button>
                                </td>
                            </tr>
                        `}).join('')}
                        ${companies.length === 0 ? `
                            <tr>
                                <td colspan="6" style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                                    <div style="font-size: 3rem; margin-bottom: 1rem;">🏢</div>
                                    <div style="font-size: 1.1rem;">Nenhuma empresa cadastrada</div>
                                    <div style="font-size: 0.9rem; margin-top: 0.5rem;">Clique em "Nova Empresa" para começar</div>
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--color-text-muted);">
                <div>Total: ${companies.length} empresa${companies.length !== 1 ? 's' : ''}</div>
            </div>
        `;

        container.querySelector('#btn-new-company').addEventListener('click', createCompany);
        container.querySelector('#btn-print-pdf').addEventListener('click', () => window.print());
        container.querySelector('#btn-export-excel').addEventListener('click', () => exportToExcel(companies));

        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const company = companies.find(c => c.id == btn.dataset.id);
                updateCompany(company);
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const company = companies.find(c => c.id == btn.dataset.id);
                deleteCompany(company.id, company.name);
            });
        });
    };

    loadCompanies();

    return container;
};
