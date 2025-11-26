const fs = require("fs");
const path = require("path");
const db = require("../database/core");
const simpleGit = require("simple-git");

const ROOT_DIR = path.resolve(__dirname, "../../");
const WEB_DIR = path.join(ROOT_DIR, "web");
const WEB_DATA_DIR = path.join(WEB_DIR, "data");
const JSON_OUTPUT = path.join(WEB_DATA_DIR, "market.json");

const git = simpleGit(ROOT_DIR);

if (!fs.existsSync(WEB_DATA_DIR))
  fs.mkdirSync(WEB_DATA_DIR, { recursive: true });

// --- SIMULASI ORDER BOOK (Agar terlihat seperti pasar asli) ---
function generateOrderBook(currentPrice) {
  const bids = [];
  const asks = [];

  // Generate 5 antrian Beli (Bids) - Harga di bawah current
  for (let i = 0; i < 5; i++) {
    const price = Math.floor(currentPrice * (1 - 0.001 * (i + 1)));
    const amount = Math.floor(Math.random() * 1000) + 10;
    bids.push({ p: price, a: amount });
  }

  // Generate 5 antrian Jual (Asks) - Harga di atas current
  for (let i = 0; i < 5; i++) {
    const price = Math.floor(currentPrice * (1 + 0.001 * (i + 1)));
    const amount = Math.floor(Math.random() * 1000) + 10;
    asks.push({ p: price, a: amount });
  }

  return { bids, asks };
}

function exportToJSON() {
  try {
    const market = db.load("market_data");
    const users = db.load("users");
    const totalInvestors = Object.keys(users).length;
    const currentPrice = market.current_price || 1000;
    const timestamp = Date.now();
    const timeString = new Date().toLocaleTimeString("id-ID");

    // --- HISTORY CHART LOGIC ---
    let existingData = { history: [], trades: [] };
    if (fs.existsSync(JSON_OUTPUT)) {
      try {
        existingData = JSON.parse(fs.readFileSync(JSON_OUTPUT, "utf-8"));
      } catch (e) {}
    }

    // 1. Update Chart History
    let history = existingData.history || [];
    // Hanya push jika harga berubah atau setiap 5 cycle biar chart ga terlalu rapat
    if (
      history.length === 0 ||
      history[history.length - 1].p !== currentPrice ||
      Math.random() > 0.7
    ) {
      history.push({ t: timeString, p: currentPrice });
    }
    if (history.length > 50) history = history.slice(history.length - 50); // Simpan 50 titik

    // 2. Update Recent Trades (Simulasi transaksi terjadi)
    let trades = existingData.trades || [];
    // Randomly add trade
    if (Math.random() > 0.3) {
      const type = Math.random() > 0.5 ? "BUY" : "SELL";
      const amount = Math.floor(Math.random() * 500) + 10;
      trades.unshift({ t: timeString, type, p: currentPrice, a: amount });
    }
    if (trades.length > 10) trades = trades.slice(0, 10); // Simpan 10 trade terakhir

    // 3. Generate Order Book
    const orderBook = generateOrderBook(currentPrice);

    const publicData = {
      status: "ONLINE",
      last_updated: timestamp,
      market: {
        price: currentPrice,
        trend: market.trend || "STABLE",
        high: Math.floor(currentPrice * 1.05), // Mock High
        low: Math.floor(currentPrice * 0.95), // Mock Low
        vol: Math.floor(Math.random() * 100000), // Mock Volume
      },
      orderBook: orderBook,
      trades: trades,
      history: history,
      stats: {
        total_investors: totalInvestors,
      },
    };

    fs.writeFileSync(JSON_OUTPUT, JSON.stringify(publicData, null, 2));
  } catch (error) {
    console.error("❌ Gagal Export JSON:", error);
  }
}

async function syncToGitHub() {
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return;

    // Cek status dulu biar gak error empty commit
    const status = await git.status();
    if (status.files.length === 0) return;

    await git.add("./web/data/market.json");
    await git.commit("🤖 Market Data Update");
    await git.push();
    console.log("☁️  Web Dashboard Updated!");
  } catch (error) {
    console.error("❌ Gagal Push Git:", error.message);
  }
}

function startBridge() {
  console.log("🌉 Web Bridge Service Started.");
  setInterval(exportToJSON, 5000); // Update lokal lebih cepat (5 detik)

  // AUTO PUSH (Wajib True untuk Website Live)
  const ENABLE_GIT_PUSH = true;
  if (ENABLE_GIT_PUSH) {
    setInterval(syncToGitHub, 60000); // Push tiap 1 menit (Biar web terlihat realtime)
  }
  exportToJSON();
}

module.exports = { start: startBridge };
