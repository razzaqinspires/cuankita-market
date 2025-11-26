const { when } = require('../engine/dsl');
const exchange = require('../services/exchange');

console.log("📈 Loading Stock Market Rules...");

// Niat: Cek Harga Pasar
when(`when message: "market"`)
    .perform(exchange.performCheckMarket)
    .commit();

// Niat: Beli Saham/Token
when(`when message: "buy"`)
    .expect("amount")
    .perform(exchange.performBuyToken)
    .commit();

// Niat: Jual Saham/Token
when(`when message: "sell"`)
    .expect("amount")
    .perform(exchange.performSellToken)
    .commit();

// Niat: Bandar Memainkan Harga (Rahasia)
// Contoh: when message: "bandar pump 50" (Naikkan 50%)
when(`when message: "bandar"`)
    .expect("action") // pump atau dump
    .expect("percent")
    .perform(exchange.performPumpDump)
    .commit();