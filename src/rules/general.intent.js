const { when } = require("../engine/dsl");
const general = require("../services/general.js");
const registry = require("../engine/commandRegistry"); // <-- IMPORT REGISTRY

console.log("⚙️ Loading General System Rules...");

// --- DAFTAR COMMAND KE REGISTRY ---
registry.register("menu", "SISTEM", "Menampilkan daftar semua command ini");
registry.register("ping", "SISTEM", "Cek latency dan status bot");
registry.register("owner", "SISTEM", "Menampilkan kontak Owner dan Developer");
registry.register("top", "SISTEM", "Lihat Peringkat 10 Sultan Terkaya"); // <--- TAMBAHAN

// --- IMPLEMENTASI RULE ---
when(`when message: "menu"`).perform(general.performMenu).commit();
when(`when message: "help"`).perform(general.performMenu).commit(); // Alias
when(`when message: "bantuan"`).perform(general.performMenu).commit(); // Alias

when(`when message: "owner"`).perform(general.performOwnerInfo).commit();

when(`when message: "ping"`).perform(general.performPing).commit();
when(`when message: "info"`).perform(general.performPing).commit(); // Alias

when(`when message: "top"`).perform(general.performLeaderboard).commit();
when(`when message: "rank"`).perform(general.performLeaderboard).commit();
when(`when message: "leaderboard"`)
  .perform(general.performLeaderboard)
  .commit();
