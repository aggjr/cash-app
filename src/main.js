import './style.css'
import './styles/iva-analytics.css'
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
import { AIConsultant } from './components/AIConsultant.js'
import { ParametrosGeraisManager } from './components/ParametrosGeraisManager.js'
import { LogAlteracoesManager } from './components/LogAlteracoesManager.js'
import { DividasEmprestimosManager } from './components/DividasEmprestimosManager.js'
import { IvaAnalytics } from './components/IvaAnalytics.js'

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

  // Append IVA Consultant
  app.appendChild(AIConsultant());

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

  // IVA Agent Toggle
  const ivaWrapper = document.getElementById('ai-consultant-wrapper');
  const toggleEvaBtn = document.getElementById('toggle-IVA-btn');

  if (ivaWrapper) {
    // Load saved state (default visible)
    const isEvaVisible = localStorage.getItem('iva_visible') !== 'false';
    ivaWrapper.style.display = isEvaVisible ? 'block' : 'none';
    if (toggleEvaBtn) {
      toggleEvaBtn.style.opacity = isEvaVisible ? '1' : '0.5';
    }

    if (toggleEvaBtn) {
      toggleEvaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = ivaWrapper.style.display === 'none';
        ivaWrapper.style.display = isHidden ? 'block' : 'none';
        toggleEvaBtn.style.opacity = isHidden ? '1' : '0.5';
        localStorage.setItem('iva_visible', isHidden);
      });
    }
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

  // Centralized IVA cleanup
  window.ivaClearAllHighlights = () => {
    console.log('[IVA] Centralized cleanup: clearing all highlights and indicators');

    // 1. Clear IvaHighlighter (overlays, numbers)
    if (window.IvaHighlighter && typeof window.IvaHighlighter.clearAll === 'function') {
      window.IvaHighlighter.clearAll();
    }

    // 2. Stop IVA Autonomous Loop (Emergency Stop)
    if (window.IVAConsultant && typeof window.IVAConsultant.stopAutonomousLoop === 'function') {
      window.IVAConsultant.stopAutonomousLoop();
    }

    // 3. Clear IvaNavigationIndicator (arrows, borders, golden glow)
    const navArrows = document.querySelectorAll('.IVA-nav-arrow');
    navArrows.forEach(el => el.remove());

    const borderHighlights = document.querySelectorAll('[data-iva-original-border]');
    borderHighlights.forEach(el => {
      try {
        const original = JSON.parse(el.dataset.ivaOriginalBorder);
        el.style.border = original.border;
        el.style.boxShadow = original.boxShadow;
        el.style.position = original.position;
        el.style.zIndex = original.zIndex;
        el.style.animation = '';
        delete el.dataset.ivaOriginalBorder;
      } catch (e) { }
    });

    const bgHighlights = document.querySelectorAll('[data-iva-original-bg]');
    bgHighlights.forEach(el => {
      el.style.backgroundColor = el.dataset.ivaOriginalBg;
      delete el.dataset.ivaOriginalBg;
    });
  };

  window.cashApp.navigate = (itemId) => {
    console.log(`[Navigate] Switching to screen: ${itemId}`);

    // Clear EVERYTHING IVA-related before moving
    window.ivaClearAllHighlights();

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
    } else if (itemId === 'contas') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(AccountManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'empresa') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(CompanyManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'entrada') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(IncomeManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'saida') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(SaidaManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'producao-revenda') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(ProducaoRevendaManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'fechamento') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(FechamentoContasManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'aportes') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(AporteManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'retiradas') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(RetiradaManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'transferencias') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(TransferenciaManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'extrato-conta') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(ExtratoContaManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'consolidada-financeira') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(ConsolidadasManager(currentProject, 'caixa'));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'dre-competencia') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(ConsolidadasManager(currentProject, 'competencia'));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'previsao') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(PrevisaoFluxoManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'usuarios') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(UserManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'parametros-gerais') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(ParametrosGeraisManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'log-alteracoes') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(LogAlteracoesManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'iva-analytics') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(IvaAnalytics());
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    } else if (itemId === 'dividas-emprestimos') {
      const { currentProject } = checkAuth();
      if (currentProject) {
        const mainElement = document.querySelector('main');
        mainElement.innerHTML = '';
        mainElement.appendChild(DividasEmprestimosManager(currentProject));
      } else {
        Dialogs.alert('Selecione um projeto primeiro', 'Aviso');
      }
    }
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

      // Clear IVA highlights when user manually clicks menu
      if (window.IvaHighlighter) {
        window.IvaHighlighter.clearAll();
        console.log('[Menu] Manual click detected, clearing IVA highlights');
      }

      // Use the global navigation function
      if (window.cashApp && window.cashApp.navigate) {
        window.cashApp.navigate(itemId);
      }
    });
  });
}

