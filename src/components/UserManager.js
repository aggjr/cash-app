import { UserModal } from './UserModal.js';
import { Dialogs } from './Dialogs.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { ExcelExporter } from '../utils/ExcelExporter.js';

export const UserManager = (project) => {
    const API_BASE_URL = getApiBaseUrl();
    const container = document.createElement('div');
    container.className = 'glass-panel';
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

    const loadUsers = async () => {
        try {
            container.querySelector('.users-table-wrapper')?.classList.add('loading');

            const response = await fetch(`${API_BASE_URL}/projects/${project.id}/users`, {
                headers: getHeaders()
            });
            const users = await response.json();

            renderUsers(users);
        } catch (error) {
            console.error('Error loading users:', error);
            showToast('Erro ao carregar usuários', 'error');
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

    const exportToExcel = async (users) => {
        const columns = [
            { header: 'Nome', key: 'name', width: 30 },
            { header: 'E-mail', key: 'email', width: 30 },
            { header: 'Função', key: 'role_display', width: 15, type: 'center' },
            { header: 'Status', key: 'status_display', width: 15, type: 'center' },
            { header: 'Convidado em', key: 'invited_at_formatted', width: 15, type: 'center' },
            { header: 'Convidado por', key: 'invited_by_name', width: 25 }
        ];

        // Prepare data
        const exportData = users.map(u => ({
            ...u,
            role_display: u.role === 'master' ? 'Master' : 'Usuário',
            status_display: u.status === 'active' ? 'Ativo' : (u.status === 'pending' ? 'Pendente' : 'Inativo'),
            invited_at_formatted: formatDate(u.invited_at)
        }));

        await ExcelExporter.exportTable(exportData, columns, 'Usuários', 'usuarios_export');
    };

    const renderUsers = (users) => {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const isMaster = users.find(u => u.id === currentUser.id)?.role === 'master';

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>👥 Usuários do Projeto</h2>
                <div style="display: flex; gap: 0.5rem;">
                     <!-- <a href="#" style="font-size: 0.9rem; color: var(--color-primary);">Lar</a>
                     <span style="color: var(--color-text-muted);">/</span>
                     <span style="font-size: 0.9rem; color: var(--color-text-muted);">Usuários</span> -->
                     <button id="btn-print-pdf" class="btn-secondary" title="Imprimir / Salvar PDF" style="margin-right: 0.5rem;">🖨️ PDF</button>
                     <button id="btn-export-excel" class="btn-secondary" title="Exportar Excel">📊 Excel</button>
                </div>
            </div>

            ${isMaster ? `
                <div style="margin-bottom: 1rem;">
                    <button id="btn-invite-user" class="btn-primary">+ Convidar Usuário</button>
                </div>
            ` : ''}

            <div class="users-table-wrapper" style="flex: 1; overflow: auto; border: 1px solid var(--color-border-light); border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead class="sticky-header">
                        <tr>
                            <th style="text-align: left; padding: 0.75rem 1rem; font-size: 1rem;">Nome</th>
                            <th style="text-align: left; padding: 0.75rem 1rem; font-size: 1rem;">E-mail</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Função</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Status</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Convidado em</th>
                            <th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Convidado por</th>
                            ${isMaster ? '<th style="text-align: center; padding: 0.75rem 1rem; font-size: 1rem;">Ações</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map((user, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
            const isCurrentUser = user.id === currentUser.id;
            return `
                            <tr style="border-bottom: 1px solid var(--color-border-light); background-color: ${bgColor}; transition: background 0.2s;" 
                                onmouseover="this.style.background='rgba(218, 177, 119, 0.5)'" 
                                onmouseout="this.style.background='${bgColor}'">
                                <td style="padding: 0.75rem 1rem; font-size: 0.9rem; font-weight: 500;">
                                    ${user.name} ${isCurrentUser ? '<span style="color: var(--color-primary); font-size: 0.8rem;">(Você)</span>' : ''}
                                </td>
                                <td style="padding: 0.75rem 1rem; font-size: 0.9rem; color: var(--color-text-muted);">
                                    ${user.email}
                                </td>
                                <td style="padding: 0.75rem 1rem; text-align: center;">
                                    <span class="badge-${user.role === 'master' ? 'master' : 'user'}">
                                        ${user.role === 'master' ? '👑 Master' : '👤 Usuário'}
                                    </span>
                                </td>
                                <td style="padding: 0.75rem 1rem; text-align: center;">
                                    <span class="badge-${user.status === 'active' ? 'active' : 'inactive'}">
                                        ${user.status === 'active' ? '✓ Ativo' : '✕ Inativo'}
                                    </span>
                                </td>
                                <td style="padding: 0.75rem 1rem; font-size: 0.85rem; text-align: center; color: var(--color-text-muted);">
                                    ${formatDate(user.invited_at)}
                                </td>
                                <td style="padding: 0.75rem 1rem; font-size: 0.85rem; text-align: center; color: var(--color-text-muted);">
                                    ${user.invited_by_name || '-'}
                                </td>
                                ${isMaster ? `
                                    <td style="padding: 0.75rem 1rem; text-align: center;">
                                        ${user.role !== 'master' && !isCurrentUser ? `
                                            <button class="btn-delete" data-id="${user.id}" data-name="${user.name}" style="color: #EF4444; font-size: 1.2rem; background: none; border: none; cursor: pointer; transition: transform 0.2s;" 
                                                onmouseover="this.style.transform='scale(1.2)'" 
                                                onmouseout="this.style.transform='scale(1)'">🗑️</button>
                                        ` : '<span style="color: var(--color-text-muted);">-</span>'}
                                    </td>
                                ` : ''}
                            </tr>
                        `}).join('')}
                        ${users.length === 0 ? `
                            <tr>
                                <td colspan="${isMaster ? '7' : '6'}" style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                                    <div style="font-size: 3rem; margin-bottom: 1rem;">👥</div>
                                    <div style="font-size: 1.1rem;">Nenhum usuário encontrado</div>
                                    ${isMaster ? '<div style="font-size: 0.9rem; margin-top: 0.5rem;">Clique em "Convidar Usuário" para começar</div>' : ''}
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--color-text-muted);">
                <div>Total: ${users.length} usuário${users.length !== 1 ? 's' : ''}</div>
                <div>Projeto: <span style="font-weight: 600; color: var(--color-primary);">${project.name}</span></div>
            </div>
        `;

        if (isMaster) {
            const inviteBtn = container.querySelector('#btn-invite-user');
            if (inviteBtn) {
                inviteBtn.addEventListener('click', inviteUser);
            }

            container.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    removeUser(btn.dataset.id, btn.dataset.name);
                });
            });
        }

        container.querySelector('#btn-print-pdf').addEventListener('click', () => window.print());
        container.querySelector('#btn-export-excel').addEventListener('click', () => exportToExcel(users));
    };

    loadUsers();

    return container;
};
