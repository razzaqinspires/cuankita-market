const { when } = require('../engine/dsl');
const mining = require('../services/mining');

console.log("⛏️ Loading Mining Rules...");

// Niat: Tambang Token (Setiap Jam)
when(`when message: "mine"`)
    .perform(mining.performMine)
    .commit();

// Niat: Klaim Harian (Setiap 24 Jam)
when(`when message: "claim"`)
    .perform(mining.performDaily)
    .commit();