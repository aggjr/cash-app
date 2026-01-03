export const Features = () => {
  const features = [
    { title: 'Dashboard Inteligente', desc: 'Visualize suas métricas financeiras em tempo real.', icon: '📊' },
    { title: 'Relatórios Detalhados', desc: 'Gere relatórios completos e personalizados.', icon: '📈' },
    { title: 'Gestão de Fluxo', desc: 'Controle total do fluxo de caixa da empresa.', icon: '💵' }
  ];

  const featureCards = features.map(f => `
    <div class="glass-panel" style="padding: 1.25rem; transition: transform 0.3s ease, box-shadow 0.3s ease; cursor: default; border-left: 3px solid var(--color-primary);">
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">${f.icon}</div>
      <h3 style="font-size: 1.1rem; margin-bottom: 0.3rem; color: var(--color-text-dark); font-weight: 600;">${f.title}</h3>
      <p style="color: var(--color-text-medium); font-size: 0.85rem;">${f.desc}</p>
    </div>
  `).join('');

  return `
    <section style="padding: 1.5rem 0; flex-shrink: 0;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.25rem;">
        ${featureCards}
      </div>
    </section>
  `;
}
