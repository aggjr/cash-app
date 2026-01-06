/**
 * MenuNavigator - Extracts and manages menu structure for IVA
 * Enables IVA to navigate and search through application menu systematically
 */

// Navigation state
let navigationState = {
    lastSearchPosition: null,
    searchHistory: []
};

// Menu structure extracted from Sidebar.js
// This is the complete menu that IVA can search through
const getMenuStructure = () => {
    // Get user role to filter menu appropriately
    const projectData = localStorage.getItem('currentProject');
    const userRole = projectData ? JSON.parse(projectData).role : null;

    const allMenuItems = [
        {
            id: 'configuracoes',
            label: 'Configurações do Sistema',
            icon: '⚙️',
            masterOnly: true,
            children: [
                { id: 'parametros-gerais', label: 'Parâmetros Gerais', icon: '📝', path: ['Configurações do Sistema', 'Parâmetros Gerais'] },
                { id: 'log-alteracoes', label: 'Log de Alterações', icon: '📜', path: ['Configurações do Sistema', 'Log de Alterações'] }
            ]
        },
        {
            id: 'cadastros',
            label: 'Cadastros',
            icon: '📋',
            children: [
                { id: 'empresa', label: 'Empresa', icon: '🏢', path: ['Cadastros', 'Empresa'] },
                { id: 'contas', label: 'Contas', icon: '💳', path: ['Cadastros', 'Contas'] },
                { id: 'usuarios', label: 'Usuários', icon: '👥', path: ['Cadastros', 'Usuários'] },
                { id: 'tipo-entrada', label: 'Tipo de Entrada', icon: '📥', path: ['Cadastros', 'Tipo de Entrada'] },
                { id: 'tipo-saida', label: 'Tipo de Saída', icon: '💸', path: ['Cadastros', 'Tipo de Saída'] },
                { id: 'tipo-producao-revenda', label: 'Compras (Produção/Revenda)', icon: '🏭', path: ['Cadastros', 'Compras (Produção/Revenda)'] },
                { id: 'centros-custo', label: 'Centros Custo', icon: '🏢', path: ['Cadastros', 'Centros Custo'], disabled: true }
            ]
        },
        {
            id: 'transacoes',
            label: 'Transações Financeiras',
            icon: '⇄',
            children: [
                { id: 'entrada', label: 'Entrada', icon: '💰', path: ['Transações Financeiras', 'Entrada'], description: 'Registrar receitas e entradas de dinheiro' },
                { id: 'saida', label: 'Saída', icon: '💸', path: ['Transações Financeiras', 'Saída'], description: 'Registrar despesas e saídas de dinheiro' },
                { id: 'producao-revenda', label: 'Compras (Produção/Revenda)', icon: '🏭', path: ['Transações Financeiras', 'Compras (Produção/Revenda)'], description: 'Registrar compras para produção ou revenda' },
                { id: 'transferencias', label: 'Transferências', icon: '↔️', path: ['Transações Financeiras', 'Transferências'], description: 'Transferir dinheiro entre contas' },
                { id: 'dividas-emprestimos', label: 'Dívidas/Empréstimos', icon: '🏦', path: ['Transações Financeiras', 'Dívidas/Empréstimos'], description: 'Gerenciar dívidas, empréstimos e financiamentos' }
            ]
        },
        {
            id: 'movimentacoes',
            label: 'Transações com os sócios',
            icon: '🔀',
            children: [
                { id: 'aportes', label: 'Aportes', icon: '➕', path: ['Transações com os sócios', 'Aportes'], description: 'Registrar aportes de capital dos sócios' },
                { id: 'retiradas', label: 'Retiradas', icon: '➖', path: ['Transações com os sócios', 'Retiradas'], description: 'Registrar retiradas de dinheiro pelos sócios' }
            ]
        },
        {
            id: 'analise-financeira',
            label: 'Análise Financeira',
            icon: '💲',
            children: [
                { id: 'fechamento', label: 'Fechamento Contas', icon: '🎚️', path: ['Análise Financeira', 'Fechamento Contas'], description: 'Ver saldos e fechamento de contas' },
                { id: 'extrato-conta', label: 'Extrato de Conta', icon: '🧾', path: ['Análise Financeira', 'Extrato de Conta'], description: 'Ver extrato detalhado de uma conta' },
                { id: 'consolidadas', label: 'Consolidadas', icon: '📑', path: ['Análise Financeira', 'Consolidadas'], description: 'Ver todas as transações consolidadas' },
                { id: 'previsao', label: 'Previsão Fluxo', icon: '📈', path: ['Análise Financeira', 'Previsão Fluxo'], description: 'Ver previsão de fluxo de caixa' }
            ]
        }
    ];

    // Filter based on user role (same logic as Sidebar.js)
    const filteredMenu = allMenuItems.filter(item => {
        if (item.masterOnly && userRole?.toLowerCase() !== 'master') {
            return false;
        }
        return true;
    });

    // Flatten menu into searchable array with full paths
    const flattenedMenu = [];
    filteredMenu.forEach(category => {
        if (category.children) {
            category.children.forEach(item => {
                if (!item.disabled) {
                    flattenedMenu.push({
                        id: item.id,
                        label: item.label,
                        icon: item.icon,
                        category: category.label,
                        categoryIcon: category.icon,
                        path: item.path || [category.label, item.label],
                        description: item.description || '',
                        fullPath: `${category.label} > ${item.label}`
                    });
                }
            });
        }
    });

    return {
        categories: filteredMenu,
        flatMenu: flattenedMenu,
        totalItems: flattenedMenu.length
    };
};

// Get current navigation state
const getNavigationState = () => {
    return {
        ...navigationState,
        hasHistory: navigationState.searchHistory.length > 0
    };
};

// Set last search position
const setLastSearchPosition = (menuItemId) => {
    navigationState.lastSearchPosition = menuItemId;
    navigationState.searchHistory.push({
        itemId: menuItemId,
        timestamp: new Date().toISOString()
    });
};

// Reset navigation state (for new search)
const resetNavigation = () => {
    navigationState = {
        lastSearchPosition: null,
        searchHistory: []
    };
};

// Get next menu item from a position
const getNextMenuItem = (fromPosition = null) => {
    const menu = getMenuStructure();
    const flatMenu = menu.flatMenu;

    if (!fromPosition) {
        return flatMenu[0] || null;
    }

    const currentIndex = flatMenu.findIndex(item => item.id === fromPosition);
    if (currentIndex === -1 || currentIndex >= flatMenu.length - 1) {
        return null; // End of menu
    }

    return flatMenu[currentIndex + 1];
};

// Export for use in IVA
export const MenuNavigator = {
    getMenuStructure,
    getNavigationState,
    setLastSearchPosition,
    resetNavigation,
    getNextMenuItem
};
