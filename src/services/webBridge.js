const fs = require("fs");
const path = require("path");
const db = require("../database/core");
const simpleGit = require("simple-git");

/**
 * WEB BRIDGE SERVICE
 * Menghubungkan Data Internal Bot -> Website Publik (GitHub Pages)
 */

// Lokasi Folder Web
// Kita naik 2 level dari src/services/ ke root project
const ROOT_DIR = path.resolve(__dirname, "../../");
const WEB_DIR = path.join(ROOT_DIR, "web");
const WEB_DATA_DIR = path.join(WEB_DIR, "data");
const JSON_OUTPUT = path.join(WEB_DATA_DIR, "market.json");

// Inisialisasi Git
const git = simpleGit(ROOT_DIR);

// Pastikan folder web/data ada, jika belum buat otomatis
if (!fs.existsSync(WEB_DATA_DIR)) {
  fs.mkdirSync(WEB_DATA_DIR, { recursive: true });
}

/**
 * FUNGSI 1: Export Data Lokal (Realtime Cepat)
 * Dijalankan setiap 5-10 detik untuk update file JSON lokal.
 */
function exportToJSON() {
  try {
    // 1. Ambil Data Pasar dari Vault Database
    const market = db.load("market_data");

    // 2. Ambil Statistik User (Contoh: Total Investor)
    const users = db.load("users");
    const totalInvestors = Object.keys(users).length;

    // 3. Buat Payload Data Publik (Jangan ekspos data sensitif!)
    const publicData = {
      status: "ONLINE",
      last_updated: Date.now(),
      readable_time: new Date().toLocaleString("id-ID"),
      market: {
        price: market.current_price || 1000,
        trend: market.trend || "STABLE",
        supply: market.total_supply || 100000,
      },
      stats: {
        total_investors: totalInvestors,
        system_version: "2.1.0",
      },
    };

    // 4. Tulis ke file market.json
    fs.writeFileSync(JSON_OUTPUT, JSON.stringify(publicData, null, 2));
    // console.log("🌐 Web Bridge: Data market.json diperbarui.");
  } catch (error) {
    console.error("❌ Gagal Export JSON:", error);
  }
}

/**
 * FUNGSI 2: Push ke GitHub (Periodik)
 * Dijalankan setiap 5-10 menit agar tidak terkena Rate Limit GitHub.
 */
async function syncToGitHub() {
  try {
    // Cek apakah folder ini adalah repo git
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.log("⚠️ Folder project belum di-init Git. Lewati auto-push.");
      return;
    }

    console.log("☁️  Memulai Auto-Push ke GitHub Pages...");

    // Git Add -> Commit -> Push
    await git.add("./web/data/market.json");
    await git.commit("🤖 Auto-Update: Market Data Realtime");
    await git.push();

    console.log("✅ Data berhasil di-push ke GitHub!");
  } catch (error) {
    console.error("❌ Gagal Push Git:", error.message);
  }
}

/**
 * MAIN RUNNER
 */
function startBridge() {
  console.log("🌉 Web Bridge Service Started.");

  // 1. Update JSON Lokal setiap 10 detik
  setInterval(exportToJSON, 10000);

  // 2. Push ke GitHub setiap 5 menit (300.000 ms)
  // Ubah jadi true jika Boss sudah setting Git Remote
  const ENABLE_GIT_PUSH = true;

  if (ENABLE_GIT_PUSH) {
    setInterval(syncToGitHub, 300000);
  }

  // Jalankan sekali saat start
  exportToJSON();
}

module.exports = { start: startBridge };
