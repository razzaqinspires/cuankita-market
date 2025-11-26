const db = require("../database/core");

// Konfigurasi Bandar
const MAX_LEVERAGE = 20; // Max ngutang 20x lipat
const LIQUIDATION_THRESHOLD = 0.8; // Jika rugi 80% dari modal, otomatis cut (Hangus)
const TRADING_FEE = 0.001; // Fee buka posisi 0.1%

// Helper: Ambil harga pasar terkini
function getMarketPrice() {
  return db.load("market_data").current_price || 1000;
}

/**
 * BUKA POSISI (LONG/SHORT)
 * Format: .long [modal] [leverage]
 */
async function openPosition(ctx, type) {
  const margin = parseInt(ctx.args[0]); // Modal sendiri
  let leverage = parseInt(ctx.args[1]) || 1; // Kali lipat (Default 1x)

  if (!margin || margin < 10000)
    return ctx.sock.sendMessage(ctx.from, {
      text: "⚠️ Minimal modal Rp 10.000",
    });
  if (leverage > MAX_LEVERAGE)
    return ctx.sock.sendMessage(ctx.from, {
      text: `⚠️ Leverage max ${MAX_LEVERAGE}x!`,
    });
  if (leverage < 1) leverage = 1;

  const users = db.load("users");
  const user = users[ctx.from];

  // Cek Saldo
  if (user.saldo < margin) {
    return ctx.sock.sendMessage(ctx.from, {
      text: `❌ Saldo kurang! Anda cuma punya Rp ${user.saldo.toLocaleString()}`,
    });
  }

  const entryPrice = getMarketPrice();
  const totalSize = margin * leverage; // Total uang yang dimainkan (Modal + Hutang)
  const fee = Math.floor(totalSize * TRADING_FEE);

  // Potong Saldo (Modal + Fee)
  user.saldo -= margin + fee;

  // Simpan Posisi ke Database User
  const positionId = Date.now().toString().slice(-4); // ID unik pendek
  const newPosition = {
    id: positionId,
    type: type, // 'LONG' atau 'SHORT'
    margin: margin,
    leverage: leverage,
    entryPrice: entryPrice,
    size: totalSize,
    timestamp: Date.now(),
  };

  user.positions = user.positions || [];
  user.positions.push(newPosition);

  db.save("users", users);

  const icon = type === "LONG" ? "📈" : "📉";
  await ctx.sock.sendMessage(ctx.from, {
    text:
      `${icon} *OPEN ${type} SUKSES*\n\n` +
      `🆔 ID: #${positionId}\n` +
      `💰 Modal: Rp ${margin.toLocaleString()}\n` +
      `🚀 Leverage: ${leverage}x\n` +
      `💎 Size: Rp ${totalSize.toLocaleString()}\n` +
      `🎯 Entry: Rp ${entryPrice}\n` +
      `\n_Hati-hati! Jika rugi besar, posisi akan terlikuidasi otomatis._`,
  });
}

/**
 * CEK POSISI SAYA
 * Format: .positions
 */
async function checkPositions(ctx) {
  const users = db.load("users");
  const positions = users[ctx.from]?.positions || [];
  const currentPrice = getMarketPrice();

  if (positions.length === 0)
    return ctx.sock.sendMessage(ctx.from, {
      text: "Anda tidak punya posisi trading aktif.",
    });

  let text = "💼 *PORTOFOLIO FUTURES*\nMarket: Rp " + currentPrice + "\n";

  positions.forEach((pos, index) => {
    // Hitung PNL (Untung/Rugi)
    let pnlPercent = 0;
    let pnlRp = 0;

    if (pos.type === "LONG") {
      // Long: Untung jika harga naik
      const priceDiff = (currentPrice - pos.entryPrice) / pos.entryPrice;
      pnlPercent = priceDiff * pos.leverage * 100;
    } else {
      // Short: Untung jika harga turun
      const priceDiff = (pos.entryPrice - currentPrice) / pos.entryPrice;
      pnlPercent = priceDiff * pos.leverage * 100;
    }

    pnlRp = Math.floor(pos.margin * (pnlPercent / 100));
    const icon = pnlRp >= 0 ? "🟢" : "🔴";

    text +=
      `\n${index + 1}. *${pos.type} ${pos.leverage}x* (#${pos.id})\n` +
      `   Entry: ${pos.entryPrice} -> Now: ${currentPrice}\n` +
      `   PNL: ${icon} ${pnlPercent.toFixed(2)}% (Rp ${pnlRp.toLocaleString()})\n`;
  });

  text += `\n_Tutup posisi: .close [ID]_`;
  await ctx.sock.sendMessage(ctx.from, { text: text });
}

/**
 * TUTUP POSISI (AMBIL UNTUNG/RUGI)
 * Format: .close [ID]
 */
async function closePosition(ctx) {
  const targetId = ctx.args[0];
  if (!targetId)
    return ctx.sock.sendMessage(ctx.from, {
      text: "⚠️ Masukkan ID posisi. Cek di .positions",
    });

  const users = db.load("users");
  const user = users[ctx.from];
  const posIndex = user.positions?.findIndex((p) => p.id === targetId);

  if (posIndex === -1 || posIndex === undefined)
    return ctx.sock.sendMessage(ctx.from, {
      text: "❌ Posisi tidak ditemukan.",
    });

  const pos = user.positions[posIndex];
  const currentPrice = getMarketPrice();

  // Hitung Final PNL
  let pnlPercent = 0;
  if (pos.type === "LONG") {
    pnlPercent =
      ((currentPrice - pos.entryPrice) / pos.entryPrice) * pos.leverage;
  } else {
    pnlPercent =
      ((pos.entryPrice - currentPrice) / pos.entryPrice) * pos.leverage;
  }

  const pnlRp = Math.floor(pos.margin * pnlPercent);
  const returnToWallet = pos.margin + pnlRp;

  // Kembalikan ke saldo (Modal + Profit/Loss)
  // Note: Kalau rugi lebih besar dari modal (returnToWallet negatif), saldo user tidak dikurangi lagi (Proteksi Balance Negatif),
  // tapi uang modal hangus.
  const finalReturn = returnToWallet > 0 ? returnToWallet : 0;

  user.saldo += finalReturn;

  // Hapus posisi
  user.positions.splice(posIndex, 1);
  db.save("users", users);

  const emoji = pnlRp >= 0 ? "🤑" : "😭";
  await ctx.sock.sendMessage(ctx.from, {
    text:
      `${emoji} *POSISI DITUTUP*\n\n` +
      `Type: ${pos.type} ${pos.leverage}x\n` +
      `Profit/Loss: Rp ${pnlRp.toLocaleString()}\n` +
      `\n💰 Saldo dikembalikan: Rp ${finalReturn.toLocaleString()}`,
  });
}

// Wrapper untuk Intent
async function performLong(ctx) {
  await openPosition(ctx, "LONG");
}
async function performShort(ctx) {
  await openPosition(ctx, "SHORT");
}

module.exports = { performLong, performShort, checkPositions, closePosition };
