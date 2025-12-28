export const DividasEmprestimosManager = () => {
    const container = document.createElement('div');
    container.className = 'manager-container';
    container.style.padding = '2rem';

    container.innerHTML = `
        <div class="glass-panel" style="padding: 3rem; text-align: center; max-width: 800px; margin: 0 auto;">
            <div style="font-size: 4rem; margin-bottom: 1.5rem;">🚧</div>
            
            <h2 style="margin: 0 0 1rem 0; color: var(--color-primary); font-size: 1.8rem;">
                Dívidas/Empréstimos
            </h2>
            
            <div style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <p style="margin: 0; color: #92400E; font-size: 1.1rem; font-weight: 500;">
                    ⚠️ Funcionalidade em Desenvolvimento
                </p>
            </div>
            
            <p style="color: var(--color-text-muted); line-height: 1.6; margin-bottom: 2rem;">
                Esta tela permitirá o gerenciamento completo de dívidas e empréstimos da empresa, incluindo:
            </p>
            
            <div style="text-align: left; max-width: 600px; margin: 0 auto; background: var(--color-surface); padding: 1.5rem; border-radius: 8px;">
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="padding: 0.75rem 0; border-bottom: 1px solid var(--color-border-light);">
                        <span style="margin-right: 0.5rem;">💰</span>
                        Controle de empréstimos tomados
                    </li>
                    <li style="padding: 0.75rem 0; border-bottom: 1px solid var(--color-border-light);">
                        <span style="margin-right: 0.5rem;">💸</span>
                        Gestão de dívidas com fornecedores
                    </li>
                    <li style="padding: 0.75rem 0; border-bottom: 1px solid var(--color-border-light);">
                        <span style="margin-right: 0.5rem;">📊</span>
                        Acompanhamento de parcelas e juros
                    </li>
                    <li style="padding: 0.75rem 0; border-bottom: 1px solid var(--color-border-light);">
                        <span style="margin-right: 0.5rem;">🔔</span>
                        Alertas de vencimento
                    </li>
                    <li style="padding: 0.75rem 0;">
                        <span style="margin-right: 0.5rem;">📈</span>
                        Relatórios de endividamento
                    </li>
                </ul>
            </div>
            
            <p style="margin-top: 2rem; color: var(--color-text-muted); font-size: 0.9rem;">
                Esta funcionalidade estará disponível em breve.
            </p>
        </div>
    `;

    return container;
};
