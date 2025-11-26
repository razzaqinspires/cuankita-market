/**
 * SCRIPT PENGAMBIL DATA PASAR (ROBUST VERSION)
 * Mengambil data dari web/data/market.json secara realtime.
 */

// Path relatif terhadap file index.html
// Karena index.html ada di folder web/, dan data ada di web/data/
// Maka path yang benar adalah ./data/market.json
const DATA_SOURCE = "./data/market.json";

async function fetchMarketData() {
  const loadingState = document.getElementById("loading-state");
  const dataContent = document.getElementById("data-content");

  try {
    // Tambahkan timestamp agar browser tidak cache data lama
    const response = await fetch(DATA_SOURCE + "?t=" + new Date().getTime());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - File JSON belum di-push Bot.`);
    }

    const json = await response.json();

    // Sembunyikan loading, Tampilkan data
    loadingState.style.display = "none";
    dataContent.style.display = "block";

    // UPDATE UI
    const priceEl = document.getElementById("price-display");
    const trendEl = document.getElementById("trend-display");

    // Format Harga
    priceEl.innerText = `Rp ${json.market.price.toLocaleString("id-ID")}`;

    // Warna & Simbol Trend
    if (
      json.market.trend.includes("NAIK") ||
      json.market.trend.includes("MOON")
    ) {
      priceEl.className = "price trend-up";
      trendEl.className = "trend-up";
      trendEl.innerText = `📈 ${json.market.trend}`;
    } else if (
      json.market.trend.includes("TURUN") ||
      json.market.trend.includes("CRASH")
    ) {
      priceEl.className = "price trend-down";
      trendEl.className = "trend-down";
      trendEl.innerText = `📉 ${json.market.trend}`;
    } else {
      priceEl.className = "price";
      trendEl.style.color = "#7f8c8d";
      trendEl.innerText = `➖ ${json.market.trend}`;
    }

    // Statistik Lain
    document.getElementById("supply-display").innerText =
      json.market.supply.toLocaleString();
    document.getElementById("investor-display").innerText =
      json.stats.total_investors;

    // Format Waktu (Ambil jam menit detik saja)
    const dateObj = new Date(json.last_updated);
    document.getElementById("time-display").innerText =
      dateObj.toLocaleTimeString("id-ID");
  } catch (error) {
    console.error("Fetch Error:", error);
    loadingState.innerHTML = `
            <span style="color:red">⚠️ Data Offline</span><br>
            <small>${error.message}</small><br>
            <small>Menunggu Bot melakukan Auto-Push...</small>
        `;
  }
}

// Refresh setiap 5 detik
setInterval(fetchMarketData, 5000);
fetchMarketData(); // Jalankan segera saat load
