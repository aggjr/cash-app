export const Footer = () => {
  const currentProjectStr = localStorage.getItem('currentProject');
  const userStr = localStorage.getItem('user');

  let projectName = '';
  let userName = '';
  let userRole = '';

  if (currentProjectStr) {
    try {
      const project = JSON.parse(currentProjectStr);
      projectName = project.name || '';
      userRole = project.role || '';
    } catch (e) {
      console.error('Error parsing currentProject', e);
    }
  }

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      userName = user.name || '';
    } catch (e) {
      console.error('Error parsing user', e);
    }
  }

  return `
    <footer style="padding: 0.5rem 1rem; border-top: 2px solid var(--color-border-light); display: flex; justify-content: space-between; align-items: center; color: var(--color-text-muted); font-size: 0.85rem; flex-shrink: 0; background: var(--color-bg-card); position: relative;">
      <p>&copy; 2025 <span class="notranslate" translate="no">CASH</span>. Todos os direitos reservados.</p>
      
      ${projectName ? `<div style="position: absolute; left: 50%; transform: translateX(-50%); font-weight: 600; color: var(--color-primary);"><span style="font-size: 0.95rem;">Projeto Aberto: </span><span class="notranslate" translate="no" style="font-size: 1.35rem;">${projectName}</span><span style="font-size: 0.90rem;"> / ${userName}</span><span style="font-size: 0.85rem; opacity: 0.8;"> (${userRole.toUpperCase()})</span></div>` : ''}

      <div style="display: flex; align-items: center;">
        <img src="/logo.png" alt="Company Logo" class="footer-logo logo-light" />
        <img src="/logo-dark.png" alt="Company Logo" class="footer-logo logo-dark" />
      </div>
    </footer>
  `;
}
