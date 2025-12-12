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

  // Tree manager configurations
  const treeConfigs = {
    'tipo-entrada': { tableName: 'tipo_entrada', title: 'Tipo Entrada', term: 'Entrada' },
    'tipo-saida': { tableName: 'tipo_saida', title: 'Tipo de Saída', term: 'Saída' },
    'tipo-producao-revenda': { tableName: 'tipo_producao_revenda', title: 'Tipo Produção Revenda', term: 'Produção/Revenda' }
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
      } else if (itemId === 'consolidadas') {
        const { currentProject } = checkAuth();
        if (currentProject) {
          const mainElement = document.querySelector('main');
          mainElement.innerHTML = '';
          mainElement.appendChild(ConsolidadasManager(currentProject));
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
      }
    });
  });
}
