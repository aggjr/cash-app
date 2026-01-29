import { SharedTable } from './SharedTable.js';
import { showToast } from '../utils/toast.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { CampanhaModal } from './CampanhaModal.js';

import { CampanhaWizard } from './CampanhaWizard.js';

export const CampanhasManager = (project) => {
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

    let campanhas = [];
    let sharedTable = null;

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        // Ajuste para timezone local se necessário ou apenas split
        // Vamos usar split para pegar a data YYYY-MM-DD e mostrar DD/MM/YYYY
        // Supondo que venha como string ISO
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        } catch (e) {
            return dateString;
        }
    };

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

                // Monitor button (eye icon) - show for campaigns with leads
                const total = item.total_leads || 0;
                const isMonitorable = total > 0; // Show if campaign has any leads

                if (isMonitorable) {
                    const btnMonitor = document.createElement('button');
                    btnMonitor.innerHTML = '👁️';
                    btnMonitor.title = 'Monitorar Disparos';
                    btnMonitor.style.background = 'none';
                    btnMonitor.style.border = 'none';
                    btnMonitor.style.cursor = 'pointer';
                    btnMonitor.style.fontSize = '1.1rem';
                    btnMonitor.onclick = (e) => { e.stopPropagation(); monitorCampanha(item); };
                    div.appendChild(btnMonitor);
                }

                const btnEdit = document.createElement('button');
                btnEdit.innerHTML = '✏️';
                btnEdit.title = 'Editar';
                btnEdit.style.background = 'none';
                btnEdit.style.border = 'none';
                btnEdit.style.cursor = 'pointer';
                btnEdit.style.fontSize = '1.1rem';
                btnEdit.onclick = (e) => { e.stopPropagation(); updateCampanha(item); };

                const btnDelete = document.createElement('button');
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Excluir';
                btnDelete.style.background = 'none';
                btnDelete.style.border = 'none';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '1.1rem';
                btnDelete.onclick = (e) => { e.stopPropagation(); deleteCampanha(item); };

                div.appendChild(btnEdit);
                div.appendChild(btnDelete);
                return div;
            }
        },
        { key: 'nome', label: 'Nome', width: 'auto', align: 'left', type: 'text' },
        // Descrição removida
        {
            key: 'data_inicio',
            label: 'Início',
            width: '100px',
            align: 'center',
            type: 'date',
            render: (item) => {
                const span = document.createElement('span');
                span.textContent = formatDate(item.data_inicio);
                return span;
            }
        },
        {
            key: 'data_fim',
            label: 'Fim',
            width: '100px',
            align: 'center',
            type: 'date',
            render: (item) => {
                const span = document.createElement('span');
                span.textContent = formatDate(item.data_fim);
                return span;
            }
        },
        {
            key: 'status',
            label: 'Status',
            width: '140px',
            align: 'center',
            type: 'text',
            render: (item) => {
                let statusLabel = 'Planejamento';
                let statusBg = '#eff6ff'; // blue-50
                let statusColor = '#3b82f6'; // blue-500

                const total = item.total_leads || 0;
                const processados = item.leads_processados || 0;

                if (total > 0 && processados >= total) {
                    statusLabel = 'ENVIO FINALIZADO';
                    statusBg = '#ecfdf5'; // green-50
                    statusColor = '#10b981'; // green-500
                } else if (processados > 0) {
                    statusLabel = 'ENVIANDO';
                    statusBg = '#fffbeb'; // amber-50
                    statusColor = '#f59e0b'; // amber-500
                } else if (item.status === 'pausada') {
                    statusLabel = 'PAUSADA';
                    statusBg = '#fef2f2';
                    statusColor = '#ef4444';
                }

                const badge = document.createElement('span');
                badge.style.backgroundColor = statusBg;
                badge.style.color = statusColor;
                badge.style.padding = '4px 10px';
                badge.style.borderRadius = '20px';
                badge.style.fontSize = '0.75rem';
                badge.style.fontWeight = '700';
                badge.style.display = 'inline-block';
                badge.style.whiteSpace = 'nowrap';
                badge.textContent = statusLabel;
                return badge;
            }
        },
        {
            key: 'total_leads',
            label: 'Total Leads',
            width: '80px',
            align: 'center',
            type: 'number',
            render: (item) => {
                return item.total_leads || 0;
            }
        },
        {
            key: 'leads_processados',
            label: 'Já Enviados',
            width: '90px',
            align: 'center',
            type: 'number',
            render: (item) => {
                return item.leads_processados || 0;
            }
        },
        {
            key: 'email_sucesso',
            label: '📧 E-mail OK',
            width: '90px',
            align: 'center',
            type: 'number',
            render: (item) => {
                const count = item.email_sucesso || 0;
                const span = document.createElement('span');
                span.textContent = count;
                if (count > 0) {
                    span.style.color = 'green';
                    span.style.fontWeight = 'bold';
                }
                return span;
            }
        },
        {
            key: 'whatsapp_sucesso',
            label: '💬 WhatsApp OK',
            width: '110px',
            align: 'center',
            type: 'number',
            render: (item) => {
                const count = item.whatsapp_sucesso || 0;
                const span = document.createElement('span');
                span.textContent = count;
                if (count > 0) {
                    span.style.color = 'green';
                    span.style.fontWeight = 'bold';
                }
                return span;
            }
        }
    ];

    const loadCampanhas = async () => {
        console.log('\n========== 📋 [FRONTEND] CARREGANDO CAMPANHAS ==========');
        try {
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.add('loading');
            }

            console.log('📋 [FRONTEND] Fazendo requisição GET /marketing/campanhas...');
            const response = await fetch(`${API_BASE_URL}/marketing/campanhas`, {
                headers: getHeaders()
            });

            console.log(`📋 [FRONTEND] Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                throw new Error('Falha ao carregar campanhas');
            }

            campanhas = await response.json();
            console.log(`📋 [FRONTEND] ✅ ${campanhas.length} campanhas carregadas`);

            // Log detalhado de cada campanha
            campanhas.forEach((c, i) => {
                console.log(`📋 [FRONTEND] Campanha ${i + 1}: ID=${c.id}, Nome="${c.nome}", Status="${c.status}", Leads=${c.total_leads || 0}, Processados=${c.leads_processados || 0}`);
            });

            if (sharedTable) {
                console.log('📋 [FRONTEND] Renderizando tabela...');
                sharedTable.render(campanhas);
                updateFooter();
                console.log('📋 [FRONTEND] ✅ Tabela renderizada');
            }

            // Auto-refresh: Se houver campanhas "enviando", fazer polling
            const hasEnviando = campanhas.some(c => c.status === 'enviando' || (c.total_leads > 0 && c.leads_processados < c.total_leads));
            if (hasEnviando) {
                const enviandoCampanhas = campanhas.filter(c => c.status === 'enviando' || (c.total_leads > 0 && c.leads_processados < c.total_leads));
                console.log(`🔄 [FRONTEND] ${enviandoCampanhas.length} campanha(s) em envio detectada(s):`);
                enviandoCampanhas.forEach(c => {
                    console.log(`🔄 [FRONTEND]   - ID ${c.id}: ${c.leads_processados || 0}/${c.total_leads || 0} processados`);
                });
                console.log('🔄 [FRONTEND] Auto-refresh agendado para 5 segundos...');
                setTimeout(loadCampanhas, 5000); // Refresh a cada 5 segundos
            } else {
                console.log('✅ [FRONTEND] Nenhuma campanha em envio. Auto-refresh desativado.');
            }

            console.log('========== 📋 [FRONTEND] CARREGAMENTO CONCLUÍDO ==========\n');
        } catch (error) {
            console.error('❌ [FRONTEND] Erro ao carregar campanhas:', error);
            console.error('❌ [FRONTEND] Stack:', error.stack);
            showToast('Erro ao carregar campanhas', 'error');
        } finally {
            if (sharedTable && container.querySelector('#table-container')) {
                container.querySelector('#table-container').classList.remove('loading');
            }
        }
    };

    const updateFooter = () => {
        const totalCount = container.querySelector('#total-count');
        if (totalCount) {
            totalCount.textContent = campanhas.length;
        }
    };

    const createCampanha = async () => {
        // Use Wizard for creation
        await CampanhaWizard.show({
            onSave: async (data) => {
                // Determine API endpoint and payload
                // Wizard sends { ...config, leadsIds, message }
                // Controller expects this flat structure (leadsIds inside body) which Wizard provides

                const response = await fetch(`${API_BASE_URL}/marketing/campanhas`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showToast('Campanha criada com sucesso!', 'success');
                    loadCampanhas();
                    return await response.json(); // Return created campaign data
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao criar campanha');
                }
            }
        });
    };

    const updateCampanha = async (campanha) => {
        await CampanhaModal.show({
            campanha: campanha,
            onSave: async (data) => {
                const response = await fetch(`${API_BASE_URL}/marketing/campanhas/${campanha.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showToast('Campanha atualizada com sucesso!', 'success');
                    loadCampanhas();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Erro ao atualizar campanha');
                }
            }
        });
    };

    const monitorCampanha = async (campanha) => {
        try {
            // Fetch dispatch details
            const response = await fetch(`${API_BASE_URL}/marketing/campanhas/${campanha.id}/dispatch-details`, {
                headers: getHeaders()
            });

            if (!response.ok) {
                throw new Error('Falha ao carregar detalhes de disparo');
            }

            const leads = await response.json();

            // Open wizard in monitoring mode
            await CampanhaWizard.showMonitoring({
                campanha,
                leads,
                onClose: () => loadCampanhas()
            });
        } catch (error) {
            console.error('Erro ao abrir monitoramento:', error);
            showToast('Erro ao carregar monitoramento: ' + error.message, 'error');
        }
    };

    const deleteCampanha = async (campanha) => {
        const confirmed = await showCustomConfirm(
            `Tem certeza que deseja excluir a campanha "${campanha.nome}"?`,
            'Sim, Excluir'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/campanhas/${campanha.id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Campanha excluída com sucesso!', 'success');
                loadCampanhas();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao excluir campanha', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    // Standard Custom Confirm
    const showCustomConfirm = (message, confirmText = 'Sim') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.position = 'fixed';
            overlay.id = 'confirm-dialog-overlay'; // Unique ID to avoid conflicts if needed
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
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
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
            `Tem certeza que deseja excluir ${selectedItems.size} campanhas?`,
            'Sim, Excluir'
        );

        if (!confirmed) return;

        try {
            // Sequential delete for now as API might not have bulk endpoint
            // Or use Promise.all
            container.querySelector('#table-container').classList.add('loading');

            const promises = Array.from(selectedItems).map(id =>
                fetch(`${API_BASE_URL}/marketing/campanhas/${id}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                })
            );

            await Promise.all(promises);

            showToast(`${selectedItems.size} campanhas excluídas com sucesso!`, 'success');
            selectedItems.clear();
            selectedItemsData = [];
            if (sharedTable) sharedTable.clearSelection();
            loadCampanhas();
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir campanhas', 'error');
        } finally {
            container.querySelector('#table-container').classList.remove('loading');
        }
    };

    const handleBulkEdit = async () => {
        if (selectedItems.size === 0) return;
        showToast('Edição em massa de campanhas será implementada em breve.', 'info');
    };

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>📢 Campanhas</h2>
        </div>

        <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; align-items: center;">
            <button id="btn-new" class="btn-primary">+ Nova Campanha</button>
            <button id="btn-refresh" class="btn-secondary" title="Atualizar Dados">🔄</button>
        </div>

        <div id="table-container" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;"></div>
    `;

    container.querySelector('#btn-new').addEventListener('click', createCampanha);
    container.querySelector('#btn-refresh').onclick = loadCampanhas;
    container.querySelector('#btn-migrate').onclick = async () => {
        if (!confirm('Deseja aplicar a migração do redesign de campanhas? Isso irá adicionar a coluna dispatch_interval_seconds ao banco de dados.')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/campanhas/apply-redesign-migration`, {
                method: 'POST',
                headers: getHeaders()
            });

            const result = await response.json();

            if (result.success) {
                showToast('✅ Migração aplicada com sucesso!', 'success');
                console.log('Passos executados:', result.steps);
                if (result.errors.length > 0) {
                    console.warn('Avisos:', result.errors);
                }
            } else {
                showToast('❌ Erro na migração: ' + result.message, 'error');
                console.error('Erros:', result.errors);
            }
        } catch (error) {
            showToast('❌ Erro ao executar migração: ' + error.message, 'error');
            console.error(error);
        }
    };

    container.querySelector('#btn-db-fix').onclick = async () => {
        if (!confirm('Deseja executar as correções de banco de dados? Isso irá corrigir a coluna status e outras estruturas necessárias.')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/campanhas/db-fix`, {
                method: 'POST',
                headers: getHeaders()
            });

            const result = await response.json();

            if (result.success) {
                showToast('✅ Correções aplicadas com sucesso!', 'success');
                console.log('Resultados:', result.results);
                if (result.results) {
                    result.results.forEach(r => console.log(r));
                }
            } else {
                showToast('❌ Erro nas correções: ' + result.message, 'error');
                console.error('Erro:', result.error);
            }
        } catch (error) {
            showToast('❌ Erro ao executar correções: ' + error.message, 'error');
            console.error(error);
        }
    };

    container.querySelector('#btn-fix-text').onclick = async () => {
        if (!confirm('Deseja corrigir as colunas de texto para suportar imagens Base64 grandes? Isso irá alterar whatsapp_text e email_body para LONGTEXT.')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/marketing/campanhas/fix-text-columns`, {
                method: 'POST',
                headers: getHeaders()
            });

            const result = await response.json();

            if (result.success) {
                showToast('✅ Colunas corrigidas com sucesso!', 'success');
                console.log('Passos executados:');
                result.steps.forEach(step => console.log(step));
                if (result.errors.length > 0) {
                    console.warn('Avisos:', result.errors);
                }
            } else {
                showToast('❌ Erro ao corrigir colunas: ' + result.message, 'error');
                console.error('Erro:', result.error);
            }
        } catch (error) {
            showToast('❌ Erro ao executar correção: ' + error.message, 'error');
            console.error(error);
        }
    };

    const tableContainer = container.querySelector('#table-container');
    sharedTable = new SharedTable({
        container: tableContainer,
        columns: columns,
        projectId: project.id, // Ensure projectId is passed if needed
        enableSelection: true,
        onSelectionChange: (items, ids) => {
            selectedItems = Array.isArray(ids) ? new Set(ids) : ids;
            selectedItemsData = items;
        },
        onBulkDelete: handleBulkDelete,
        onBulkEdit: handleBulkEdit
    });

    loadCampanhas();

    return container;
};
