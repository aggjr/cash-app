export const Footer = () => {
  const currentProjectStr = localStorage.getItem('currentProject');
  let projectName = '';
  if (currentProjectStr) {
    try {
      const project = JSON.parse(currentProjectStr);
      projectName = project.name || '';
    } catch (e) {
      console.error('Error parsing currentProject', e);
    }
  }

  return `
    <footer style="padding: 0.5rem 1rem; border-top: 2px solid var(--color-border-light); display: flex; justify-content: space-between; align-items: center; color: var(--color-text-muted); font-size: 0.85rem; flex-shrink: 0; background: var(--color-bg-card); position: relative;">
      <p>&copy; 2025 <span class="notranslate" translate="no">CASH</span>. Todos os direitos reservados.</p>
      
      ${projectName ? `<div style="position: absolute; left: 50%; transform: translateX(-50%); font-weight: 600; color: var(--color-primary); font-size: 1.15rem;">Projeto Aberto: <span class="notranslate" translate="no">${projectName}</span></div>` : ''}

      <div style="display: flex; align-items: center;">
        <img src="/logo.png" alt="Company Logo" class="footer-logo logo-light" />
        <img src="/logo-dark.png" alt="Company Logo" class="footer-logo logo-dark" />
      </div>
    </footer>
  `;
}
