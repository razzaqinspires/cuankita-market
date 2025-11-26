const db = require("../database/core");

// Konfigurasi Mining
const MINING_REWARD_MIN = 1;
const MINING_REWARD_MAX = 5;
const COOLDOWN_MINUTES = 60; // Bisa nambang setiap 60 menit

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes} menit ${seconds} detik`;
}

async function performMine(ctx) {
  const users = db.load("users");
  const user = users[ctx.from] || { saldo: 0, assets: {} };

  // Cek Cooldown
  const lastMine = user.last_mine_time || 0;
  const now = Date.now();
  const diff = now - lastMine;
  const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

  if (diff < cooldownMs) {
    const timeLeft = cooldownMs - diff;
    return ctx.sock.sendMessage(ctx.from, {
      text: `⏳ *COOLDOWN*\nEnergi habis! Istirahat dulu.\n\nBisa nambang lagi dalam:\n*${formatDuration(timeLeft)}*`,
    });
  }

  // Gacha Reward (Dapat Token Random)
  const reward =
    Math.floor(Math.random() * (MINING_REWARD_MAX - MINING_REWARD_MIN + 1)) +
    MINING_REWARD_MIN;

  // Update Data
  user.assets = user.assets || {};
  user.assets.ara_coin = (user.assets.ara_coin || 0) + reward;
  user.last_mine_time = now;

  db.save("users", users);

  // Cek Harga Pasar (untuk pamer valuasi)
  const market = db.load("market_data");
  const price = market.current_price || 1000;
  const value = reward * price;

  await ctx.sock.sendMessage(ctx.from, {
    text: `⛏️ *MINING SUKSES*\n\nAnda menemukan: *${reward} $ARA*\n(Senilai ± Rp ${value.toLocaleString()})\n\nTotal Aset: ${user.assets.ara_coin} $ARA\n_Ketik .market untuk jual._`,
  });
}

async function performDaily(ctx) {
  // Logika mirip mining, tapi cooldown 24 jam dan reward Rupiah (Saldo)
  const users = db.load("users");
  const user = users[ctx.from];

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const lastDaily = user.last_daily_time || 0;

  if (now - lastDaily < oneDay) {
    return ctx.sock.sendMessage(ctx.from, {
      text: "❌ Absen harian sudah diambil hari ini. Kembali besok!",
    });
  }

  const rewardRp = 5000; // Kasih gopek biar seneng
  user.saldo = (user.saldo || 0) + rewardRp;
  user.last_daily_time = now;

  db.save("users", users);

  await ctx.sock.sendMessage(ctx.from, {
    text: `📅 *ABSEN HARIAN*\n\nBonus masuk: Rp ${rewardRp.toLocaleString()}\nSaldo: Rp ${user.saldo.toLocaleString()}`,
  });
}

module.exports = { performMine, performDaily };
