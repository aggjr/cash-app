import { InviteUserModal } from './InviteUserModal.js';
import { getApiBaseUrl } from '../utils/apiConfig.js';

export const UserManagement = (project, onBack) => {
    const API_BASE_URL = getApiBaseUrl();
    const container = document.createElement('div');
    container.className = 'glass-panel';
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.height = 'calc(100vh - 150px)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    let allUsers = [];

    const getHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status) => {
        const badges = {
            'pending': '<span style="background: #FEF3C7; color: #92400E; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">⏳ Pendente</span>',
            'active': '<span style="background: #D1FAE5; color: #065F46; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">✓ Ativo</span>',
            'inactive': '<span style="background: #FEE2E2; color: #991B1B; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">✗ Inativo</span>'
        };
        return badges[status] || status;
    };

    const getRoleBadge = (role) => {
        if (role === 'master') {
            return '<span style="background: linear-gradient(135deg, #DAB177 0%, #C89F5F 100%); color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; box-shadow: 0 2px 4px rgba(218,177,119,0.3);">👑 Master</span>';
        }
        return '<span style="background: #E0E7FF; color: #3730A3; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">👤 Usuário</span>';
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

    const loadUsers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${project.id}/users`, {
                headers: getHeaders()
            });

            if (response.ok) {
                allUsers = await response.json();
                renderUsers();
            } else {
                showToast('Erro ao carregar usuários', 'error');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    const inviteUser = async () => {
        await InviteUserModal.show({
            projectId: project.id,
            onSuccess: () => {
                loadUsers();
            }
        });
    };

    const removeUser = async (userId, userName) => {
        if (!confirm(`Tem certeza que deseja remover "${userName}" deste projeto?`)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/projects/${project.id}/users/${userId}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showToast('Usuário removido com sucesso', 'success');
                loadUsers();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao remover usuário', 'error');
            }
        } catch (error) {
            console.error('Error removing user:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    const transferMaster = async (newMasterId, newMasterName) => {
        if (!confirm(`⚠️ ATENÇÃO!\n\nVocê está prestes a transferir a função de Master para "${newMasterName}".\n\nApós esta ação:\n• Você deixará de ser Master deste projeto\n• "${newMasterName}" se tornará o novo Master\n• Apenas o Master pode gerenciar usuários e permissões\n\nDeseja continuar?`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/projects/${project.id}/transfer-master`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ newMasterId })
            });

            if (response.ok) {
                showToast('Master transferido com sucesso', 'success');
                setTimeout(() => {
                    loadUsers();
                    alert('ℹ️ Você não é mais o Master deste projeto.\n\nSuas permissões foram alteradas para Usuário.');
                }, 500);
            } else {
                const error = await response.json();
                showToast(error.error || 'Erro ao transferir master', 'error');
            }
        } catch (error) {
            console.error('Error transferring master:', error);
            showToast('Erro de conexão', 'error');
        }
    };

    const renderUsers = () => {
        const currentUserId = JSON.parse(localStorage.getItem('user')).id;
        const currentUserRole = allUsers.find(u => u.id === currentUserId)?.role;
        const isMaster = currentUserRole === 'master';

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <button id="btn-back" class="btn-secondary">← Voltar</button>
                    <h2>👥 Usuários do Projeto: ${project.name}</h2>
                </div>
                ${isMaster ? '<button id="btn-invite" class="btn-primary">+ Cadastrar Usuário</button>' : ''}
            </div>

            <div class="incomes-table-wrapper" style="flex: 1; overflow: auto; border: 1px solid var(--color-border-light); border-radius: 8px; box-shadow: var(--shadow-sm);">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead class="sticky-header">
                        <tr>
                            <th style="text-align: left; padding: 0.75rem; font-size: 0.85rem; width: 250px;">Nome</th>
                            <th style="text-align: left; padding: 0.75rem; font-size: 0.85rem; width: 250px;">E-mail</th>
                            <th style="text-align: center; padding: 0.75rem; font-size: 0.85rem; width: 120px;">Função</th>
                            <th style="text-align: center; padding: 0.75rem; font-size: 0.85rem; width: 120px;">Status</th>
                            <th style="text-align: center; padding: 0.75rem; font-size: 0.85rem; width: 120px;">Convidado Por</th>
                            <th style="text-align: center; padding: 0.75rem; font-size: 0.85rem; width: 120px;">Data Convite</th>
                            <th style="text-align: center; padding: 0.75rem; font-size: 0.85rem; width: 120px;">Data Ativação</th>
                            ${isMaster ? '<th style="text-align: center; padding: 0.75rem; font-size: 0.85rem; width: 100px;">Ações</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${allUsers.map((user, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? '#FFFFFF' : '#F3F4F6';
            const isCurrentUser = user.id === currentUserId;
            const canRemove = isMaster && !isCurrentUser && user.role !== 'master';
            const canTransfer = isMaster && !isCurrentUser && user.status === 'active';

            return `
                                <tr style="border-bottom: 1px solid var(--color-border-light); background-color: ${bgColor}; transition: background 0.2s;" 
                                    onmouseover="this.style.background='rgba(218, 177, 119, 0.5)'" 
                                    onmouseout="this.style.background='${bgColor}'">
                                    <td style="padding: 0.5rem 0.75rem; font-size: 0.85rem;">
                                        <strong>${user.name}</strong>
                                        ${isCurrentUser ? '<span style="color: var(--color-primary); font-size: 0.75rem;"> (Você)</span>' : ''}
                                    </td>
                                    <td style="padding: 0.5rem 0.75rem; font-size: 0.85rem; color: #666;">${user.email}</td>
                                    <td style="padding: 0.5rem 0.75rem; text-align: center;">${getRoleBadge(user.role)}</td>
                                    <td style="padding: 0.5rem 0.75rem; text-align: center;">${getStatusBadge(user.status)}</td>
                                    <td style="padding: 0.5rem 0.75rem; font-size: 0.85rem; text-align: center;">${user.invited_by_name || '-'}</td>
                                    <td style="padding: 0.5rem 0.75rem; font-size: 0.85rem; text-align: center;">${formatDate(user.invited_at)}</td>
                                    <td style="padding: 0.5rem 0.75rem; font-size: 0.85rem; text-align: center;">${formatDate(user.joined_at)}</td>
                                    ${isMaster ? `
                                        <td style="padding: 0.5rem 0.75rem; text-align: center;">
                                            ${canTransfer ? `<button class="btn-transfer" data-id="${user.id}" data-name="${user.name}" style="background: #DAB177; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; margin-right: 4px;" title="Transferir Master">👑</button>` : ''}
                                            ${canRemove ? `<button class="btn-remove" data-id="${user.id}" data-name="${user.name}" style="background: #EF4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;" title="Remover">🗑️</button>` : ''}
                                        </td>
                                    ` : ''}
                                </tr>
                            `;
        }).join('')}
                        ${allUsers.length === 0 ? `
                            <tr>
                                <td colspan="${isMaster ? 8 : 7}" style="padding: 3rem; text-align: center; color: var(--color-text-muted);">
                                    <div style="font-size: 3rem; margin-bottom: 1rem;">👥</div>
                                    <div style="font-size: 1.1rem;">Nenhum usuário neste projeto</div>
                                    ${isMaster ? '<div style="font-size: 0.9rem; margin-top: 0.5rem;">Clique em "Convidar Usuário" para adicionar</div>' : ''}
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--color-text-muted);">
                <div>Total: ${allUsers.length} usuário(s)</div>
                <div>
                    <span style="margin-right: 1rem;">✓ Ativos: ${allUsers.filter(u => u.status === 'active').length}</span>
                    <span style="margin-right: 1rem;">⏳ Pendentes: ${allUsers.filter(u => u.status === 'pending').length}</span>
                    <span>👑 Masters: ${allUsers.filter(u => u.role === 'master').length}</span>
                </div>
            </div>
        `;

        // Event listeners
        const backBtn = container.querySelector('#btn-back');
        if (backBtn) backBtn.addEventListener('click', onBack);

        const inviteBtn = container.querySelector('#btn-invite');
        if (inviteBtn) inviteBtn.addEventListener('click', inviteUser);

        container.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                removeUser(btn.dataset.id, btn.dataset.name);
            });
        });

        container.querySelectorAll('.btn-transfer').forEach(btn => {
            btn.addEventListener('click', () => {
                transferMaster(btn.dataset.id, btn.dataset.name);
            });
        });
    };

    // Initial load
    loadUsers();

    return container;
};
