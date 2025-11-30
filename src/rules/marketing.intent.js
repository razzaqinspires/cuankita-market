const { when } = require('../engine/dsl');
const marketing = require('../services/marketing');
const registry = require('../engine/commandRegistry');

console.log("📢 Loading Marketing Rules...");

// ==========================================
// 1. REGISTRASI MENU
// ==========================================

// Kategori: MINING & REWARD (Public)
registry.register('redeem', 'MINING & REWARD', 'Klaim Kode Voucher / Gift', '[kode]');

// Kategori: ADMIN (Owner Only)
registry.register('bc', 'ADMIN', 'Broadcast pesan ke semua user', '[target] [pesan]');
registry.register('voucher', 'ADMIN', 'Buat Kode Voucher Bagi-bagi', '[jumlah] [hari]');


// ==========================================
// 2. DEFINISI NIAT (LOGIC MAPPING)
// ==========================================

// --- BROADCAST ---
when(`when message: "bc"`)
    .perform(marketing.performBroadcast)
    .commit();

when(`when message: "broadcast"`)
    .perform(marketing.performBroadcast)
    .commit();

// --- CREATE VOUCHER ---
when(`when message: "voucher"`)
    .expect("amount")
    .expect("days")
    .perform(marketing.performCreateVoucher)
    .commit();

when(`when message: "createvoucher"`) // Alias panjang
    .expect("amount")
    .expect("days")
    .perform(marketing.performCreateVoucher)
    .commit();

// --- REDEEM VOUCHER ---
when(`when message: "redeem"`)
    .expect("code")
    .perform(marketing.performRedeemVoucher)
    .commit();

when(`when message: "klaim"`) // Alias Indonesia
    .expect("code")
    .perform(marketing.performRedeemVoucher)
    .commit();