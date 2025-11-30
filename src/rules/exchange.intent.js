const { when } = require('../engine/dsl');
const exchange = require('../services/exchange');
const registry = require('../engine/commandRegistry');

console.log("⚙️ Loading Exchange Rules...");

// ==========================================
// 1. REGISTRASI MENU
// ==========================================

// Kategori: PASAR (Informasi)
registry.register('market', 'PASAR', 'Cek harga saham realtime (Visual Chart)');
registry.register('leaderboard', 'PASAR', 'Lihat Top 10 Sultan Terkaya (Real Account)');

// Kategori: EXCHANGE (Transaksi Spot)
registry.register('buy', 'EXCHANGE', 'Beli Token $ARA (Spot Market)', '[jumlah]');
registry.register('sell', 'EXCHANGE', 'Jual Token $ARA (Spot Market)', '[jumlah]');

// Kategori: ADMIN (Bandar Mode)
registry.register('bandar', 'ADMIN', 'Manipulasi Harga Pasar (Pump/Dump)', '[pump/dump] [persen]');


// ==========================================
// 2. DEFINISI NIAT (LOGIC MAPPING)
// ==========================================

// --- CEK PASAR ---
when(`when message: "market"`)
    .perform(exchange.performCheckMarket) 
    .commit();

// --- SPOT TRADING ---
when(`when message: "buy"`)
    .expect("amount")
    .perform(exchange.performBuy)
    .commit();

when(`when message: "sell"`)
    .expect("amount")
    .perform(exchange.performSell)
    .commit();

// --- LEADERBOARD ---
when(`when message: "leaderboard"`)
    .perform(exchange.performLeaderboardCheck)
    .commit();
when(`when message: "top"`) // Alias singkat
    .perform(exchange.performLeaderboardCheck)
    .commit();
when(`when message: "rank"`) // Alias singkat
    .perform(exchange.performLeaderboardCheck)
    .commit();

// --- BANDAR MODE (Owner Only Logic ada di service) ---
when(`when message: "bandar"`)
    .expect("action")
    .expect("amount")
    .perform(exchange.performPumpDump)
    .commit();