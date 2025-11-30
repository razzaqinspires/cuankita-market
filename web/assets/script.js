/**
 * CUANKITA PRO TERMINAL LOGIC
 * Connects Frontend Dashboard to Bot's Data Stream
 */

const API_URL = './data/market.json';
let chartInstance = null;

// Fungsi utama untuk mengambil data loop
async function fetchData() {
    try {
        // Tambahkan timestamp (?t=...) agar browser tidak menggunakan cache lama
        const res = await fetch(API_URL + '?t=' + Date.now());
        
        if(!res.ok) {
            console.warn("Market data not ready...");
            return;
        }
        
        const data = await res.json();
        render(data);
        
    } catch(e) { 
        console.log("Connecting to data feed...", e); 
    }
}

// Fungsi Rendering Utama
function render(data) {
    const market = data.market;
    
    // 1. HEADER & MARKET STATS
    // ==========================================
    
    // News Ticker
    const newsText = `📢 NEWS: ${market.news.headline} (${market.news.type})  ///  VOLUME 24H: ${market.vol.toLocaleString()} ARA  ///  MARKET CAP: Rp ${(market.mcap/1000000000).toFixed(2)} BILLION`;
    document.getElementById('news-content').innerText = newsText;
    
    // Price & Change
    const priceEl = document.getElementById('p-last');
    priceEl.innerText = `Rp ${market.price.toLocaleString()}`;
    
    // Warna Trend (Hijau/Merah)
    const isBullish = market.trend.includes('NAIK') || market.trend.includes('BULLISH') || market.trend.includes('PUMP');
    const colorClass = isBullish ? 'text-green' : 'text-red';
    
    // Update Warna Indikator Header
    document.getElementById('header-price').innerText = `Rp ${market.price.toLocaleString()}`;
    document.getElementById('header-price').className = isBullish ? 'text-green' : 'text-red';

    // Stat Boxes
    const trendEl = document.getElementById('p-change');
    trendEl.innerText = market.trend;
    trendEl.className = `stat-val ${colorClass}`;

    document.getElementById('p-high').innerText = `Rp ${market.high.toLocaleString()}`;
    document.getElementById('p-low').innerText = `Rp ${market.low.toLocaleString()}`;
    document.getElementById('p-mcap').innerText = `Rp ${(market.mcap/1000000).toFixed(0)}M`;

    // 2. ORDER BOOK (WITH DEPTH BARS)
    // ==========================================
    
    // Cari volume terbesar untuk menghitung persentase lebar batang warna
    const maxVolAsks = Math.max(...data.orderBook.asks.map(o => o.a));
    const maxVolBids = Math.max(...data.orderBook.bids.map(o => o.a));
    const maxVol = Math.max(maxVolAsks, maxVolBids, 1); // Hindari division by zero

    // RENDER ASKS (JUAL - MERAH) - Urutan Terbalik (Harga tertinggi di atas)
    const asksHtml = data.orderBook.asks.slice().reverse().map(o => {
        const width = (o.a / maxVol) * 100;
        return `
        <div class="book-row">
            <div class="depth-bar bar-red" style="width:${width}%"></div>
            <div class="row-data">
                <span class="text-red">${o.p.toLocaleString()}</span>
                <span style="color:#e0e0e0">${o.a.toLocaleString()}</span>
            </div>
        </div>`;
    }).join('');
    document.getElementById('asks').innerHTML = asksHtml;

    // CENTER SPREAD PRICE
    const spreadEl = document.getElementById('spread');
    spreadEl.innerText = market.price.toLocaleString();
    spreadEl.className = `spread-box ${colorClass}`;

    // RENDER BIDS (BELI - HIJAU)
    const bidsHtml = data.orderBook.bids.map(o => {
        const width = (o.a / maxVol) * 100;
        return `
        <div class="book-row">
            <div class="depth-bar bar-green" style="width:${width}%"></div>
            <div class="row-data">
                <span class="text-green">${o.p.toLocaleString()}</span>
                <span style="color:#e0e0e0">${o.a.toLocaleString()}</span>
            </div>
        </div>`;
    }).join('');
    document.getElementById('bids').innerHTML = bidsHtml;

    // 3. RECENT TRADES
    // ==========================================
    const tradesHtml = data.trades.map(t => {
        const col = t.type === 'BUY' ? 'text-green' : 'text-red';
        return `
        <div class="row" style="padding:4px 10px; border-bottom:1px solid #1a1a1a;">
            <span class="${col}">${t.p.toLocaleString()}</span>
            <span style="color:#ddd">${t.a.toLocaleString()}</span>
            <span style="color:#666">${t.t}</span>
        </div>`;
    }).join('');
    document.getElementById('trades').innerHTML = tradesHtml;

    // 4. LEADERBOARD (SULTAN LIST)
    // ==========================================
    if (data.leaderboard && data.leaderboard.length > 0) {
        const lbHtml = data.leaderboard.map((u, i) => {
            let rankStyle = 'color:#666';
            if (i === 0) rankStyle = 'color:#FFD700; font-weight:bold; font-size:14px;'; // Gold
            if (i === 1) rankStyle = 'color:#C0C0C0; font-weight:bold;'; // Silver
            if (i === 2) rankStyle = 'color:#CD7F32; font-weight:bold;'; // Bronze

            return `
            <div class="row" style="padding:8px 10px; border-bottom:1px solid #222;">
                <span>
                    <span style="${rankStyle}">#${i+1}</span> 
                    <span style="color:#eee; margin-left:8px;">${u.name}</span>
                </span>
                <span class="text-green" style="font-weight:600;">Rp ${(u.wealth/1000000).toFixed(1)}M</span>
            </div>`;
        }).join('');
        document.getElementById('leaderboard').innerHTML = lbHtml;
    } else {
        document.getElementById('leaderboard').innerHTML = '<div style="padding:20px; text-align:center; color:#555;">No Data Available</div>';
    }

    // 5. CHART JS UPDATE
    // ==========================================
    updateChart(data.history);
}

// Fungsi Menggambar Chart
function updateChart(history) {
    if (!history || history.length === 0) return;

    const ctx = document.getElementById('chart').getContext('2d');
    const labels = history.map(h => h.t);
    const prices = history.map(h => h.p);
    
    // Tentukan warna chart berdasarkan pergerakan (Awal vs Akhir)
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const isUp = endPrice >= startPrice;
    const lineColor = isUp ? '#00E396' : '#FF4560'; // Green or Red

    if (chartInstance) {
        // UPDATE DATA (Tanpa membuat chart baru agar hemat memori)
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = prices;
        chartInstance.data.datasets[0].borderColor = lineColor;
        chartInstance.data.datasets[0].backgroundColor = createGradient(ctx, lineColor);
        chartInstance.update('none'); // Mode 'none' untuk performa tinggi (kurangi animasi berat)
    } else {
        // INISIALISASI CHART BARU
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Price',
                    data: prices,
                    borderColor: lineColor,
                    backgroundColor: createGradient(ctx, lineColor),
                    borderWidth: 2,
                    pointRadius: 0, // Hilangkan titik agar terlihat seperti garis mulus
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.2 // Kelengkungan garis
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#888',
                        bodyFont: { family: 'JetBrains Mono' }
                    }
                },
                scales: {
                    x: { 
                        display: false // Sembunyikan label waktu di bawah agar bersih
                    },
                    y: { 
                        position: 'right', 
                        grid: { color: '#222' }, 
                        ticks: { 
                            color: '#666',
                            font: { family: 'JetBrains Mono', size: 10 }
                        } 
                    }
                },
                animation: false, // Matikan animasi load awal agar cepat
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }
}

// Helper Gradient Chart
function createGradient(ctx, color) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color + '44'); // Opacity 0.27 (Hex 44)
    gradient.addColorStop(1, color + '00'); // Transparent
    return gradient;
}

// Jalankan Loop
// Refresh setiap 2 detik (2000ms) agar terasa realtime
setInterval(fetchData, 2000);

// Panggilan pertama
fetchData();