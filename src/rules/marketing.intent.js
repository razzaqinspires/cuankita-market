const { when } = require("../engine/dsl");
const marketing = require("../services/marketing");
const registry = require("../engine/commandRegistry");

console.log("📢 Loading Marketing Rules...");

// --- DAFTAR COMMAND (Hanya Redeem yang publik) ---
registry.register(
  "redeem",
  "MINING & REWARD",
  "Klaim Kode Voucher / Gift",
  "[kode]",
);
// .bc dan .voucher tidak didaftarkan agar rahasia

// --- IMPLEMENTASI RULE ---

// 1. Broadcast (Owner Only)
when(`when message: "bc"`)
  .expect("target")
  .expect("message")
  .perform(marketing.performBroadcast)
  .commit();

when(`when message: "broadcast"`)
  .expect("target")
  .expect("message")
  .perform(marketing.performBroadcast)
  .commit();

// 2. Buat Voucher (Owner Only)
when(`when message: "voucher"`)
  .expect("amount")
  .expect("quota")
  .perform(marketing.performCreateVoucher)
  .commit();
when(`when message: "create"`) // Alias
  .expect("amount")
  .expect("quota")
  .perform(marketing.performCreateVoucher)
  .commit();

// 3. Redeem Voucher (Public)
when(`when message: "redeem"`)
  .expect("code")
  .perform(marketing.performRedeem)
  .commit();
when(`when message: "klaim"`) // Alias
  .expect("code")
  .perform(marketing.performRedeem)
  .commit();
