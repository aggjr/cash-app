import { getApiBaseUrl } from '../utils/apiConfig.js';

export const IvaAnalytics = () => {
  const API_BASE_URL = getApiBaseUrl();

  const container = document.createElement('div');
  container.className = 'iva-analytics-container';
  container.innerHTML = `
    <div class="page-header">
      <h1>📊 Analytics da IVA</h1>
      <p>Monitoramento de uso e custo da LLM</p>
    </div>

    <div class="analytics-filters">
      <select id="period-filter" class="form-control">
        <option value="today">Hoje</option>
        <option value="week">Última Semana</option>
        <option value="month" selected>Último Mês</option>
        <option value="year">Último Ano</option>
      </select>
    </div>

    <div class="analytics-summary">
      <div class="summary-card">
        <div class="card-icon">💰</div>
        <div class="card-content">
          <div class="card-label">Custo Total</div>
          <div class="card-value" id="total-cost">$0.00</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon">🔢</div>
        <div class="card-content">
          <div class="card-label">Interações</div>
          <div class="card-value" id="total-interactions">0</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon">📈</div>
        <div class="card-content">
          <div class="card-label">Custo Médio</div>
          <div class="card-value" id="avg-cost">$0.00</div>
        </div>
      </div>

      <div class="summary-card">
        <div class="card-icon">💡</div>
        <div class="card-content">
          <div class="card-label">Economia</div>
          <div class="card-value" id="savings">0%</div>
        </div>
      </div>
    </div>

    <div class="analytics-charts">
      <div class="chart-container">
        <h3>Evolução de Custo</h3>
        <canvas id="cost-chart"></canvas>
      </div>

      <div class="chart-container">
        <h3>Custo por Tipo</h3>
        <canvas id="type-chart"></canvas>
      </div>
    </div>

    <div class="analytics-tables">
      <div class="table-container">
        <h3>👥 Custo por Usuário</h3>
        <div id="user-table"></div>
      </div>

      <div class="table-container">
        <h3>🔮 Projeções</h3>
        <div id="projections"></div>
      </div>
    </div>
  `;

  // Load Chart.js if not already loaded
  if (!window.Chart) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = () => initAnalytics();
    document.head.appendChild(script);
  } else {
    setTimeout(initAnalytics, 100);
  }

  function initAnalytics() {
    loadAnalytics('month');

    // Period filter
    container.querySelector('#period-filter').addEventListener('change', (e) => {
      loadAnalytics(e.target.value);
    });
  }

  async function loadAnalytics(period) {
    try {
      const projectId = localStorage.getItem('selectedProjectId');

      const response = await fetch(`${API_BASE_URL}/IVA/analytics?period=${period}&project_id=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      updateSummary(data);
      updateCharts(data);
      await loadUserTable(projectId, period);
      updateProjections(data);

    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }

  function updateSummary(data) {
    const total = data.total || {};

    container.querySelector('#total-cost').textContent = `$${(total.total_cost || 0).toFixed(4)}`;
    container.querySelector('#total-interactions').textContent = total.total_interactions || 0;
    container.querySelector('#avg-cost').textContent = `$${(total.avg_cost || 0).toFixed(6)}`;
    container.querySelector('#savings').textContent = data.knowledge_impact?.savings || '0%';
  }

  function updateCharts(data) {
    // Cost evolution chart
    const costCtx = container.querySelector('#cost-chart').getContext('2d');

    if (window.costChart) window.costChart.destroy();

    window.costChart = new Chart(costCtx, {
      type: 'line',
      data: {
        labels: data.breakdown.by_day.map(d => new Date(d.date).toLocaleDateString('pt-BR')),
        datasets: [{
          label: 'Custo Diário',
          data: data.breakdown.by_day.map(d => d.cost),
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => `$${value.toFixed(4)}`
            }
          }
        }
      }
    });

    // Type chart
    const typeCtx = container.querySelector('#type-chart').getContext('2d');

    if (window.typeChart) window.typeChart.destroy();

    window.typeChart = new Chart(typeCtx, {
      type: 'doughnut',
      data: {
        labels: data.breakdown.by_type.map(t => t.interaction_type),
        datasets: [{
          data: data.breakdown.by_type.map(t => t.cost),
          backgroundColor: ['#4CAF50', '#2196F3', '#FF9800']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  async function loadUserTable(projectId, period) {
    try {
      const response = await fetch(`${API_BASE_URL}/IVA/analytics/by-user/${projectId}?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const users = await response.json();

      const tableHtml = `
        <table class="analytics-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Interações</th>
              <th>Tokens</th>
              <th>Custo</th>
              <th>Média</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>${u.user_name}</td>
                <td>${u.interactions}</td>
                <td>${u.total_tokens.toLocaleString()}</td>
                <td>$${u.total_cost.toFixed(4)}</td>
                <td>$${u.avg_cost_per_interaction.toFixed(6)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.querySelector('#user-table').innerHTML = tableHtml;

    } catch (error) {
      console.error('Error loading user table:', error);
    }
  }

  function updateProjections(data) {
    const proj = data.projections || {};

    const html = `
      <div class="projections-list">
        <div class="projection-item">
          <span class="projection-label">Média Diária:</span>
          <span class="projection-value">$${(proj.daily_avg || 0).toFixed(4)}</span>
        </div>
        <div class="projection-item">
          <span class="projection-label">Estimativa Mensal:</span>
          <span class="projection-value">$${(proj.month_estimate || 0).toFixed(2)}</span>
        </div>
        <div class="projection-item">
          <span class="projection-label">Estimativa Anual:</span>
          <span class="projection-value">$${(proj.year_estimate || 0).toFixed(2)}</span>
        </div>
      </div>
    `;

    container.querySelector('#projections').innerHTML = html;
  }

  return container;
};
