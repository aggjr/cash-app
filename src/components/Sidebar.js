export const Sidebar = () => {
  // Get user role from currentProject (role is project-specific)
  const projectData = localStorage.getItem('currentProject');
  const userRole = projectData ? JSON.parse(projectData).role : null;

  const allMenuItems = [
    {
      id: 'configuracoes',
      label: 'Configurações do Sistema',
      icon: '⚙️',
      masterOnly: true, // Only MASTER users can see this
      children: [
        { id: 'parametros-gerais', label: 'Parâmetros Gerais', icon: '📝' },
        { id: 'log-alteracoes', label: 'Log de Alterações', icon: '📜' }
      ]
    },
    {
      id: 'cadastros',
      label: 'Cadastros',
      icon: '📋',
      children: [
        { id: 'empresa', label: 'Empresa', icon: '🏢' },
        { id: 'fornecedores', label: 'Fornecedores', icon: '🚚' },
        { id: 'contas', label: 'Contas', icon: '💳' },
        { id: 'usuarios', label: 'Usuários', icon: '👥' },
        { id: 'tipo-entrada', label: 'Tipo de Entrada', icon: '📥' },
        { id: 'tipo-saida', label: 'Tipo de Saída', icon: '💸' },
        { id: 'tipo-producao-revenda', label: 'Tipo de Compras', icon: '🏭' },
        { id: 'centros-custo', label: 'Centros Custo', icon: '🏢', disabled: true },

      ]
    },
    {
      id: 'transacoes',
      label: 'Transações Financeiras',
      icon: '⇄',
      children: [
        { id: 'entrada', label: 'Entrada', icon: '💰' },
        { id: 'saida', label: 'Saída', icon: '💸' },
        { id: 'producao-revenda', label: 'Compras<br/><span style="font-size: 0.85em;">(Produção/Revenda)</span>', icon: '🏭' },
        { id: 'transferencias', label: 'Transferencias', icon: '↔️' },
        { id: 'dividas-emprestimos', label: 'Dívidas/Empréstimos', icon: '🏦' }
      ]
    },
    {
      id: 'movimentacoes',
      label: 'Transações com os sócios',
      icon: '🔀',
      children: [
        { id: 'aportes', label: 'Aportes', icon: '➕' },
        { id: 'retiradas', label: 'Retiradas', icon: '➖' }
      ]
    },
    {
      id: 'analise-financeira',
      label: 'Análise Financeira',
      icon: '💲',
      children: [
        { id: 'fechamento', label: 'Fechamento Contas', icon: '🎚️' },
        { id: 'extrato-conta', label: 'Extrato de Conta', icon: '🧾' },
        { id: 'consolidada-financeira', label: 'Consolidada Financeira', icon: '💰' },
        { id: 'dre-competencia', label: 'DRE (Competência)', icon: '📊' },

        { id: 'previsao', label: 'Previsão Fluxo', icon: '📈' }
      ]
    },
    {
      id: 'graficos-indicadores',
      label: 'Gráficos e Indicadores',
      icon: '📊',
      children: [
        { id: 'graficos-visao-geral', label: 'Visão Geral & Dispersão', icon: '📉' },
        { id: 'graficos-estatisticos', label: 'Controle Estatístico (XmR)', icon: '📐' },
        { id: 'graficos-abc', label: 'Curva ABC (Pareto)', icon: '🏆' }
      ]
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: '📢',
      children: [
        { id: 'campanhas', label: 'Campanhas', icon: '📢' },
        { id: 'grupos-leads', label: 'Grupos de Leads', icon: '👥' },
        { id: 'leads', label: 'Leads', icon: '🎯' },
        { id: 'caracteristicas', label: 'Características', icon: '🏷️' }
      ]
    }
  ];

  // Debug: log the role detection
  console.log('Sidebar Debug - projectData:', localStorage.getItem('currentProject'));
  console.log('Sidebar Debug - userRole:', userRole);

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter(item => {
    // If item requires MASTER role and user is not MASTER, hide it
    if (item.masterOnly && userRole?.toLowerCase() !== 'master') {
      console.log(`Filtering out ${item.label} - masterOnly:${item.masterOnly}, userRole:${userRole}`);
      return false;
    }
    return true;
  });

  const renderMenuItem = (item, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const paddingLeft = level * 1.5 + 1;

    const isDisabled = item.disabled;
    const style = isDisabled ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;' : '';
    const title = isDisabled ? 'Em breve' : '';

    return `
      <div class="menu-item-wrapper" data-level="${level}">
        <div class="menu-item ${isDisabled ? 'disabled' : ''}" data-id="${item.id}" style="padding-left: ${paddingLeft}rem; ${style}" title="${title}">
          ${hasChildren ? `<span class="expand-icon">▶</span>` : '<span class="expand-icon-placeholder"></span>'}
          <span class="menu-icon">${item.icon}</span>
          <span class="menu-label notranslate" translate="no">${item.label}</span>
          ${isDisabled ? '<span class="status-badge" style="margin-left: auto; font-size: 0.6rem; background: #94a3b8; color: white; padding: 2px 6px; border-radius: 4px;">Em breve</span>' : ''}
        </div>
        ${hasChildren ? `
          <div class="submenu" data-parent="${item.id}" style="display: none;">
            ${item.children.map(child => renderMenuItem(child, level + 1)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  };

  return `
    <aside id="sidebar" class="sidebar">
      <div class="sidebar-header">
        <div class="logo-section">
          <img src="/icon-light.png" alt="Logo" class="sidebar-icon logo-light" />
          <img src="/icon-dark.png" alt="Logo" class="sidebar-icon logo-dark" />
          <span class="logo-text notranslate" translate="no">CASH</span>
        </div>
        <button id="theme-toggle" class="sidebar-toggle-btn" title="Toggle Theme" style="margin-right: 0.5rem;">
          <span class="theme-icon">🌙</span>
        </button>
        <button id="sidebar-toggle" class="sidebar-toggle-btn" title="Toggle Sidebar">
          <span class="toggle-icon">◀</span>
        </button>
      </div>
      <nav class="sidebar-nav">
        ${menuItems.map(item => renderMenuItem(item)).join('')}
      </nav>
      <div class="sidebar-footer">
        <a href="#" class="menu-item" id="toggle-IVA-btn" title="Habilitar/Desabilitar IVA">
          <span class="menu-icon"><img src="/robot_icon.png" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;"></span>
          <span class="menu-text">IVA</span>
        </a>
        <a href="#" class="menu-item" id="logout-btn">
          <span class="menu-icon">🚪</span>
          <span class="menu-text">Sair</span>
        </a>
      </div>
      <div style="padding: 0.5rem; text-align: center; font-size: 0.7rem; color: #64748b; opacity: 0.8;">
        v0.9.23
      </div>
    </aside>
  `;
};

