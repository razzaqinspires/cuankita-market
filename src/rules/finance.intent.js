const { when } = require('../engine/dsl');
const finance = require('../services/finance');
const registry = require('../engine/commandRegistry');

console.log("📝 Loading Finance Rules...");

// ==========================================
// 1. REGISTRASI MENU (Agar muncul di .menu)
// ==========================================

// Kategori: ACCOUNT
registry.register('profile', 'ACCOUNT', 'Lihat Kartu Identitas Investor (Visual)');
registry.register('switch', 'ACCOUNT', 'Ganti akun Real/Demo', '[real/demo]');

// Kategori: KEUANGAN
registry.register('deposit', 'KEUANGAN', 'Isi saldo dompet via transfer manual', '[jumlah]');
registry.register('saldo', 'KEUANGAN', 'Cek total uang tunai dan aset token');

// Kategori: MINING & REWARD (Referral System)
registry.register('referral', 'MINING & REWARD', 'Cek statistik affiliate & komisi');
registry.register('register', 'MINING & REWARD', 'Daftar jadi downline teman', '[kode_referral]');

// Kategori: ADMIN (Hanya Owner yang bisa eksekusi, tapi kita tampilkan agar Boss ingat)
registry.register('acc', 'ADMIN', 'Terima Deposit User', '[target] [jumlah]');
registry.register('reject', 'ADMIN', 'Tolak Deposit User', '[target]');
registry.register('setpayment', 'ADMIN', 'Atur Rekening/E-Wallet', '[bank|nomor]');
registry.register('setrate', 'ADMIN', 'Atur Rate/Fee Config', '[key] [value]');


// ==========================================
// 2. DEFINISI NIAT (LOGIC MAPPING)
// ==========================================

// --- DEPOSIT & SALDO ---
when(`when message: "deposit"`)
    .expect("amount")
    .perform(finance.performDeposit)
    .commit();

when(`when message: "saldo"`)
    .perform(finance.performCheckBalance)
    .commit();
when(`when message: "balance"`) // Alias
    .perform(finance.performCheckBalance)
    .commit();

// --- PROFIL & AKUN ---
when(`when message: "profile"`)
    .perform(finance.performProfile)
    .commit();
when(`when message: "profil"`) // Alias Indonesia
    .perform(finance.performProfile)
    .commit();

when(`when message: "switch"`)
    .expect("type")
    .perform(finance.performSwitchAccount)
    .commit();

// --- REFERRAL SYSTEM ---
when(`when message: "referral"`)
    .perform(finance.performCheckReferral)
    .commit();
when(`when message: "ref"`) // Alias
    .perform(finance.performCheckReferral)
    .commit();

when(`when message: "register"`)
    .expect("referrerId")
    .perform(finance.performReferralRegistration)
    .commit();

// --- ADMIN COMMANDS ---
when(`when message: "acc"`)
    .expect("target")
    .expect("amount")
    .perform(finance.performAccDeposit)
    .commit();

when(`when message: "reject"`)
    .expect("target")
    .perform(finance.performRejectDeposit)
    .commit();

when(`when message: "setpayment"`)
    .perform(finance.performSetPayment)
    .commit();

when(`when message: "setrate"`)
    .expect("key")
    .expect("value")
    .perform(finance.performSetRate)
    .commit();