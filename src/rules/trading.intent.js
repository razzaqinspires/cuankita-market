const { when } = require("../engine/dsl");
const trading = require("../services/trading");
const registry = require("../engine/commandRegistry"); // <-- IMPORT REGISTRY

console.log("⚙️ Loading Futures Trading Rules...");

// --- DAFTAR COMMAND KE REGISTRY ---
registry.register(
  "long",
  "FUTURES",
  "Beli posisi (untung jika naik)",
  "[modal] [leverage]",
);
registry.register(
  "short",
  "FUTURES",
  "Jual posisi (untung jika turun)",
  "[modal] [leverage]",
);
registry.register(
  "positions",
  "FUTURES",
  "Mengecek posisi trading Futures aktif Anda",
);
registry.register("close", "FUTURES", "Menutup posisi trading Futures", "[ID]");

// --- IMPLEMENTASI RULE ---
when(`when message: "long"`)
  .expect("amount")
  .expect("leverage")
  .perform(trading.performLong)
  .commit();

when(`when message: "short"`)
  .expect("amount")
  .expect("leverage")
  .perform(trading.performShort)
  .commit();

when(`when message: "positions"`).perform(trading.checkPositions).commit();
when(`when message: "posisi"`) // Alias
  .perform(trading.checkPositions)
  .commit();

when(`when message: "close"`)
  .expect("id")
  .perform(trading.closePosition)
  .commit();
