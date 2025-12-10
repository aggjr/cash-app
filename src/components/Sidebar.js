export const Sidebar = () => {
  const menuItems = [
    {
      id: 'cadastros',
      label: 'Cadastros',
      icon: '⚙️',
      children: [
        { id: 'empresa', label: 'Empresa', icon: '🏢' },
        { id: 'contas', label: 'Contas', icon: '💳' },
        { id: 'usuarios', label: 'Usuários', icon: '👥' },
        { id: 'tipo-entrada', label: 'Tipo de Entrada', icon: '📥' },
        { id: 'tipo-despesa', label: 'Tipo de Saída', icon: '💸' },
        { id: 'tipo-producao-revenda', label: 'Tipo Producao Revenda', icon: '🏭' },
        { id: 'centros-custo', label: 'Centros Custo', icon: '🏢' },
        { id: 'cnpj-tomador', label: 'Cnpj Tomador', icon: '📝' }
      ]
    },
    {
      id: 'transacoes',
      label: 'Transações Financeiras',
      icon: '⇄',
      children: [
        { id: 'entrada', label: 'Entrada', icon: '💰' },
        { id: 'despesa', label: 'Saída', icon: '💸' },
        { id: 'producao-revenda', label: 'Produção / Revenda', icon: '🏭' }
      ]
    },
    {
      id: 'movimentacoes',
      label: 'Movimentações Internas',
      icon: '🔀',
      children: [
        { id: 'aportes', label: 'Aportes', icon: '➕' },
        { id: 'retiradas', label: 'Retiradas', icon: '➖' },
        { id: 'transferencias', label: 'Transferencias', icon: '↔️' }
      ]
    },
    {
      id: 'fechamento',
      label: 'Fechamento Contas',
      icon: '🎚️',
      children: []
    },
    {
      id: 'extrato-conta',
      label: 'Extrato de Conta',
      icon: '🧾',
      children: []
    },
    {
      id: 'consolidadas',
      label: 'Consolidadas',
      icon: '📑',
      children: []
    },
    {
      id: 'previsao',
      label: 'Previsão Fluxo',
      icon: '📊',
      children: []
    }
  ];

  const renderMenuItem = (item, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const paddingLeft = level * 1.5 + 1;

    return `
      <div class="menu-item-wrapper" data-level="${level}">
        <div class="menu-item" data-id="${item.id}" style="padding-left: ${paddingLeft}rem;">
          ${hasChildren ? `<span class="expand-icon">▶</span>` : '<span class="expand-icon-placeholder"></span>'}
          <span class="menu-icon">${item.icon}</span>
          <span class="menu-label">${item.label}</span>
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
        <a href="#" class="menu-item" id="logout-btn">
          <span class="menu-icon">🚪</span>
          <span class="menu-text">Sair</span>
        </a>
      </div>
    </aside>
  `;
};
