document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://127.0.0.1:5000';
    const areaSelect = document.getElementById('areaSelect');
    const elementSelect = document.getElementById('elementSelect');
    const monthSelect = document.getElementById('monthSelect');
    const updateBtn = document.getElementById('updateBtn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const errorModal = document.getElementById('errorModal');

    let charts = {};

    // Check Backend Connection
    fetch(`${API_BASE}/`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            console.log('Backend connected:', data);
            initApp();
        })
        .catch(error => {
            console.error('Backend connection failed:', error);
            errorModal.style.display = 'block';
        });

    function initApp() {
        // Initialize Tabs
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');
            });
        });

        // Fetch Options
        fetch(`${API_BASE}/api/options`)
            .then(res => res.json())
            .then(data => {
                populateSelect(areaSelect, data.areas);
                populateSelect(elementSelect, data.elements);
                populateSelect(monthSelect, data.months, 'All months');

                // Initial Load
                updateDashboard();
            });

        updateBtn.addEventListener('click', updateDashboard);
    }

    function populateSelect(select, options, defaultOption = null) {
        select.innerHTML = '';
        if (defaultOption) {
            const opt = document.createElement('option');
            opt.value = defaultOption;
            opt.textContent = defaultOption;
            select.appendChild(opt);
        }
        options.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            select.appendChild(opt);
        });
    }

    function updateDashboard() {
        const area = areaSelect.value;
        const element = elementSelect.value;
        const month = monthSelect.value;

        if (!area || !element) return;

        document.getElementById('currentArea').textContent = area;

        fetchForecast(area, element, month);
        fetchAnomalies(area, element);
        fetchSimilar(area, element);
    }

    function fetchForecast(area, element, month) {
        fetch(`${API_BASE}/api/data?area=${encodeURIComponent(area)}&element=${encodeURIComponent(element)}&month=${encodeURIComponent(month)}`)
            .then(res => res.json())
            .then(histData => {
                fetch(`${API_BASE}/api/forecast?area=${encodeURIComponent(area)}&element=${encodeURIComponent(element)}&month=${encodeURIComponent(month)}`)
                    .then(res => res.json())
                    .then(predData => {
                        renderForecastChart(histData, predData);
                        updateCards(histData, predData);
                    });
            });
    }

    function renderForecastChart(histData, predData) {
        const ctx = document.getElementById('forecastChart').getContext('2d');
        if (charts.forecast) charts.forecast.destroy();

        const labels = [...histData.years, ...predData.years];

        charts.forecast = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Historical Data',
                    data: histData.values,
                    borderColor: '#3498db',
                    fill: false
                }, {
                    label: 'Forecast',
                    data: [...new Array(histData.values.length).fill(null), ...predData.values],
                    borderColor: '#e74c3c',
                    borderDash: [5, 5],
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Temperature Change Forecast' }
                }
            }
        });
    }

    function updateCards(histData, predData) {
        const len = histData.values.length;
        if (len > 10) {
            const last10 = histData.values.slice(len - 10);
            const trend = (last10[9] - last10[0]) / 10;
            document.getElementById('trendValue').textContent = trend.toFixed(3) + " / year";
        }

        if (predData.values.length > 0) {
            document.getElementById('nextYearValue').textContent = predData.values[0].toFixed(3);
        }
    }

    function fetchAnomalies(area, element) {
        fetch(`${API_BASE}/api/anomalies?area=${encodeURIComponent(area)}&element=${encodeURIComponent(element)}`)
            .then(res => res.json())
            .then(data => {
                renderAnomalyChart(data);
                renderAnomalyList(data.anomalies);
            });
    }

    function renderAnomalyChart(data) {
        const ctx = document.getElementById('anomalyChart').getContext('2d');
        if (charts.anomaly) charts.anomaly.destroy();

        const pointBackgroundColors = data.actual.map((val, idx) => {
            const isAnomaly = data.anomalies.some(a => a.Year === data.years[idx] && a.Month === data.months[idx]);
            return isAnomaly ? 'red' : '#3498db';
        });

        const pointRadii = data.actual.map((val, idx) => {
            const isAnomaly = data.anomalies.some(a => a.Year === data.years[idx] && a.Month === data.months[idx]);
            return isAnomaly ? 6 : 3;
        });

        charts.anomaly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.years,
                datasets: [{
                    label: 'Actual Value',
                    data: data.actual,
                    borderColor: '#3498db',
                    pointBackgroundColor: pointBackgroundColors,
                    pointRadius: pointRadii,
                    fill: false
                }, {
                    label: 'Predicted (Baseline)',
                    data: data.predicted,
                    borderColor: '#95a5a6',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Anomaly Detection (Red points are anomalies)' }
                }
            }
        });
    }

    function renderAnomalyList(anomalies) {
        const list = document.getElementById('anomalyList');
        list.innerHTML = '';
        anomalies.slice(0, 10).forEach(a => {
            const li = document.createElement('li');
            li.textContent = `${a.Year} - ${a.Month}: Value ${a.Value}, Error ${a.Error.toFixed(3)}`;
            li.style.color = 'red';
            list.appendChild(li);
        });
    }

    function fetchSimilar(area, element) {
        fetch(`${API_BASE}/api/similar?area=${encodeURIComponent(area)}&element=${encodeURIComponent(element)}`)
            .then(res => res.json())
            .then(data => {
                const list = document.getElementById('similarList');
                list.innerHTML = '';
                data.similar_areas.forEach(area => {
                    const li = document.createElement('li');
                    li.textContent = area;
                    list.appendChild(li);
                });

                if (data.similar_areas.length > 0) {
                    compareSimilar(area, data.similar_areas[0], element);
                }
            });
    }

    function compareSimilar(currentArea, similarArea, element) {
        fetch(`${API_BASE}/api/data?area=${encodeURIComponent(similarArea)}&element=${encodeURIComponent(element)}&month=All months`)
            .then(res => res.json())
            .then(simData => {
                fetch(`${API_BASE}/api/data?area=${encodeURIComponent(currentArea)}&element=${encodeURIComponent(element)}&month=All months`)
                    .then(res => res.json())
                    .then(currData => {
                        renderSimilarityChart(currData, simData, currentArea, similarArea);
                    });
            });
    }

    function renderSimilarityChart(currData, simData, currLabel, simLabel) {
        const ctx = document.getElementById('similarityChart').getContext('2d');
        if (charts.similarity) charts.similarity.destroy();

        charts.similarity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: currData.years,
                datasets: [{
                    label: currLabel,
                    data: currData.values,
                    borderColor: '#3498db',
                    fill: false
                }, {
                    label: simLabel,
                    data: simData.values,
                    borderColor: '#2ecc71',
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: `Comparison: ${currLabel} vs ${simLabel}` }
                }
            }
        });
    }
});
