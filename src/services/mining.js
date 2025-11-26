const db = require("../database/core");

// Konfigurasi Mining
const BASE_REWARD = 1; // Reward malas (cuma ketik .mine)
const BOOST_MULTIPLIER = 10; // Reward rajin (buka web)
const COOLDOWN_MINUTES = 60;

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes} menit ${seconds} detik`;
}

async function performMine(ctx) {
  const users = db.load("users");
  const user = users[ctx.from] || { saldo: 0, assets: {} };

  // 1. Cek Cooldown
  const lastMine = user.last_mine_time || 0;
  const now = Date.now();
  const diff = now - lastMine;
  const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

  if (diff < cooldownMs) {
    const timeLeft = cooldownMs - diff;
    return ctx.sock.sendMessage(ctx.from, {
      text: `⏳ *MESIN PANAS*\nIstirahat dulu Boss.\n\nBisa nambang lagi dalam:\n*${formatDuration(timeLeft)}*`,
    });
  }

  // 2. Cek Boost Code (Dari Website)
  const inputCode = ctx.args[0];
  let finalReward = Math.floor(Math.random() * 3) + BASE_REWARD; // 1-3 Token base
  let isBoosted = false;

  if (inputCode) {
    // Validasi Sederhana: Kode harus berakhiran Jam Saat Ini
    // Contoh: BOOST-A1B2C310 (10 adalah jam 10 pagi)
    const currentHour = new Date().getHours().toString();

    if (inputCode.startsWith("BOOST-") && inputCode.endsWith(currentHour)) {
      finalReward *= BOOST_MULTIPLIER;
      isBoosted = true;
    } else {
      return ctx.sock.sendMessage(ctx.from, {
        text: "❌ Kode Hash Kadaluarsa/Salah!\nSilakan ambil kode baru di Website.",
      });
    }
  }

  // 3. Update Data
  user.assets = user.assets || {};
  user.assets.ara_coin = (user.assets.ara_coin || 0) + finalReward;
  user.last_mine_time = now;

  db.save("users", users);

  // 4. Respon
  const market = db.load("market_data");
  const price = market.current_price || 1000;
  const value = finalReward * price;

  let msg = "";
  if (isBoosted) {
    msg =
      `🚀 *BOOSTED MINING SUKSES*\n` +
      `Kode Valid! Anda dapat bonus iklan.\n\n` +
      `⛏️ Hasil: *${finalReward} $ARA* (10x Lipat)\n` +
      `💰 Nilai: Rp ${value.toLocaleString()}\n` +
      `💼 Total Aset: ${user.assets.ara_coin} $ARA`;
  } else {
    msg =
      `⛏️ *MINING BIASA SUKSES*\n` +
      `Hasil: *${finalReward} $ARA*\n\n` +
      `💡 *Tips Cuan:*\n` +
      `Dapatkan hasil *10x LIPAT* dengan mengambil kode hash di website kami!\n` +
      `👉 https://razzaqinspires.github.io/cuankita-market/web/mining.html`;
  }

  await ctx.sock.sendMessage(ctx.from, { text: msg });
}

// ... (Fungsi performDaily biarkan sama) ...
async function performDaily(ctx) {
  // ... (Kode performDaily yang lama) ...
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

  const rewardRp = 5000;
  user.saldo = (user.saldo || 0) + rewardRp;
  user.last_daily_time = now;

  db.save("users", users);

  await ctx.sock.sendMessage(ctx.from, {
    text: `📅 *ABSEN HARIAN*\n\nBonus masuk: Rp ${rewardRp.toLocaleString()}\nSaldo: Rp ${user.saldo.toLocaleString()}`,
  });
}

module.exports = { performMine, performDaily };
