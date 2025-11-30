const fs = require('fs');
const path = require('path');
const db = require('../database/core');
const simpleGit = require('simple-git');
const newsService = require('./news'); // Import News Service untuk trigger berita

const ROOT_DIR = path.resolve(__dirname, '../../');
const WEB_DIR = path.join(ROOT_DIR, 'web');
const WEB_DATA_DIR = path.join(WEB_DIR, 'data');
const JSON_OUTPUT = path.join(WEB_DATA_DIR, 'market.json');

const git = simpleGit(ROOT_DIR);

// Pastikan folder data ada
if (!fs.existsSync(WEB_DATA_DIR)) fs.mkdirSync(WEB_DATA_DIR, { recursive: true });

// --- HELPER: SIMULASI ORDER BOOK ---
// Membuat data palsu antrian beli/jual agar pasar terlihat ramai
function generateOrderBook(currentPrice) {
    const bids = []; 
    const asks = [];
    // Generate 8 layer kedalaman pasar
    for(let i=0; i<8; i++) {
        // Bids: Harga lebih murah dari current
        bids.push({ 
            p: Math.floor(currentPrice * (1 - (0.002 * (i+1)))), 
            a: Math.floor(Math.random() * 5000) + 100 
        });
        // Asks: Harga lebih mahal dari current
        asks.push({ 
            p: Math.floor(currentPrice * (1 + (0.002 * (i+1)))), 
            a: Math.floor(Math.random() * 5000) + 100 
        });
    }
    return { bids, asks };
}

// --- HELPER: LEADERBOARD DATA (REAL ONLY) ---
// Hanya mengambil data user dengan Akun REAL. Akun Demo diabaikan.
function getLeaderboardData() {
    const users = db.load('users');
    const market = db.load('market_data');
    const price = market.current_price || 1000;
    const list = [];

    for(const jid in users) {
        const u = users[jid];
        
        // HANYA MENGHITUNG SALDO & ASET REAL (Anti Fake Flexing)
        const saldoReal = u.balance_real || 0;
        const assetReal = (u.assets_real?.ara_coin || 0) * price;
        const totalWealth = saldoReal + assetReal;
        
        // Filter: Hanya user yang punya kekayaan Real > 0
        if(totalWealth > 0) {
            list.push({ 
                name: u.name || jid.split('@')[0], 
                wealth: totalWealth 
            });
        }
    }
    
    // Urutkan dari terkaya, ambil Top 10
    return list.sort((a,b) => b.wealth - a.wealth).slice(0, 10);
}

// --- FUNGSI UTAMA: EXPORT KE JSON ---
function exportToJSON() {
    try {
        const market = db.load('market_data');
        const currentPrice = market.current_price || 1000;
        const timestamp = Date.now();
        const timeString = new Date().toLocaleTimeString('id-ID');

        // 1. Trigger Berita Baru (Peluang kecil setiap siklus)
        // Math.random > 0.98 artinya sekitar 1 dari 50 kali refresh (tiap ~4 menit)
        if (Math.random() > 0.98) { 
            newsService.generateNews(); 
        }
        
        // 2. Baca Data Lama (untuk menjaga history chart)
        let existingData = { history: [], trades: [] };
        if (fs.existsSync(JSON_OUTPUT)) {
            try { existingData = JSON.parse(fs.readFileSync(JSON_OUTPUT, 'utf-8')); } catch (e) {}
        }

        // 3. Update Chart History
        let history = existingData.history || [];
        
        // Push data baru jika harga berubah ATAU random sample (biar grafik jalan terus walau harga tetap)
        if (history.length === 0 || history[history.length-1].p !== currentPrice || Math.random() > 0.6) {
            history.push({ t: timeString, p: currentPrice });
        }
        // Batasi history maks 60 titik (cukup untuk view chart web)
        if (history.length > 60) history = history.slice(history.length - 60);

        // 4. Update Recent Trades (Simulasi transaksi berjalan)
        let trades = existingData.trades || [];
        if (Math.random() > 0.4) {
            trades.unshift({ 
                t: timeString, 
                type: Math.random() > 0.5 ? 'BUY' : 'SELL', 
                p: currentPrice, 
                a: Math.floor(Math.random() * 2000) + 10 
            });
        }
        if (trades.length > 15) trades = trades.slice(0, 15);

        // 5. Susun Payload Lengkap
        const publicData = {
            status: "MARKET_OPEN",
            last_updated: timestamp,
            readable_time: new Date().toLocaleString('id-ID'),
            market: {
                price: currentPrice,
                trend: market.trend || "STABLE",
                // Simulasi High/Low harian
                high: Math.floor(currentPrice * 1.12),
                low: Math.floor(currentPrice * 0.88),
                // Simulasi Volume & Market Cap
                vol: Math.floor(Math.random() * 5000000) + 1000000, 
                mcap: currentPrice * 10000000,
                // Berita Terkini
                news: market.last_news || { headline: "Market stabil. Belum ada berita signifikan.", type: "NEUTRAL" }
            },
            leaderboard: getLeaderboardData(),
            orderBook: generateOrderBook(currentPrice),
            trades: trades,
            history: history,
            stats: {
                total_investors: Object.keys(db.load('users')).length
            }
        };

        // 6. Tulis File
        fs.writeFileSync(JSON_OUTPUT, JSON.stringify(publicData, null, 2));

    } catch (error) { 
        console.error("❌ Export JSON Error:", error); 
    }
}

// --- SYNC KE GITHUB (AUTO DEPLOY) ---
async function syncToGitHub() {
    try {
        const isRepo = await git.checkIsRepo();
        if (!isRepo) return;
        
        const status = await git.status();
        if (status.files.length === 0) return; // Tidak ada perubahan, skip push

        await git.add('./web/data/market.json');
        await git.commit('🤖 Auto-Update: Market Realtime Data');
        await git.push();
        console.log("☁️  Web Dashboard Updated (GitHub Pushed)");
    } catch (error) { 
        // Silent error (biasanya koneksi internet / conflict)
        // console.error("Git Push Warning:", error.message); 
    }
}

// --- RUNNER ---
function startBridge() {
    console.log("🌉 Web Bridge Service V3.0 Started.");
    
    // Update File JSON Lokal setiap 5 detik (Cepat)
    setInterval(exportToJSON, 5000); 
    
    // Push ke GitHub setiap 60 detik (Agar tidak kena rate limit & hemat bandwidth)
    // Ubah ke FALSE jika hanya ingin test lokal tanpa internet
    const ENABLE_GIT_PUSH = true; 
    
    if (ENABLE_GIT_PUSH) {
        setInterval(syncToGitHub, 60000); 
    }
    
    // Jalankan segera saat start
    exportToJSON();
}

module.exports = { start: startBridge };