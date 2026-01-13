
import * as echarts from 'echarts';
import { getApiBaseUrl } from '../utils/apiConfig.js';
import { showToast } from '../utils/toast.js';

export const GraficosIndicadoresManager = (project, viewMode = 'overview') => {
    const container = document.createElement('div');
    container.className = 'glass-panel animate-fade-in';
    container.style.padding = '2rem';
    container.style.margin = '2rem';
    container.style.height = 'calc(100vh - 150px)';
    container.style.overflowY = 'auto';

    // Titles based on viewMode
    const titles = {
        'overview': { title: '📊 Visão Geral & Dispersão', desc: 'Análise de fluxo e correlações financeiras.' },
        'statistical': { title: '📐 Controle Estatístico (XmR)', desc: 'Monitoramento de estabilidade e desvios padrão.' },
        'abc': { title: '🏆 Curva ABC (Pareto)', desc: 'Classificação de relevância de produtos/serviços.' }
    };
    const currentInfo = titles[viewMode] || titles['overview'];

    // Header
    const header = document.createElement('div');
    header.style.marginBottom = '2rem';
    header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h2 style="color: var(--color-primary); margin-bottom: 0.5rem;">${currentInfo.title}</h2>
                <p style="color: var(--color-text-muted);">${currentInfo.desc}</p>
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

    // Helper Card
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
            <div id="${id}" style="width: 100%; height: 400px;"></div>
        `;
        return card;
    };

    // --- RENDER LOGIC BASED ON VIEW MODE ---
    const initReview = () => {
        if (viewMode === 'overview') {
            // Screen 1: Overview + Scatter
            const card1 = createChartCard('Fluxo de Caixa (Receita vs Despesa)', 'chart-overview-main');
            card1.style.gridColumn = '1 / -1';
            grid.appendChild(card1);

            const card2 = createChartCard('Correlação: Receita x Margem (Dispersão)', 'chart-scatter');
            card2.style.gridColumn = '1 / -1';
            grid.appendChild(card2);

            setTimeout(() => {
                // Chart 1: Fluxo
                const chart1 = echarts.init(document.getElementById('chart-overview-main'));
                chart1.setOption({
                    tooltip: { trigger: 'axis' },
                    legend: { data: ['Receitas', 'Despesas', 'Saldo'] },
                    xAxis: { type: 'category', data: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'] },
                    yAxis: { type: 'value' },
                    series: [
                        { name: 'Receitas', type: 'bar', itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] }, data: [120, 150, 180, 220, 250, 300] },
                        { name: 'Despesas', type: 'bar', itemStyle: { color: '#EF4444', borderRadius: [4, 4, 0, 0] }, data: [100, 130, 150, 180, 200, 240] },
                        { name: 'Saldo', type: 'line', smooth: true, itemStyle: { color: '#00425F' }, data: [20, 20, 30, 40, 50, 60] }
                    ]
                });

                // Chart 2: Scatter (Pontos)
                const chart2 = echarts.init(document.getElementById('chart-scatter'));
                // Mock Random Scatter Data
                const scatterData = Array.from({ length: 50 }, () => [
                    Math.floor(Math.random() * 5000) + 1000, // Sales Volume
                    Math.floor(Math.random() * 40) + 10      // Margin %
                ]);
                chart2.setOption({
                    tooltip: {
                        trigger: 'item',
                        formatter: (params) => `Venda: R$ ${params.data[0]}<br>Margem: ${params.data[1]}%`
                    },
                    xAxis: { name: 'Volume de Vendas', type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
                    yAxis: { name: 'Margem (%)', type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
                    series: [{
                        symbolSize: 10,
                        data: scatterData,
                        type: 'scatter',
                        itemStyle: {
                            color: (params) => params.data[1] > 30 ? '#10B981' : (params.data[1] < 20 ? '#EF4444' : '#F59E0B'),
                            shadowBlur: 10,
                            shadowColor: 'rgba(0,0,0,0.2)'
                        }
                    }]
                });
                window.addEventListener('resize', () => { chart1.resize(); chart2.resize(); });
            }, 100);

        } else if (viewMode === 'statistical') {
            // Screen 2: XmR Charts
            const cardX = createChartCard('Carta de Controle (X - Valores Individuais)', 'chart-x');
            cardX.style.gridColumn = '1 / -1';
            grid.appendChild(cardX);

            const cardMR = createChartCard('Amplitude Móvel (mR)', 'chart-mr');
            cardMR.style.gridColumn = '1 / -1';
            grid.appendChild(cardMR);

            setTimeout(() => {
                // Mock Process Data (Random Walk)
                const data = [];
                let val = 100;
                for (let i = 0; i < 30; i++) {
                    val += (Math.random() - 0.5) * 20;
                    data.push(val);
                }
                const mean = data.reduce((a, b) => a + b, 0) / data.length;
                const std = Math.sqrt(data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / data.length);
                const ucl = mean + 3 * std;
                const lcl = mean - 3 * std;

                // X Chart
                const chartX = echarts.init(document.getElementById('chart-x'));
                chartX.setOption({
                    tooltip: { trigger: 'axis' },
                    visualMap: {
                        show: false,
                        dimension: 1,
                        pieces: [
                            { gt: ucl, color: '#EF4444' }, // Out of control Upper
                            { lt: lcl, color: '#EF4444' }, // Out of control Lower
                            { gt: lcl, lt: ucl, color: '#00425F' } // Normal
                        ]
                    },
                    xAxis: { type: 'category', data: Array.from({ length: 30 }, (_, i) => `D${i + 1}`) },
                    yAxis: { type: 'value', scale: true },
                    series: [
                        {
                            name: 'Valor', type: 'line', data: data, markLine: {
                                data: [
                                    { yAxis: mean, name: 'Média' },
                                    { yAxis: ucl, name: 'LSC (+3σ)', lineStyle: { color: '#EF4444', type: 'dashed' } },
                                    { yAxis: lcl, name: 'LIC (-3σ)', lineStyle: { color: '#EF4444', type: 'dashed' } }
                                ]
                            }
                        }
                    ]
                });
                window.addEventListener('resize', () => { chartX.resize(); });
            }, 100);

        } else if (viewMode === 'abc') {
            // Screen 3: ABC / Pareto
            const cardABC = createChartCard('Curva ABC de Produtos (Vendas Acumuladas)', 'chart-abc');
            cardABC.style.gridColumn = '1 / -1';
            grid.appendChild(cardABC);

            setTimeout(() => {
                // Mock Data: Products
                const rawData = [
                    { name: 'Consultoria Premium', value: 50000 },
                    { name: 'Implementação ERP', value: 30000 },
                    { name: 'Treinamento Equipe', value: 15000 },
                    { name: 'Suporte Mensal', value: 8000 },
                    { name: 'App Mobile', value: 5000 },
                    { name: 'Auditoria', value: 3000 },
                    { name: 'Hospedagem', value: 2000 },
                    { name: 'Backup Cloud', value: 1000 },
                    { name: 'Domínio', value: 500 },
                    { name: 'Email Mkt', value: 200 }
                ];

                // Calculate Pareto
                const total = rawData.reduce((a, b) => a + b.value, 0);
                let accum = 0;
                const processed = rawData.map(item => {
                    accum += item.value;
                    const pct = (accum / total) * 100;
                    // Classify
                    let grade = 'C';
                    if (pct <= 80) grade = 'A';
                    else if (pct <= 95) grade = 'B';

                    return { ...item, pct, grade };
                });

                const chartABC = echarts.init(document.getElementById('chart-abc'));
                chartABC.setOption({
                    tooltip: {
                        trigger: 'axis',
                        axisPointer: { type: 'cross' }
                    },
                    legend: { data: ['Valor Venda', '% Acumulado'] },
                    xAxis: { type: 'category', data: processed.map(i => i.name), axisLabel: { rotate: 45 } },
                    yAxis: [
                        { type: 'value', name: 'Valor (R$)', position: 'left' },
                        { type: 'value', name: '% Acumulado', min: 0, max: 100, position: 'right', axisLabel: { formatter: '{value}%' } }
                    ],
                    series: [
                        {
                            name: 'Valor Venda',
                            type: 'bar',
                            data: processed.map(i => ({
                                value: i.value,
                                itemStyle: {
                                    color: i.grade === 'A' ? '#10B981' : (i.grade === 'B' ? '#F59E0B' : '#6B7280')
                                }
                            }))
                        },
                        {
                            name: '% Acumulado',
                            type: 'line',
                            yAxisIndex: 1,
                            smooth: true,
                            itemStyle: { color: '#00425F' },
                            lineStyle: { width: 3 },
                            data: processed.map(i => i.pct)
                        }
                    ]
                });
                window.addEventListener('resize', () => chartABC.resize());
            }, 100);
        }
    };

    initReview();

    return container;
};
