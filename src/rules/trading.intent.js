const { when } = require('../engine/dsl');
const trading = require('../services/trading');
const registry = require('../engine/commandRegistry');

console.log("📊 Loading Futures Trading Rules...");

// ==========================================
// 1. REGISTRASI MENU
// ==========================================

// Kategori: FUTURES (High Risk Trading)
registry.register('long', 'FUTURES', 'Beli posisi (untung jika naik)', '[modal] [leverage]');
registry.register('short', 'FUTURES', 'Jual posisi (untung jika turun)', '[modal] [leverage]');
registry.register('positions', 'FUTURES', 'Mengecek posisi trading Futures aktif Anda');
registry.register('close', 'FUTURES', 'Menutup posisi trading Futures', '[ID]');


// ==========================================
// 2. DEFINISI NIAT (LOGIC MAPPING)
// ==========================================

// --- OPEN LONG (Naik) ---
when(`when message: "long"`)
    .expect("amount")
    .expect("leverage")
    .perform(trading.performLong)
    .commit();

// --- OPEN SHORT (Turun) ---
when(`when message: "short"`)
    .expect("amount")
    .expect("leverage")
    .perform(trading.performShort)
    .commit();

// --- CEK POSISI ---
when(`when message: "positions"`)
    .perform(trading.checkPositions)
    .commit();
when(`when message: "posisi"`) // Alias Indonesia
    .perform(trading.checkPositions)
    .commit();
when(`when message: "portfolio"`) // Alias Inggris
    .perform(trading.checkPositions)
    .commit();

// --- TUTUP POSISI ---
when(`when message: "close"`)
    .expect("id")
    .perform(trading.closePosition)
    .commit();
when(`when message: "tutup"`) // Alias Indonesia
    .expect("id")
    .perform(trading.closePosition)
    .commit();