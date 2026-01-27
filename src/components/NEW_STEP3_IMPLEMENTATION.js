// NOVO STEP 3: EXECUTION & MONITORING
// Substitui a função renderStep3 existente no CampanhaWizard.js (linha ~718-782)

const renderStep3 = () => {
    const stepContainer = document.createElement('div');
    Object.assign(stepContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '1rem',
        overflow: 'hidden'
    });

    // Summary Header
    const emailStatus = state.config.useEmail ? (state.message.emailSubject ? 'Pronto' : 'Pendente') : 'Não Habilitado';
    const whatsappStatus = state.config.useWhatsapp ? (state.message.whatsappText ? 'Pronto' : 'Pendente') : 'Não Habilitado';

    const summaryDiv = document.createElement('div');
    summaryDiv.style.marginBottom = '1rem';
    summaryDiv.innerHTML = `
        <div style="background:#f0f9ff; padding:1rem; border-radius:8px; border:1px solid #bae6fd;">
            <h3 style="margin:0 0 0.5rem 0; color:var(--color-primary);">${state.config.nome || 'Campanha Sem Nome'}</h3>
            <div style="display:flex; gap:2rem; font-size:0.9rem;">
                <span>👥 <b>Leads:</b> ${state.leads.length}</span>
                <span>📧 <b>E-mail:</b> ${emailStatus}</span>
                <span>💬 <b>WhatsApp:</b> ${whatsappStatus}</span>
                <span>⏱️ <b>Intervalo:</b> ${state.config.dispatchIntervalSeconds || 120}s</span>
            </div>
        </div>
    `;

    // SharedTable Container
    const tableContainer = document.createElement('div');
    tableContainer.id = 'dispatch-table-container';
    Object.assign(tableContainer.style, {
        flex: '1',
        overflow: 'hidden',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: 'white'
    });

    stepContainer.appendChild(summaryDiv);
    stepContainer.appendChild(tableContainer);

    // Initialize SharedTable after DOM is ready
    setTimeout(() => {
        initializeDispatchTable();
    }, 0);

    return stepContainer;
};

// Helper function to initialize the SharedTable
function initializeDispatchTable() {
    const container = document.getElementById('dispatch-table-container');
    if (!container) return;

    // Prepare data for SharedTable
    const tableData = state.leads.map(lead => ({
        id: lead.id,
        nome: lead.nome || '-',
        email: lead.email || '-',
        telefone: lead.telefone || '-',
        status_email: 'pendente',
        status_whatsapp: 'pendente'
    }));

    // Define columns
    const columns = [
        {
            key: 'nome',
            label: 'Nome',
            width: '30%',
            sortable: true
        },
        {
            key: 'email',
            label: 'E-mail',
            width: '25%',
            sortable: true
        },
        {
            key: 'telefone',
            label: 'Telefone',
            width: '15%',
            sortable: true
        },
        {
            key: 'status_email',
            label: '📧 Status E-mail',
            width: '15%',
            render: (value) => {
                if (value === 'sucesso') return '<span style="color:#10b981; font-weight:600;">✓ OK</span>';
                if (value === 'falha') return '<span style="color:#ef4444; font-weight:600;">✗ Falha</span>';
                if (value === 'enviando') return '<span style="color:#f59e0b; font-weight:600;">⏳ Enviando...</span>';
                return '<span style="color:#9ca3af;">○ Pendente</span>';
            }
        },
        {
            key: 'status_whatsapp',
            label: '💬 Status WhatsApp',
            width: '15%',
            render: (value) => {
                if (value === 'sucesso') return '<span style="color:#10b981; font-weight:600;">✓ OK</span>';
                if (value === 'falha') return '<span style="color:#ef4444; font-weight:600;">✗ Falha</span>';
                if (value === 'enviando') return '<span style="color:#f59e0b; font-weight:600;">⏳ Enviando...</span>';
                return '<span style="color:#9ca3af;">○ Pendente</span>';
            }
        }
    ];

    // Initialize SharedTable
    window.dispatchTable = SharedTable.create({
        containerId: 'dispatch-table-container',
        data: tableData,
        columns: columns,
        pageSize: 20,
        showSearch: true,
        searchPlaceholder: 'Buscar leads...',
        emptyMessage: 'Nenhum lead selecionado para esta campanha'
    });

    console.log('✅ SharedTable de disparos inicializada com', tableData.length, 'leads');
}

// Helper function to update a single lead's status in the table
function updateLeadStatus(leadId, channel, status) {
    if (!window.dispatchTable) return;

    const columnKey = channel === 'email' ? 'status_email' : 'status_whatsapp';

    // Update the data
    const currentData = window.dispatchTable.getData();
    const updatedData = currentData.map(row => {
        if (row.id === leadId) {
            return { ...row, [columnKey]: status };
        }
        return row;
    });

    // Refresh table
    window.dispatchTable.updateData(updatedData);
    console.log(`📊 Status atualizado: Lead ${leadId}, ${channel} = ${status}`);
}

// Helper function to refresh all statuses from backend
async function refreshDispatchStatuses(campaignId) {
    if (!campaignId) return;

    try {
        const API_BASE_URL = getApiBaseUrl();
        const response = await fetch(`${API_BASE_URL}/marketing/campanhas/${campaignId}/dispatch-details`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) throw new Error('Erro ao buscar status de disparos');

        const leads = await response.json();

        if (window.dispatchTable) {
            window.dispatchTable.updateData(leads);
            console.log('🔄 Status de disparos atualizado:', leads.length, 'leads');
        }
    } catch (error) {
        console.error('Erro ao atualizar status de disparos:', error);
    }
}
