const { when } = require("../engine/dsl");
const finance = require("../services/finance");
const registry = require("../engine/commandRegistry");

console.log("📝 Loading Finance Rules...");

// --- DAFTAR COMMAND KE MENU ---
// Kategori: ACCOUNT (Profil & Identitas)
registry.register(
  "profile",
  "ACCOUNT",
  "Lihat Kartu Identitas & Level (Canvas)",
);
registry.register("switch", "ACCOUNT", "Ganti akun Real/Demo", "[real/demo]");

// Kategori: KEUANGAN
registry.register(
  "deposit",
  "KEUANGAN",
  "Isi saldo dompet via transfer manual",
  "[jumlah]",
);
registry.register("saldo", "KEUANGAN", "Cek total uang tunai dan aset token");

// Kategori: ADMIN (Tidak perlu tampil di menu publik sebenernya, tapi buat boss gapapa)
// registry.register('setpayment', 'ADMIN', 'Atur metode pembayaran');
// registry.register('acc', 'ADMIN', 'Terima deposit');

// --- IMPLEMENTASI NIAT ---

// 1. Profile (Visual Canvas)
when(`when message: "profile"`).perform(finance.performProfile).commit();
when(`when message: "profil"`).perform(finance.performProfile).commit();

// 2. Deposit & Saldo
when(`when message: "deposit"`)
  .expect("amount")
  .perform(finance.performDeposit)
  .commit();

when(`when message: "saldo"`).perform(finance.performCheckBalance).commit();

// 3. Switch Account
when(`when message: "switch"`)
  .expect("type")
  .perform(finance.performSwitchAccount)
  .commit();

// 4. ADMIN ONLY (Set Payment, Acc, Reject)
when(`when message: "setpayment"`).perform(finance.performSetPayment).commit();

when(`when message: "acc"`)
  .expect("target")
  .expect("amount")
  .perform(finance.performAccDeposit)
  .commit();

when(`when message: "reject"`)
  .expect("target")
  .perform(finance.performRejectDeposit)
  .commit();
