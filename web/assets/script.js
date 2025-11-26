const DATA_SOURCE = './data/market.json'; 
let priceChart = null;

async function updateDashboard() {
    try {
        const res = await fetch(DATA_SOURCE + '?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();

        // 1. UPDATE HEADER & STATS
        const price = data.market.price;
        const trend = data.market.trend;
        
        const headerPrice = document.getElementById('header-price');
        const centerPrice = document.getElementById('current-price-mid');
        const colorClass = trend.includes('TURUN') ? 'text-red' : 'text-green';
        
        headerPrice.innerText = `Rp ${price.toLocaleString()}`;
        headerPrice.className = `price-ticker ${colorClass}`;
        
        centerPrice.innerText = price.toLocaleString();
        centerPrice.className = colorClass;

        document.getElementById('stat-trend').innerText = trend;
        document.getElementById('stat-trend').className = colorClass;
        document.getElementById('stat-high').innerText = data.market.high.toLocaleString();
        document.getElementById('stat-low').innerText = data.market.low.toLocaleString();
        document.getElementById('stat-vol').innerText = formatK(data.market.vol);

        // 2. RENDER ORDER BOOK
        renderOrderBook(data.orderBook);

        // 3. RENDER TRADES
        renderTrades(data.trades);

        // 4. UPDATE CHART
        updateChart(data.history);

    } catch (e) {
        console.log("Syncing...", e);
    }
}

function formatK(num) {
    return num > 1000 ? (num/1000).toFixed(1) + 'K' : num;
}

function renderOrderBook(book) {
    const asksEl = document.getElementById('asks-container');
    const bidsEl = document.getElementById('bids-container');
    
    // ASKS (Jual - Merah) - Urutan Terbalik (Termahal di atas)
    let asksHtml = '';
    book.asks.slice().reverse().forEach(item => {
        asksHtml += `
            <div class="order-row">
                <span class="text-red">${item.p.toLocaleString()}</span>
                <span class="text-white">${item.a}</span>
            </div>`;
    });
    asksEl.innerHTML = asksHtml;

    // BIDS (Beli - Hijau)
    let bidsHtml = '';
    book.bids.forEach(item => {
        bidsHtml += `
            <div class="order-row">
                <span class="text-green">${item.p.toLocaleString()}</span>
                <span class="text-white">${item.a}</span>
            </div>`;
    });
    bidsEl.innerHTML = bidsHtml;
}

function renderTrades(trades) {
    const container = document.getElementById('trades-container');
    let html = '';
    trades.forEach(t => {
        const color = t.type === 'BUY' ? 'text-green' : 'text-red';
        html += `
            <div class="order-row">
                <span class="${color}">${t.p.toLocaleString()}</span>
                <span class="text-white">${t.a}</span>
                <span style="color:#848e9c">${t.t}</span>
            </div>`;
    });
    container.innerHTML = html;
}

function updateChart(history) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    const labels = history.map(h => h.t);
    const prices = history.map(h => h.p);

    if (priceChart) {
        priceChart.data.labels = labels;
        priceChart.data.datasets[0].data = prices;
        priceChart.update('none'); // Update tanpa animasi biar gak kedip
    } else {
        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Price',
                    data: prices,
                    borderColor: '#F7BF64',
                    backgroundColor: 'rgba(247, 191, 100, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { 
                        position: 'right',
                        grid: { color: '#2b3139' },
                        ticks: { color: '#848e9c' }
                    }
                },
                animation: false
            }
        });
    }
}

// Polling tiap 2 detik
setInterval(updateDashboard, 2000);
updateDashboard();