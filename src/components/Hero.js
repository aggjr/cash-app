export const Hero = () => {
  return `
    <section style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 0; padding: 2rem;">
      
      <img src="/logo.png" alt="Company Logo" class="hero-logo logo-light" style="margin-bottom: 2rem; max-width: 250px;" />
      <img src="/logo-dark.png" alt="Company Logo" class="hero-logo logo-dark" style="margin-bottom: 2rem; max-width: 250px;" />
      
      <h1 class="text-gradient" style="font-size: 3.5rem; line-height: 1.2; margin-bottom: 1.5rem; font-weight: 800; letter-spacing: -1px;">
        Controle e Planeje as <br> Finanças de suas Empresas
      </h1>
      
      <p style="font-size: 1.2rem; color: var(--color-text-medium); max-width: 600px; line-height: 1.6;">
        Gerencie suas finanças empresariais com eficiência e precisão. Dashboards intuitivos, relatórios detalhados e controle completo.
      </p>
    </section>
  `;
}
