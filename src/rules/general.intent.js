const { when } = require('../engine/dsl');
const general = require('../services/general');
const registry = require('../engine/commandRegistry');

console.log("⚙️ Loading General System Rules...");

// ==========================================
// 1. REGISTRASI MENU
// ==========================================

// Kategori: SISTEM
registry.register('menu', 'SISTEM', 'Menampilkan daftar semua command');
registry.register('owner', 'SISTEM', 'Menampilkan kontak Owner dan Developer');
registry.register('ping', 'SISTEM', 'Cek latency dan status bot');


// ==========================================
// 2. DEFINISI NIAT (LOGIC MAPPING)
// ==========================================

// --- MENU / BANTUAN ---
when(`when message: "menu"`)
    .perform(general.performMenu)
    .commit();

when(`when message: "help"`) // Alias
    .perform(general.performMenu)
    .commit();

when(`when message: "bantuan"`) // Alias Indonesia
    .perform(general.performMenu)
    .commit();

// --- OWNER INFO ---
when(`when message: "owner"`)
    .perform(general.performOwnerInfo)
    .commit();

when(`when message: "creator"`) // Alias
    .perform(general.performOwnerInfo)
    .commit();

// --- PING / STATUS ---
when(`when message: "ping"`)
    .perform(general.performPing)
    .commit();

when(`when message: "info"`) // Alias
    .perform(general.performPing)
    .commit();

when(`when message: "status"`) // Alias
    .perform(general.performPing)
    .commit();