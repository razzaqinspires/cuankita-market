const db = require("../database/core");
const drawing = require("../utils/drawing"); // Import Visual Engine

// --- KONFIGURASI PASAR ---
const FLOOR_PRICE = 50; // Harga terendah (Anti 0)
const CEILING_PRICE = 100000; // Harga tertinggi

/**
 * ALGORITMA HARGA DINAMIS
 * Menghasilkan harga baru berdasarkan volatilitas random atau intervensi bandar.
 */
function getCurrentPrice() {
  const market = db.load("market_data");

  // Inisialisasi jika data kosong
  if (!market.current_price) {
    market.current_price = 1000;
    market.trend = "STABLE";
    market.total_supply = 100000;
    db.save("market_data", market);
  }

  // Logika Fluktuasi Alami (Hanya jalan jika tidak ada manual override)
  if (!market.manual_override) {
    const volatility = 0.05; // 5% swing
    const change = 1 + (Math.random() * (volatility * 2) - volatility);
    let newPrice = Math.floor(market.current_price * change);

    // Safety Net
    if (newPrice < FLOOR_PRICE) newPrice = FLOOR_PRICE;
    if (newPrice > CEILING_PRICE) newPrice = CEILING_PRICE;

    market.current_price = newPrice;
    market.trend = change >= 1 ? "📈 NAIK" : "📉 TURUN";
    market.last_updated = Date.now();

    db.save("market_data", market);
  } else {
    // Reset flag manual setelah satu siklus
    market.manual_override = false;
    db.save("market_data", market);
  }

  return market;
}

/**
 * SISTEM LIKUIDASI (FUTURES)
 * Mengecek semua posisi user. Jika rugi > 80%, posisi dihapus paksa.
 */
function checkLiquidation(currentPrice) {
  const users = db.load("users");
  let hasChanges = false;

  Object.keys(users).forEach((userJid) => {
    const user = users[userJid];
    if (!user.positions || user.positions.length === 0) return;

    // Loop mundur agar aman saat splice array
    for (let i = user.positions.length - 1; i >= 0; i--) {
      const pos = user.positions[i];
      let pnlPercent = 0;

      if (pos.type === "LONG") {
        pnlPercent =
          ((currentPrice - pos.entryPrice) / pos.entryPrice) * pos.leverage;
      } else {
        pnlPercent =
          ((pos.entryPrice - currentPrice) / pos.entryPrice) * pos.leverage;
      }

      // Threshold Likuidasi: Rugi 80% (-0.8)
      if (pnlPercent <= -0.8) {
        console.log(
          `☠️ LIQUIDATION: User ${userJid} posisi #${pos.id} hangus.`,
        );
        user.positions.splice(i, 1); // Hapus posisi
        hasChanges = true;
      }
    }
  });

  if (hasChanges) db.save("users", users);
}

/**
 * 1. CEK PASAR (VISUAL CHART)
 * Mengirim gambar grafik alih-alih teks biasa.
 */
async function performCheckMarket(ctx) {
  const market = getCurrentPrice();
  const users = db.load("users");
  const userTokens = users[ctx.from]?.assets?.ara_coin || 0;
  const valuation = userTokens * market.current_price;

  await ctx.sock.sendMessage(ctx.from, {
    text: "⏳ Sedang menggambar chart realtime...",
  });

  // Generate Chart Image (Hybrid Rendering)
  try {
    const buffer = await drawing.createMarketChart();

    const caption =
      `📊 *MARKET OVERVIEW*\n` +
      `---------------------------\n` +
      `💼 Aset Anda: *${userTokens.toLocaleString()} $ARA*\n` +
      `💵 Valuasi: *Rp ${valuation.toLocaleString()}*\n` +
      `---------------------------\n` +
      `_Ketik .buy atau .sell untuk transaksi._\n` +
      `_Pantau Live di Web: https://razzaqinspires.github.io/cuankita-market/web/ _`;

    await ctx.sock.sendMessage(ctx.from, {
      image: buffer,
      caption: caption,
    });
  } catch (e) {
    console.error("Gagal kirim gambar:", e);
    // Fallback teks jika gambar gagal
    await ctx.sock.sendMessage(ctx.from, {
      text: `Harga: Rp ${market.current_price}\nTren: ${market.trend}`,
    });
  }
}

/**
 * 2. BELI TOKEN (SPOT)
 */
async function performBuy(ctx) {
  const amountToken = parseInt(ctx.args[0]);
  if (!amountToken || amountToken <= 0)
    return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Contoh: .buy 10" });

  const market = getCurrentPrice();
  const totalPrice = amountToken * market.current_price;

  const users = db.load("users");
  const user = users[ctx.from] || { saldo: 0, assets: {} };

  if (user.saldo < totalPrice) {
    return ctx.sock.sendMessage(ctx.from, {
      text: `❌ Saldo Kurang! Butuh Rp ${totalPrice.toLocaleString()}`,
    });
  }

  user.saldo -= totalPrice;
  user.assets = user.assets || {};
  user.assets.ara_coin = (user.assets.ara_coin || 0) + amountToken;

  // Efek Pasar: Demand naik -> Harga naik sedikit (2%)
  market.current_price = Math.floor(market.current_price * 1.02);

  db.save("market_data", market);
  db.save("users", users);

  // Cek likuidasi user lain akibat perubahan harga ini
  checkLiquidation(market.current_price);

  await ctx.sock.sendMessage(ctx.from, {
    text: `✅ *BELI BERHASIL*\n+ ${amountToken} $ARA\n- Rp ${totalPrice.toLocaleString()}`,
  });
}

/**
 * 3. JUAL TOKEN (SPOT)
 */
async function performSell(ctx) {
  const amountToken = parseInt(ctx.args[0]);
  if (!amountToken || amountToken <= 0)
    return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Contoh: .sell 10" });

  const market = getCurrentPrice();
  const users = db.load("users");
  const user = users[ctx.from];
  const userAssets = user?.assets?.ara_coin || 0;

  if (userAssets < amountToken) {
    return ctx.sock.sendMessage(ctx.from, {
      text: `❌ Token kurang! Cuma punya ${userAssets} $ARA`,
    });
  }

  const rawTotal = amountToken * market.current_price;
  const fee = Math.floor(rawTotal * 0.05); // Fee Boss 5%
  const netTotal = rawTotal - fee;

  user.assets.ara_coin -= amountToken;
  user.saldo += netTotal;

  // Efek Pasar: Supply naik -> Harga turun sedikit (2%)
  market.current_price = Math.floor(market.current_price * 0.98);
  if (market.current_price < FLOOR_PRICE) market.current_price = FLOOR_PRICE;

  db.save("market_data", market);
  db.save("users", users);

  checkLiquidation(market.current_price);

  await ctx.sock.sendMessage(ctx.from, {
    text: `✅ *JUAL BERHASIL*\n- ${amountToken} $ARA\n💰 Dapat: Rp ${netTotal.toLocaleString()}\n(Fee 5%: Rp ${fee.toLocaleString()})`,
  });
}

/**
 * 4. LEADERBOARD (TOP 10 SULTAN)
 */
async function performLeaderboardCheck(ctx) {
  const users = db.load("users");
  const market = getCurrentPrice();
  const currentPrice = market.current_price;

  const rankings = [];

  // Hitung Kekayaan (Saldo + Aset)
  for (const jid in users) {
    const user = users[jid];
    const araCoin = user.assets?.ara_coin || 0;
    const saldo = user.saldo || 0;
    const assetsVal = araCoin * currentPrice;
    const totalWealth = saldo + assetsVal;

    if (totalWealth > 0) {
      rankings.push({
        name: user.name || jid.split("@")[0],
        wealth: totalWealth,
        jid: jid,
      });
    }
  }

  // Sortir Descending
  rankings.sort((a, b) => b.wealth - a.wealth);

  let msg = `🏆 *TOP 10 CUANKITA LEADERBOARD*\n`;
  msg += `_Wealth per Rp ${currentPrice.toLocaleString()} $ARA_\n`;
  msg += `-------------------------------------------------\n`;

  for (let i = 0; i < Math.min(10, rankings.length); i++) {
    const rank = rankings[i];
    const medal =
      i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

    msg += `${medal} ${rank.name.padEnd(15)}: *Rp ${rank.wealth.toLocaleString("id-ID")}*\n`;
  }

  // Posisi User Sendiri
  const userRank = rankings.findIndex((r) => r.jid === ctx.from) + 1;
  const userWealth = rankings.find((r) => r.jid === ctx.from)?.wealth || 0;

  msg += `-------------------------------------------------\n`;
  msg += `💎 Posisi Anda: #${userRank} (Rp ${userWealth.toLocaleString()})\n`;

  await ctx.sock.sendMessage(ctx.from, { text: msg });
}

/**
 * 5. COMMAND KHUSUS OWNER (BANDAR PUMP/DUMP)
 */
async function performPumpDump(ctx) {
  const config = db.load("config");

  // Validasi Owner JID
  if (ctx.from !== config.owner_jid) {
    return ctx.sock.sendMessage(ctx.from, {
      text: "❌ Perintah ini hanya untuk Boss.",
    });
  }

  const action = ctx.args[0]?.toLowerCase();
  const amount = parseFloat(ctx.args[1]);

  if (!["pump", "dump"].includes(action) || isNaN(amount)) {
    return ctx.sock.sendMessage(ctx.from, {
      text: "⚠️ Format: .bandar pump 10",
    });
  }

  const market = db.load("market_data");
  let newPrice = market.current_price || 1000;

  if (action === "pump") {
    newPrice *= 1 + amount / 100;
    market.trend = `🚀 PUMP (${amount}%)`;
  } else {
    newPrice *= 1 - amount / 100;
    market.trend = `🩸 DUMP (${amount}%)`;
    if (newPrice < FLOOR_PRICE) newPrice = FLOOR_PRICE;
  }

  market.current_price = Math.round(newPrice);
  market.manual_override = true; // Kunci harga agar tidak ditimpa algoritma alami sesaat
  market.last_updated = Date.now();

  db.save("market_data", market);
  checkLiquidation(market.current_price); // Cek korban likuidasi

  await ctx.sock.sendMessage(ctx.from, {
    text: `✅ [BANDAR] Harga dimanipulasi ke Rp ${market.current_price.toLocaleString()} (${market.trend})`,
  });
}

module.exports = {
  performCheckMarket,
  performBuy,
  performSell,
  performLeaderboardCheck,
  performPumpDump,
};
