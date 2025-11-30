const db = require('../database/core');
const account = require('../utils/account'); // Import Helper Dual Wallet

// Konfigurasi Mining
const BASE_REWARD = 1; // Reward malas (cuma ketik .mine)
const BOOST_MULTIPLIER = 10; // Reward rajin (buka web)
const COOLDOWN_MINUTES = 60;

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes} menit ${seconds} detik`;
}

/**
 * MINING TOKEN $ARA
 * Mendukung Real & Demo Wallet
 */
async function performMine(ctx) {
    const users = db.load('users');
    const user = users[ctx.from] || { account_type: 'DEMO' }; // Fallback
    
    // 1. Cek Cooldown
    const lastMine = user.last_mine_time || 0;
    const now = Date.now();
    const diff = now - lastMine;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

    if (diff < cooldownMs) {
        const timeLeft = cooldownMs - diff;
        return ctx.sock.sendMessage(ctx.from, { 
            text: `⏳ *MESIN PANAS*\nIstirahat dulu Boss.\n\nBisa nambang lagi dalam:\n*${formatDuration(timeLeft)}*` 
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
        
        if (inputCode.startsWith('BOOST-') && inputCode.endsWith(currentHour)) {
            finalReward *= BOOST_MULTIPLIER;
            isBoosted = true;
        } else {
            return ctx.sock.sendMessage(ctx.from, { text: "❌ Kode Hash Kadaluarsa/Salah!\nSilakan ambil kode baru di Website." });
        }
    }

    // 3. Update Aset ke Wallet yang Benar
    const wallet = account.getWallet(user);
    
    // Init object assets jika belum ada
    if (!user[wallet.assetKey]) user[wallet.assetKey] = {};
    
    // Tambah Token
    user[wallet.assetKey].ara_coin = (user[wallet.assetKey].ara_coin || 0) + finalReward;
    user.last_mine_time = now;
    
    db.save('users', users);

    // 4. Respon dengan Valuasi
    const market = db.load('market_data');
    const price = market.current_price || 1000;
    const value = finalReward * price;
    const currentTotal = user[wallet.assetKey].ara_coin;

    let msg = '';
    if (isBoosted) {
        msg = `🚀 *BOOSTED MINING SUKSES (${wallet.mode})*\n` +
              `Kode Valid! Anda dapat bonus iklan.\n\n` +
              `⛏️ Hasil: *${finalReward} $ARA* (10x Lipat)\n` +
              `💰 Nilai: Rp ${value.toLocaleString()}\n` +
              `💼 Total Aset: ${currentTotal} $ARA`;
    } else {
        msg = `⛏️ *MINING BIASA SUKSES (${wallet.mode})*\n` +
              `Hasil: *${finalReward} $ARA*\n\n` +
              `💡 *Tips Cuan:*\n` +
              `Dapatkan hasil *10x LIPAT* dengan mengambil kode hash di website kami!\n` +
              `👉 https://razzaqinspires.github.io/cuankita-market/web/mining.html`;
    }

    await ctx.sock.sendMessage(ctx.from, { text: msg });
}

/**
 * DAILY CLAIM (Bonus Harian)
 * Masuk ke Saldo Tunai sesuai Mode Akun
 */
async function performDaily(ctx) {
    const users = db.load('users');
    const user = users[ctx.from] || { account_type: 'DEMO' };
    
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const lastDaily = user.last_daily_time || 0;

    if (now - lastDaily < oneDay) {
        // Hitung sisa waktu
        const nextClaim = lastDaily + oneDay;
        const timeLeft = nextClaim - now;
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        return ctx.sock.sendMessage(ctx.from, { text: `❌ Absen harian sudah diambil.\nKembali lagi dalam ${hours} jam ${minutes} menit.` });
    }

    const rewardRp = 5000; 
    
    // Ambil Wallet
    const wallet = account.getWallet(user);
    
    // Tambah Saldo
    user[wallet.balanceKey] += rewardRp;
    user.last_daily_time = now;
    
    db.save('users', users);

    await ctx.sock.sendMessage(ctx.from, { 
        text: `📅 *ABSEN HARIAN (${wallet.mode})*\n\n` +
              `Bonus masuk: Rp ${rewardRp.toLocaleString()}\n` +
              `Saldo Sekarang: Rp ${user[wallet.balanceKey].toLocaleString()}` 
    });
}

module.exports = { performMine, performDaily };