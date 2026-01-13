
import * as echarts from 'echarts';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { showToast } from '../utils/toast.js';

export const GraficosIndicadoresManager = (project) => {
    const container = document.createElement('div');
    container.className = 'glass-panel animate-fade-in';
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.height = 'calc(100vh - 150px)';
    container.style.overflowY = 'auto'; // Allow scrolling if dashboard is tall

    // Header
    const header = document.createElement('div');
    header.style.marginBottom = '2rem';
    header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h2 style="color: var(--color-primary); margin-bottom: 0.5rem;">📊 Gráficos e Indicadores</h2>
                <p style="color: var(--color-text-muted);">Análise visual avançada do fluxo de caixa e performance financeira.</p>
            </div>
            <div style="display: flex; gap: 1rem;">
                <select id="grafico-periodo" class="form-input" style="width: 150px;">
                    <option value="30">Últimos 30 dias</option>
                    <option value="90">Últimos 3 meses</option>
                    <option value="180">Últimos 6 meses</option>
                    <option value="365" selected>Este Ano</option>
                </select>
            </div>
        </div>
    `;
    container.appendChild(header);

    // Dashboard Grid
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    grid.style.gap = '1.5rem';
    grid.style.marginBottom = '2rem';
    container.appendChild(grid);

    // Helper to create chart cards
    const createChartCard = (title, id) => {
        const card = document.createElement('div');
        card.style.backgroundColor = 'white';
        card.style.borderRadius = '12px';
        card.style.padding = '1.5rem';
        card.style.boxShadow = 'var(--shadow-sm)';
        card.style.border = '1px solid var(--color-border-light)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="font-size: 1.1rem; color: #374151; font-weight: 600;">${title}</h3>
                <button class="btn-icon" title="Expandir">⤢</button>
            </div>
            <div id="${id}" style="width: 100%; height: 350px;"></div>
        `;
        return card;
    };

    // Card 1: Fluxo de Caixa (Line + Bar)
    const cardCashFlow = createChartCard('Fluxo de Caixa (Receita vs Despesa)', 'chart-cashflow');
    cardCashFlow.style.gridColumn = '1 / -1'; // Full width
    grid.appendChild(cardCashFlow);

    // Card 2: Composição de Despesas (Pie)
    const cardExpenses = createChartCard('Composição de Despesas', 'chart-expenses');
    grid.appendChild(cardExpenses);

    // Card 3: Saldo Acumulado (Area)
    const cardBalance = createChartCard('Evolução do Saldo', 'chart-balance');
    grid.appendChild(cardBalance);

    // Init Charts Function
    const initCharts = () => {
        // --- Chart 1: Fluxo de Caixa ---
        const domCashFlow = document.getElementById('chart-cashflow');
        if (domCashFlow) {
            const chart = echarts.init(domCashFlow);
            const option = {
                tooltip: {
                    trigger: 'axis',
                    axisPointer: { type: 'shadow' }
                },
                legend: { data: ['Receitas', 'Despesas', 'Saldo Líquido'] },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: {
                    type: 'category',
                    data: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                },
                yAxis: { type: 'value' },
                series: [
                    {
                        name: 'Receitas',
                        type: 'bar',
                        itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] },
                        data: [12000, 15000, 18000, 14000, 22000, 25000, 28000, 24000, 26000, 30000, 35000, 40000]
                    },
                    {
                        name: 'Despesas',
                        type: 'bar',
                        itemStyle: { color: '#EF4444', borderRadius: [4, 4, 0, 0] },
                        data: [10000, 11000, 13000, 12000, 15000, 16000, 18000, 17000, 19000, 20000, 22000, 25000]
                    },
                    {
                        name: 'Saldo Líquido',
                        type: 'line',
                        smooth: true,
                        itemStyle: { color: '#00425F' },
                        lineStyle: { width: 3 },
                        data: [2000, 4000, 5000, 2000, 7000, 9000, 10000, 7000, 7000, 10000, 13000, 15000]
                    }
                ]
            };
            chart.setOption(option);

            // Resize handle
            window.addEventListener('resize', () => chart.resize());
        }

        // --- Chart 2: Despesas (Pie) ---
        const domExpenses = document.getElementById('chart-expenses');
        if (domExpenses) {
            const chart = echarts.init(domExpenses);
            const option = {
                tooltip: { trigger: 'item' },
                legend: { orient: 'vertical', left: 'left' },
                series: [
                    {
                        name: 'Despesas',
                        type: 'pie',
                        radius: ['40%', '70%'],
                        avoidLabelOverlap: false,
                        itemStyle: {
                            borderRadius: 10,
                            borderColor: '#fff',
                            borderWidth: 2
                        },
                        label: { show: false, position: 'center' },
                        emphasis: {
                            label: { show: true, fontSize: 20, fontWeight: 'bold' }
                        },
                        labelLine: { show: false },
                        data: [
                            { value: 1048, name: 'Pessoal' },
                            { value: 735, name: 'Infraestrutura' },
                            { value: 580, name: 'Marketing' },
                            { value: 484, name: 'Impostos' },
                            { value: 300, name: 'Outros' }
                        ]
                    }
                ]
            };
            chart.setOption(option);
            window.addEventListener('resize', () => chart.resize());
        }

        // --- Chart 3: Saldo (Area) ---
        const domBalance = document.getElementById('chart-balance');
        if (domBalance) {
            const chart = echarts.init(domBalance);
            const option = {
                color: ['#0077B6'],
                tooltip: {
                    trigger: 'axis',
                    axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } }
                },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: [
                    {
                        type: 'category',
                        boundaryGap: false,
                        data: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
                    }
                ],
                yAxis: [{ type: 'value' }],
                series: [
                    {
                        name: 'Saldo',
                        type: 'line',
                        stack: 'Total',
                        smooth: true,
                        lineStyle: { width: 0 },
                        showSymbol: false,
                        areaStyle: {
                            opacity: 0.8,
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: 'rgb(0, 66, 95)' },
                                { offset: 1, color: 'rgb(135, 206, 235)' }
                            ])
                        },
                        emphasis: { focus: 'series' },
                        data: [120, 132, 101, 134, 90, 230, 210]
                    }
                ]
            };
            chart.setOption(option);
            window.addEventListener('resize', () => chart.resize());
        }
    };

    // Slight delay to allow DOM to render
    setTimeout(initCharts, 100);

    return container;
};
