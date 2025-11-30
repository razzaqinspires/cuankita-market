const { when } = require('../engine/dsl');
const mining = require('../services/mining');
const registry = require('../engine/commandRegistry');

console.log("⛏️ Loading Mining Rules...");

// ==========================================
// 1. REGISTRASI MENU
// ==========================================

// Kategori: MINING & REWARD
registry.register('mine', 'MINING & REWARD', 'Tambang Token $ARA gratis (Tiap 1 Jam)', '[kode_boost]');
registry.register('claim', 'MINING & REWARD', 'Klaim bonus harian Rupiah (Tiap 24 Jam)');


// ==========================================
// 2. DEFINISI NIAT (LOGIC MAPPING)
// ==========================================

// --- MINING TOKEN ---
when(`when message: "mine"`)
    .expect("code") // Menerima kode boost dari web (opsional)
    .perform(mining.performMine)
    .commit();

when(`when message: "tambang"`) // Alias Indonesia
    .expect("code")
    .perform(mining.performMine)
    .commit();

// --- DAILY CLAIM (ABSEN) ---
when(`when message: "claim"`)
    .perform(mining.performDaily)
    .commit();

when(`when message: "daily"`) // Alias Inggris
    .perform(mining.performDaily)
    .commit();

when(`when message: "absen"`) // Alias Indonesia
    .perform(mining.performDaily)
    .commit();