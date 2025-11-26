// URL ini ASUMSI file JSON diunggah di root repository GitHub Pages Anda
const MARKET_DATA_URL = './data/market.json'; 

async function fetchMarketData() {
    try {
        const response = await fetch(MARKET_DATA_URL + '?t=' + new Date().getTime()); // Hindari Cache
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        const priceElement = document.getElementById('market-status');
        
        // Tampilkan Data
        priceElement.innerHTML = `
            <div class="price">Rp ${data.current_price.toLocaleString()}</div>
            <div class="trend">${data.trend}</div>
            <small>Total Supply: ${data.total_supply.toLocaleString()} $ARA</small>
            <p>Terakhir update: ${new Date(data.timestamp).toLocaleTimeString()}</p>
        `;
        
        // Atur warna berdasarkan tren
        priceElement.querySelector('.price').style.color = data.trend.includes('NAIK') ? '#008000' : '#CC0000';

    } catch (e) {
        console.error("Gagal memuat data pasar:", e);
        document.getElementById('market-status').innerHTML = '<p style="color:red;">Server data offline atau file JSON tidak ditemukan.</p>';
    }
}

// Update setiap 10 detik (Walaupun file JSON diupdate lebih jarang, ini memastikan UI fresh)
setInterval(fetchMarketData, 10000); 
fetchMarketData(); // Panggil pertama kali