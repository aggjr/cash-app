export const Header = () => {
  return `
    <header style="background: var(--color-bg-card); border-bottom: 2px solid var(--color-primary); padding: 0.75rem 2rem; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; box-shadow: var(--shadow-sm);">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 32px; height: 32px; background: var(--color-primary); border-radius: 8px;"></div>
        <h1 style="font-size: 1.25rem; font-weight: 700; letter-spacing: -0.5px; color: var(--color-text-dark);">Luminous</h1>
      </div>
      <nav class="desktop-nav">
        <ul style="display: flex; gap: 1.5rem; list-style: none;">
          <li><a href="#" style="font-weight: 500; transition: color 0.2s; font-size: 0.9rem; color: var(--color-text-medium);">Features</a></li>
          <li><a href="#" style="font-weight: 500; transition: color 0.2s; font-size: 0.9rem; color: var(--color-text-medium);">Showcase</a></li>
          <li><a href="#" style="font-weight: 500; transition: color 0.2s; font-size: 0.9rem; color: var(--color-text-medium);">Pricing</a></li>
        </ul>
      </nav>
      <button class="btn-primary" style="padding: 0.5rem 1.25rem; font-size: 0.85rem;">Get Access</button>
    </header>
  `;
}
