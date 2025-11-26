const { when } = require("../engine/dsl");
const mining = require("../services/mining");
const registry = require("../engine/commandRegistry"); // <-- IMPORT REGISTRY

console.log("⛏️ Loading Mining Rules...");

// --- DAFTAR COMMAND KE MENU ---
registry.register(
  "mine",
  "MINING & REWARD",
  "Tambang Token $ARA gratis (Tiap 1 Jam)",
);
registry.register(
  "claim",
  "MINING & REWARD",
  "Klaim bonus harian Rupiah (Tiap 24 Jam)",
);

// --- IMPLEMENTASI NIAT ---

// Niat: Tambang Token
when(`when message: "mine"`).perform(mining.performMine).commit();
when(`when message: "tambang"`) // Alias Indonesia
  .perform(mining.performMine)
  .commit();

// Niat: Klaim Harian
when(`when message: "claim"`).perform(mining.performDaily).commit();
when(`when message: "daily"`) // Alias
  .perform(mining.performDaily)
  .commit();
