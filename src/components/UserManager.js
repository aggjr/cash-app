import { UserModal } from './UserModal.js';
import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';
import { SharedTable } from './SharedTable.js';

export const UserManager = (project) => {
    const API_BASE_URL = getApiBaseUrl();
    const container = document.createElement('div');
    container.className = 'glass-panel';
    container.style.padding = '1rem';
    container.style.margin = '0.5rem';
    container.style.height = 'calc(100vh - 60px)';
    container.style.width = 'calc(100% - 1rem)';
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

    // --- SharedTable Setup ---
    let sharedTable = null;

    const columns = [
        {
            key: 'name', label: 'Nome', width: '250px', align: 'left', type: 'text', render: (user) => {
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const isCurrentUser = user.id === currentUser.id;
                return `<strong>${user.name}</strong>${isCurrentUser ? ' <span style="color: var(--color-primary); font-size: 0.8rem;">(Você)</span>' : ''}`;
            }
        },
        { key: 'email', label: 'E-mail', width: '250px', align: 'left', type: 'text' },
        { key: 'job_title', label: 'Cargo', width: '150px', align: 'left', type: 'text', render: (user) => user.job_title || '-' },
        { key: 'department', label: 'Departamento', width: '150px', align: 'left', type: 'text', render: (user) => user.department || '-' },
        {
            key: 'role', label: 'Função', width: '120px', align: 'center', type: 'text', render: (user) => {
                const style = user.role === 'master'
                    ? 'background: linear-gradient(135deg, #DAB177 0%, #C89F5F 100%); color: white; box-shadow: 0 2px 4px rgba(218,177,119,0.3);'
                    : 'background: #E0E7FF; color: #3730A3;';
                const icon = user.role === 'master' ? '👑' : '👤';
                const text = user.role === 'master' ? 'Master' : 'Usuário';
                return `<span style="${style} padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${icon} ${text}</span>`;
            }
        },
        {
            key: 'status', label: 'Status', width: '120px', align: 'center', type: 'text', render: (user) => {
                let style = '';
                let text = '';
                if (user.status === 'active') { style = 'background: #D1FAE5; color: #065F46;'; text = '✓ Ativo'; }
                else if (user.status === 'pending') { style = 'background: #FEF3C7; color: #92400E;'; text = '⏳ Pendente'; }
                else { style = 'background: #FEE2E2; color: #991B1B;'; text = '✕ Inativo'; }
                return `<span style="${style} padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${text}</span>`;
            }
        },
        { key: 'invited_at', label: 'Convidado em', width: '120px', align: 'center', type: 'date', render: (user) => formatDate(user.invited_at) },
        { key: 'invited_by_name', label: 'Convidado por', width: '150px', align: 'center', type: 'text', render: (user) => user.invited_by_name || '-' },
        {
            key: 'actions', label: 'Ações', width: '100px', align: 'center', noFilter: true, render: (user) => {
                const currentUser = JSON.parse(localStorage.getItem('user'));
                const isMaster = usersList.find(u => u.id === currentUser.id)?.role === 'master';
                const isCurrentUser = user.id === currentUser.id;

                if (isMaster || isCurrentUser) {
                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '✏️';
                    editBtn.style.background = 'none';
                    editBtn.style.border = 'none';
                    editBtn.style.cursor = 'pointer';
                    editBtn.style.fontSize = '1.2rem';
                    editBtn.style.marginRight = '0.5rem';
                    editBtn.title = 'Editar Perfil';
                    editBtn.onclick = (e) => {
                        e.stopPropagation();
                        // Open Edit Modal
                        UserModal.show({
                            user,
                            onSave: (data) => updateUser(data)
                        });
                    };
                    return editBtn;
                }

                if (isMaster && !isCurrentUser && user.role !== 'master') {
                    const removeBtn = document.createElement('button');
                    removeBtn.innerHTML = '🗑️';
                    removeBtn.style.background = 'none';
                    removeBtn.style.border = 'none';
                    removeBtn.style.cursor = 'pointer';
                    removeBtn.style.fontSize = '1.2rem';
                    removeBtn.style.color = '#EF4444';
                    removeBtn.title = 'Remover Usuário';
                    removeBtn.onclick = (e) => {
                        e.stopPropagation();
                        removeUser(user.id, user.name);
                    };
                    return removeBtn;
                }
                return '-';
            }
        }
    ];

    // Store users list for action logic since SharedTable render doesn't pass full context easily without it
    let usersList = [];

    const updateUser = async (data) => {
        try {
            // Update Profile (Global)
            const profileResponse = await fetch(`${API_BASE_URL}/users/${data.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({
                    job_title: data.job_title,
                    department: data.department,
                    name: data.name // optional
                })
            });

            if (!profileResponse.ok) {
                const error = await profileResponse.json();
                throw new Error(error.error || 'Erro ao atualizar perfil');
            }

            showToast('Perfil atualizado com sucesso!', 'success');
            loadUsers();

        } catch (error) {
            console.error('Update error:', error);
            showToast(error.message || 'Erro ao atualizar usuário', 'error');
        }
    };

    const loadUsers = async () => {
        try {
            // Container layout creation if needed (first time)
            if (!container.querySelector('.table-container')) {
                renderLayout();
            }

            // container.querySelector('.users-table-wrapper')?.classList.add('loading'); // SharedTable handles this? No, we need to manage loading state potentially or SharedTable just renders data.

            const response = await fetch(`${API_BASE_URL}/projects/${project.id}/users`, {
                headers: getHeaders()
            });
            const users = await response.json();
            usersList = users; // Update local state for actions column

            if (sharedTable) {
                sharedTable.render(users);
                updateFooter(users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showToast('Erro ao carregar usuários', 'error');
        }
    };

    const inviteUser = async () => {
        const data = await UserModal.show({
            user: null,
            onSave: async (userData) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/projects/${project.id}/invite`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify(userData)
                    });

                    if (response.ok) {
                        showToast('Usuário convidado com sucesso!', 'success');
                        loadUsers();
                    } else {
                        const error = await response.json();
                        showToast(error.error || 'Erro ao convidar usuário', 'error');
                    }
                } catch (error) {
                    showToast('Erro de conexão', 'error');
                }
            }
        });
    };

    const removeUser = async (userId, userName) => {
        const confirmed = await Dialogs.confirm(
            `Tem certeza que deseja remover o usuário "${userName}" deste projeto?`,
            'Remover Usuário'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/projects/${project.id}/users/${userId}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Usuário removido com sucesso!', 'success');
                loadUsers();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao remover usuário', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão', 'error');
        }
    };

    const exportToExcel = async () => {
        const columnsExport = [
            { header: 'Nome', key: 'name', width: 30 },
            { header: 'E-mail', key: 'email', width: 30 },
            { header: 'Função', key: 'role_display', width: 15, type: 'center' },
            { header: 'Status', key: 'status_display', width: 15, type: 'center' },
            { header: 'Convidado em', key: 'invited_at_formatted', width: 15, type: 'center' },
            { header: 'Convidado por', key: 'invited_by_name', width: 25 }
        ];

        // Prepare data
        const exportData = usersList.map(u => ({
            ...u,
            role_display: u.role === 'master' ? 'Master' : 'Usuário',
            status_display: u.status === 'active' ? 'Ativo' : (u.status === 'pending' ? 'Pendente' : 'Inativo'),
            invited_at_formatted: formatDate(u.invited_at)
        }));

        await ExcelExporter.exportTable(exportData, columnsExport, 'Usuários', 'usuarios_export');
    };

    const renderLayout = () => {
        container.innerHTML = ''; // Clear prev content

        // Header
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '1rem';

        const title = document.createElement('h2');
        title.innerHTML = '👥 Usuários do Projeto';
        header.appendChild(title);

        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '0.5rem';

        const btnPdf = document.createElement('button');
        btnPdf.className = 'btn-secondary';
        btnPdf.innerHTML = '🖨️ PDF';
        btnPdf.title = 'Imprimir / Salvar PDF';
        btnPdf.onclick = () => window.print();

        const btnExcel = document.createElement('button');
        btnExcel.className = 'btn-secondary';
        btnExcel.innerHTML = '📊 Excel';
        btnExcel.title = 'Exportar Excel';
        btnExcel.onclick = exportToExcel;

        actionsDiv.appendChild(btnPdf);
        actionsDiv.appendChild(btnExcel);
        header.appendChild(actionsDiv);

        container.appendChild(header);

        // Invite Button (Check valid permission later? Or just show and let logic handle it? Master check is done in render usually)
        // We'll add a placeholder that we update after loading users if we want strict permission hiding, 
        // or just show it and let server reject. Original had check.
        // We can check localstorage user for immediate UI state, although role might have changed.
        const currentUser = JSON.parse(localStorage.getItem('user'));
        // We don't have the full user list yet to know if THIS user is master of THIS project strictly from localstorage if checking against project users list
        // But usually we can assume the role from the dashboard context if passed. 
        // For now, I'll add a container for main actions that we can update.
        const mainActions = document.createElement('div');
        mainActions.id = 'main-actions-container';
        mainActions.style.marginBottom = '1rem';
        container.appendChild(mainActions);

        // Table Container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container'; // SharedTable expects a container
        tableContainer.style.flex = '1';
        tableContainer.style.overflow = 'hidden';
        tableContainer.style.display = 'flex';
        tableContainer.style.flexDirection = 'column';
        container.appendChild(tableContainer);

        // Footer
        const footer = document.createElement('div');
        footer.id = 'users-footer';
        footer.style.marginTop = '1rem';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'space-between';
        footer.style.alignItems = 'center';
        footer.style.fontSize = '0.85rem';
        footer.style.color = 'var(--color-text-muted)';
        container.appendChild(footer);

        // Initialize SharedTable
        sharedTable = new SharedTable({
            container: tableContainer,
            columns: columns,
            projectId: project.id,
            endpointPrefix: null, // Client-side mode
            onFilterChange: null, // Client-side filtering handled by SharedTable default? SharedTable default implementation might need verify.
            // SharedTable.js analyzed: if endpointPrefix is null, it assumes client-side distinct values BUT 
            // render() function does client side sorting. Does it do client side filtering? 
            // Looking at SharedTable.js in previous turn: 
            // It has `renderHeaderContent` with filter inputs.
            // It has `attachHeaderEvents` which listens to inputs and calls `onFilterChange`.
            // If `endpointPrefix` is null, `onFilterChange` needs to handle it OR SharedTable needs internal logic.
            // `SharedTable.js` lines 4-18 show constructor.
            // I might need to implement `onFilterChange` to filter `usersList` and re-calling render if SharedTable doesn't auto-filter client side.
            // Let's assume for now we might need to handle it or check if SharedTable supports it. 
            // Re-reading `SharedTable.js`: It saves filters to `this.activeFilters`. It calls `this.onFilterChange`. 
            // It does NOT seem to have internal client-side filtering logic in `render`. It uses `this.currentData` for sorting.
            // So I should implement a simple client-side filter here.
        });

        // Enhance SharedTable with client-side filtering
        sharedTable.onFilterChange = (filters) => {
            const filtered = usersList.filter(item => {
                return Object.entries(filters).every(([key, value]) => {
                    if (!value) return true;
                    // match logic
                    const itemVal = String(item[key] || '').toLowerCase();
                    return itemVal.includes(value.toLowerCase());
                });
            });
            sharedTable.render(filtered);
        };
    };

    const updateFooter = (users) => {
        const footer = container.querySelector('#users-footer');
        if (footer) {
            footer.innerHTML = `
                <div>Total: ${users.length} usuário${users.length !== 1 ? 's' : ''}</div>
                <div>Projeto: <span style="font-weight: 600; color: var(--color-primary);">${project.name}</span></div>
            `;
        }

        // Update Invite Button presence based on Master role
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const isMaster = users.find(u => u.id === currentUser.id)?.role === 'master';
        const mainActions = container.querySelector('#main-actions-container');
        if (mainActions) {
            mainActions.innerHTML = '';
            if (isMaster) {
                const btn = document.createElement('button');
                btn.className = 'btn-primary';
                btn.textContent = '+ Convidar Usuário';
                btn.onclick = inviteUser;
                mainActions.appendChild(btn);
            }
        }
    };

    // Initial load
    loadUsers();

    return container;
};
