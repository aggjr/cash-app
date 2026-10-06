import './style.css'

import { Sidebar } from './components/Sidebar.js'
import { Hero } from './components/Hero.js'
import { Footer } from './components/Footer.js'
import { createTreeManager } from './components/GenericTreeManager.js'
import { Dialogs } from './components/Dialogs.js'
import { Login } from './components/Login.js'
import { Register } from './components/Register.js'
import { ProjectList } from './components/ProjectList.js'
import { UserManager } from './components/UserManager.js'
import { AccountManager } from './components/AccountManager.js'
import { CompanyManager } from './components/CompanyManager.js'
import { FornecedorManager } from './components/FornecedorManager.js'
import { IncomeManager } from './components/IncomeManager.js'
import { SaidaManager } from './components/SaidaManager.js'
import { ProducaoRevendaManager } from './components/ProducaoRevendaManager.js'
import { FechamentoContasManager } from './components/FechamentoContasManager.js'
import { ActivateAccount } from './components/ActivateAccount.js'
import { AporteManager } from './components/AporteManager.js'
import { RetiradaManager } from './components/RetiradaManager.js'
import { TransferenciaManager } from './components/TransferenciaManager.js'
import { ExtratoContaManager } from './components/ExtratoContaManager.js'
import { ConsolidadasManager } from './components/ConsolidadasManager.js'
import { PrevisaoFluxoManager } from './components/PrevisaoFluxoManager.js'

import { ParametrosGeraisManager } from './components/ParametrosGeraisManager.js'
import { LogAlteracoesManager } from './components/LogAlteracoesManager.js'
import { DividasEmprestimosManager } from './components/DividasEmprestimosManager.js'
import { GraficosIndicadoresManager } from './components/GraficosIndicadoresManager.js'

// Marketing Module
import { CampanhasManager } from './components/CampanhasManager.js'
import { CaracteristicasManager } from './components/CaracteristicasManager.js'
import { GruposLeadsManager } from './components/GruposLeadsManager.js'
import { LeadsManager } from './components/LeadsManager.js'


console.log('═══════════════════════════════════════');
console.log('💰 CASH Frontend Starting');
console.log('⏰ Started at:', new Date().toISOString());
console.log('🌍 Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('🔧 Mode:', import.meta.env.MODE);
console.log('═══════════════════════════════════════');

// Force logout on startup (page reload)
localStorage.removeItem('token');
localStorage.removeItem('user');
localStorage.removeItem('projects');
localStorage.removeItem('currentProject');

Dialogs.init();

const app = document.querySelector('#app');

// Auth State
const checkAuth = () => {
  const token = localStorage.getItem('token');
  const currentProject = JSON.parse(localStorage.getItem('currentProject'));
  return { token, currentProject };
};

const renderApp = () => {
  const { token } = checkAuth();

  // Check if we're on the activation page
  // We need to account for the base path '/projects/cash' in production
  const path = window.location.pathname;
  if (path.endsWith('/activate') || window.location.search.includes('token=')) {
    app.innerHTML = '';
    app.appendChild(ActivateAccount());
    return;
  }

  if (!token) {
    renderLogin();
    return;
  }

  app.innerHTML = `
    ${Sidebar()}
    <div id="main-content" class="main-content">
      <main style="flex: 1; display: flex; flex-direction: column; overflow: auto; padding: 0 var(--space-sm);">
        ${Hero()}
      </main>
      ${Footer()}
    </div>
  `;



  initAppLogic();
};

const renderLogin = () => {
  app.innerHTML = '';
  app.appendChild(Login(renderApp));
};

const renderRegister = () => {
  app.innerHTML = '';
  app.appendChild(Register(renderLogin));
};

const renderProjectList = () => {
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = '';
    main.appendChild(ProjectList(() => {
      // On project select, reload app to update sidebar/context
      renderApp();
    }));
  }
};

const renderUserManagement = (project) => {
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML = '';
    main.appendChild(UserManagement(project, renderProjectList));
  }
};

// Navigation Event Listener
window.addEventListener('navigate', (e) => {
  if (e.detail === 'login') renderLogin();
  if (e.detail === 'register') renderRegister();
  if (e.detail === 'app') renderApp();
  if (e.detail === 'projects') renderProjectList();
  if (e.detail === 'projects') renderProjectList();
  if (e.detail && e.detail.page === 'users') renderUserManagement(e.detail.project);
});

window.addEventListener('project-updated', () => {
  renderApp();
});

// Initial Render
renderApp();

function initAppLogic() {
  // Sidebar toggle functionality
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const mainContent = document.getElementById('main-content');

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      mainContent.classList.toggle('expanded');
    });
  }



  // Theme toggle functionality
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle ? themeToggle.querySelector('.theme-icon') : null;
  const body = document.body;

  // Check for saved theme preference
  const savedTheme = localStorage.getItem('cash_theme');
  if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
    if (themeIcon) themeIcon.textContent = '☀️';
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      body.classList.toggle('dark-mode');
      const isDark = body.classList.contains('dark-mode');

      // Update icon
      if (themeIcon) themeIcon.textContent = isDark ? '☀️' : '🌙';

      // Save preference
      localStorage.setItem('cash_theme', isDark ? 'dark' : 'light');
    });
  }

  // Logout functionality
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('projects');
      localStorage.removeItem('currentProject');
      renderLogin();
    });
  }

  // Tree manager configurations - Moved to module scope for access by navigate
  const treeConfigs = {
    'tipo-entrada': { tableName: 'tipo_entrada', title: 'Tipo Entrada', term: 'Entrada' },
    'tipo-saida': { tableName: 'tipo_saida', title: 'Tipo de Saída', term: 'Saída' },
    'tipo-producao-revenda': { tableName: 'tipo_producao_revenda', title: 'Compras<br/><span style="font-size: 0.85em;">(Produção/Revenda)</span>', term: 'Produção/Revenda' }
  };

  // Global Navigation Function (Accessble by IVA)
  window.cashApp = window.cashApp || {};



  window.cashApp.navigate = (itemIdOrName) => {
    console.log(`[Navigate] Requested screen: "${itemIdOrName}"`);

    // Helper: Normalize string for comparison
    const normalize = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
    let itemId = normalize(itemIdOrName);
    const originalInput = itemIdOrName;

    // 1. Try to resolve ID if it's a name (Robust Lookup)
    // First, check if the ID exists directly in our treeConfigs or hardcoded conditions
    const knownIds = [
      'contas', 'empresa', 'entrada', 'saida', 'producao-revenda', 'fechamento',
      'aportes', 'retiradas', 'transferencias', 'extrato-conta', 'consolidada-financeira',
      'dre-competencia', 'previsao', 'graficos-visao-geral', 'graficos-estatisticos',
      'graficos-abc', 'usuarios', 'parametros-gerais', 'log-alteracoes',
      'iva-analytics', 'dividas-emprestimos',
      'campanhas', 'caracteristicas', 'grupos-leads', 'leads'
    ];

    const treeIds = Object.keys(treeConfigs);
    const allValidIds = [...knownIds, ...treeIds];

    // If inputs isn't a valid ID, try to find the menu item by text
    if (!allValidIds.includes(itemIdOrName)) { // Check exact match first
      console.log(`[Navigate] "${itemIdOrName}" is not a known ID, searching menu items by text...`);

      const menuItems = document.querySelectorAll('.menu-item');
      let foundId = null;
      let bestMatchScore = 0;

      menuItems.forEach(item => {
        const id = item.dataset.id;
        const label = item.querySelector('.menu-label')?.textContent || '';
        const title = item.title || '';

        const normativeLabel = normalize(label);
        const normativeTitle = normalize(title);
        const normativeId = normalize(id);

        // Exact match strategies
        if (normativeId === itemId) { foundId = id; bestMatchScore = 10; }
        else if (normativeLabel === itemId) { foundId = id; bestMatchScore = 9; }
        else if (normativeTitle === itemId) { foundId = id; bestMatchScore = 8; }
        // Partial match strategies (only if no exact match found yet)
        else if (bestMatchScore < 5) {
          if (normativeLabel.includes(itemId)) { foundId = id; bestMatchScore = 5; }
          else if (itemId.includes(normativeLabel) && normativeLabel.length > 3) { foundId = id; bestMatchScore = 4; }
        }
      });

      if (foundId) {
        console.log(`[Navigate] Resolved "${itemIdOrName}" to ID: "${foundId}"`);
        itemId = foundId;
      } else {
        console.warn(`[Navigate] Could not resolve "${itemIdOrName}" to any menu item.`);
        // Continue with original normalized input, might fail below but allows pass-through
      }
    } else {
      itemId = itemIdOrName; // It was a valid ID
    }



    // Update UI active state
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.menu-item[data-id="${itemId}"]`);
    if (activeItem) activeItem.classList.add('active');

    // Check if this is a tree manager item
    if (treeConfigs[itemId]) {
      const config = treeConfigs[itemId];
      const manager = createTreeManager(config.tableName, config.title, config.term);

      const mainElement = document.querySelector('main');
      mainElement.innerHTML = manager.render();
      manager.init();
      return true;
    }

    // --- Manual Routing Table ---
    // Using simple if/else for clarity and scope access

    const routeHandler = (managerFn, ...args) => {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(managerFn(currentProject, ...args));
        return true;
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
        return false;
      }
    };

    if (itemId === 'contas') return routeHandler(AccountManager);
    if (itemId === 'empresa') return routeHandler(CompanyManager);
    if (itemId === 'fornecedores') return routeHandler(FornecedorManager);
    if (itemId === 'entrada') return routeHandler(IncomeManager);
    if (itemId === 'saida') return routeHandler(SaidaManager);
    if (itemId === 'producao-revenda') return routeHandler(ProducaoRevendaManager);
    if (itemId === 'fechamento') return routeHandler(FechamentoContasManager);
    if (itemId === 'aportes') return routeHandler(AporteManager);
    if (itemId === 'retiradas') return routeHandler(RetiradaManager);
    if (itemId === 'transferencias') return routeHandler(TransferenciaManager);
    if (itemId === 'extrato-conta') return routeHandler(ExtratoContaManager);
    if (itemId === 'consolidada-financeira') return routeHandler(ConsolidadasManager, 'caixa');
    if (itemId === 'dre-competencia') return routeHandler(ConsolidadasManager, 'competencia');
    if (itemId === 'previsao') return routeHandler(PrevisaoFluxoManager);
    if (itemId === 'graficos-visao-geral') return routeHandler(GraficosIndicadoresManager, 'overview');
    if (itemId === 'graficos-estatisticos') return routeHandler(GraficosIndicadoresManager, 'statistical');
    if (itemId === 'graficos-abc') return routeHandler(GraficosIndicadoresManager, 'abc');
    if (itemId === 'usuarios') return routeHandler(UserManager);
    if (itemId === 'parametros-gerais') return routeHandler(ParametrosGeraisManager);
    if (itemId === 'log-alteracoes') return routeHandler(LogAlteracoesManager);

    if (itemId === 'dividas-emprestimos') return routeHandler(DividasEmprestimosManager);

    // Marketing Module
    if (itemId === 'campanhas') return routeHandler(CampanhasManager);
    if (itemId === 'caracteristicas') return routeHandler(CaracteristicasManager);
    if (itemId === 'grupos-leads') return routeHandler(GruposLeadsManager);
    if (itemId === 'leads') return routeHandler(LeadsManager);

    console.warn(`[Navigate] Unknown route ID: ${itemId}`);
    return false;
  };

  // Menu item expand/collapse functionality
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    const expandIcon = item.querySelector('.expand-icon');

    // Handle submenu toggle
    if (expandIcon && expandIcon.textContent.trim() !== '') {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = item.dataset.id;
        const submenu = document.querySelector(`.submenu[data-parent="${itemId}"]`);

        if (submenu) {
          const isVisible = submenu.style.display !== 'none';
          submenu.style.display = isVisible ? 'none' : 'block';
          expandIcon.textContent = isVisible ? '▶' : '▼';
        }
      });
    }

    // Handle navigation
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = item.dataset.id;



      // Use the global navigation function
      if (window.cashApp && window.cashApp.navigate) {
        window.cashApp.navigate(itemId);
      }
    });
  });
}


// Global Version Display Overlay
(function () {
  const versionId = 'cash-system-version-overlay';
  if (document.getElementById(versionId)) return;

  const versionEl = document.createElement('div');
  versionEl.id = versionId;
  versionEl.textContent = 'v0.9.23';
  versionEl.style.cssText = `
    position: fixed;
    bottom: 5px;
    left: 140px; /* Moved right to avoid icon overlap */
    font-size: 0.75rem;
    color: var(--color-text-muted);
    opacity: 0.6;
    z-index: 99999; /* Ensure it is above everything, including modals */
    pointer-events: none;
    user-select: none;
    font-family: var(--font-main);
    text-shadow: 0 1px 2px rgba(255,255,255,0.8); /* Better visibility on dark/light */
  `;

  // Adjust specifically for dark mode visibility if needed via class observer, 
  // but CSS var should handle it if --color-text-muted is adaptive.

  document.body.appendChild(versionEl);
})();
