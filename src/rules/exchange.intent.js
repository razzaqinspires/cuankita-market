const { when } = require("../engine/dsl");
const exchange = require("../services/exchange");
const registry = require("../engine/commandRegistry");

console.log("⚙️ Loading Exchange Rules...");

// --- DAFTAR KE MENU ---
registry.register("buy", "EXCHANGE", "Beli Token $ARA (Spot)", "[jumlah]");
registry.register("sell", "EXCHANGE", "Jual Token $ARA (Spot)", "[jumlah]");
registry.register("market", "PASAR", "Cek harga saham realtime");

// --- IMPLEMENTASI RULE ---

// 1. Buy -> performBuy
when(`when message: "buy"`)
  .expect("amount")
  .perform(exchange.performBuy)
  .commit();

// 2. Sell -> performSell
when(`when message: "sell"`)
  .expect("amount")
  .perform(exchange.performSell)
  .commit();

// 3. Market -> performCheckMarket (JANGAN performMarketCheck!)
when(`when message: "market"`).perform(exchange.performCheckMarket).commit();

// 4. Bandar -> performPumpDump
when(`when message: "bandar"`)
  .expect("action")
  .expect("amount")
  .perform(exchange.performPumpDump)
  .commit();
