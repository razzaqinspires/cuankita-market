const { when } = require("../engine/dsl");
const finance = require("../services/finance");

// Mendaftarkan Niat Bisnis ke Engine
console.log("📝 Loading Finance Rules...");

// Niat: User ingin deposit
when(`when message: "deposit"`)
  .expect("amount")
  .perform(finance.performDeposit)
  .commit();

// Niat: Owner atur rate
when(`when message: "setrate"`)
  .expect("key")
  .expect("value")
  .perform(finance.performSetRate)
  .commit();
