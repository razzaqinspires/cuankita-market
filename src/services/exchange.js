const db = require('../database/core');
const drawing = require('../utils/drawing'); // Import Visual Engine
const account = require('../utils/account'); // Helper Pemisah Akun

// --- KONFIGURASI PASAR ---
const FLOOR_PRICE = 50; // Harga terendah (Anti 0)
const CEILING_PRICE = 100000; // Harga tertinggi (Optional Cap)

/**
 * ALGORITMA HARGA DINAMIS
 * Menghasilkan harga baru berdasarkan volatilitas random atau intervensi bandar.
 */
function getCurrentPrice() {
    const market = db.load('market_data');
    
    // Inisialisasi jika data kosong
    if (!market.current_price) {
        market.current_price = 1000;
        market.trend = 'STABLE';
        market.total_supply = 100000;
        db.save('market_data', market);
    }

    // Logika Fluktuasi Alami (Hanya jalan jika tidak ada manual override dari Bandar)
    if (!market.manual_override) {
        const volatility = 0.05; // 5% swing max
        // Random change antara -5% sampai +5%
        const change = 1 + (Math.random() * (volatility * 2) - volatility);
        let newPrice = Math.floor(market.current_price * change);

        // Safety Net (Batas Bawah & Atas)
        if (newPrice < FLOOR_PRICE) newPrice = FLOOR_PRICE;
        if (newPrice > CEILING_PRICE) newPrice = CEILING_PRICE;

        market.current_price = newPrice;
        market.trend = change >= 1 ? '📈 NAIK' : '📉 TURUN';
        market.last_updated = Date.now();
        
        db.save('market_data', market);
    } else {
        // Reset flag manual setelah satu siklus, agar pasar kembali bergerak alami
        market.manual_override = false;
        db.save('market_data', market);
    }

    return market;
}

/**
 * SISTEM LIKUIDASI (FUTURES PROTECTOR)
 * Mengecek semua posisi user (Real & Demo). Jika rugi > 80%, posisi dihapus paksa.
 * Dipanggil setiap kali harga berubah (Beli/Jual/Pump/Dump).
 */
function checkLiquidation(currentPrice) {
    const users = db.load('users');
    let hasChanges = false;

    Object.keys(users).forEach(userJid => {
        const user = users[userJid];
        
        // Cek kedua tipe posisi (Real & Demo) karena harga pasar mempengaruhi keduanya
        ['positions_real', 'positions_demo'].forEach(posKey => {
            const positions = user[posKey];
            if (!positions || positions.length === 0) return;

            // Loop mundur agar aman saat menghapus array (splice)
            for (let i = positions.length - 1; i >= 0; i--) {
                const pos = positions[i];
                let pnlPercent = 0;

                if (pos.type === 'LONG') {
                    // Long: Rugi jika harga turun
                    pnlPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * pos.leverage;
                } else {
                    // Short: Rugi jika harga naik
                    pnlPercent = ((pos.entryPrice - currentPrice) / pos.entryPrice) * pos.leverage;
                }

                // Threshold Likuidasi: Rugi 80% (-0.8) atau lebih
                if (pnlPercent <= -0.8) {
                    console.log(`☠️ LIQUIDATION: User ${userJid} posisi ${posKey} #${pos.id} hangus.`);
                    positions.splice(i, 1); // Hapus posisi (Uang Margin Hangus)
                    hasChanges = true;
                }
            }
        });
    });

    if (hasChanges) db.save('users', users);
}

/**
 * 1. CEK PASAR (VISUAL CHART)
 * Mengirim gambar grafik alih-alih teks biasa.
 */
async function performCheckMarket(ctx) {
    const market = getCurrentPrice();
    const users = db.load('users');
    const user = users[ctx.from] || { account_type: 'DEMO' };
    
    // GUNAKAN HELPER ACCOUNT untuk menampilkan aset sesuai mode aktif
    const wallet = account.getWallet(user);
    const userTokens = wallet.assets.ara_coin || 0;
    const valuation = userTokens * market.current_price;

    await ctx.sock.sendMessage(ctx.from, { text: "⏳ Sedang menggambar chart realtime..." });

    // Generate Chart Image (Hybrid Rendering Skia+Resvg)
    try {
        const buffer = await drawing.createMarketChart();
        
        const caption = `📊 *MARKET OVERVIEW (${wallet.mode})*\n` +
                        `---------------------------\n` +
                        `Harga: *Rp ${market.current_price.toLocaleString()}*\n` +
                        `Tren: ${market.trend}\n` +
                        `---------------------------\n` +
                        `💼 Aset Anda: *${userTokens.toLocaleString()} $ARA*\n` +
                        `💵 Valuasi: *Rp ${valuation.toLocaleString()}*\n` +
                        `---------------------------\n` +
                        `_Ketik .buy atau .sell untuk transaksi._\n` +
                        `_Pantau Live di Web: https://razzaqinspires.github.io/cuankita-market/web/ _`; // Ganti URL sesuai repo Boss

        await ctx.sock.sendMessage(ctx.from, { 
            image: buffer, 
            caption: caption 
        });
    } catch (e) {
        console.error("Gagal kirim gambar:", e);
        // Fallback teks jika gambar gagal
        await ctx.sock.sendMessage(ctx.from, { 
            text: `📊 Harga: Rp ${market.current_price.toLocaleString()}\nTren: ${market.trend}` 
        });
    }
}

/**
 * 2. BELI TOKEN (SPOT) - SADAR MODE
 */
async function performBuy(ctx) {
    const amountToken = parseInt(ctx.args[0]);
    if (!amountToken || amountToken <= 0) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Contoh: .buy 10" });

    const market = getCurrentPrice();
    const totalPrice = amountToken * market.current_price;

    const users = db.load('users');
    const user = users[ctx.from] || { account_type: 'DEMO' }; // Fallback safety
    
    // Ambil Wallet yang sesuai (Real/Demo)
    const wallet = account.getWallet(user);
    
    // Validasi Saldo
    if (wallet.balance < totalPrice) {
        return ctx.sock.sendMessage(ctx.from, { 
            text: `❌ Saldo ${wallet.mode} Kurang!\nButuh: Rp ${totalPrice.toLocaleString()}\nPunya: Rp ${wallet.balance.toLocaleString()}` 
        });
    }

    // Eksekusi Transaksi (Update via reference object user)
    // 1. Kurangi Saldo
    user[wallet.balanceKey] -= totalPrice;
    
    // 2. Tambah Aset (Init object assets jika belum ada)
    if (!user[wallet.assetKey]) user[wallet.assetKey] = {};
    user[wallet.assetKey].ara_coin = (user[wallet.assetKey].ara_coin || 0) + amountToken;

    // 3. Efek Pasar (Hanya akun REAL yang menggerakkan pasar signifikan)
    if (wallet.mode === 'REAL') {
        // Real buy pushes price up 2%
        market.current_price = Math.floor(market.current_price * 1.02); 
        db.save('market_data', market);
    }
    
    db.save('users', users);
    
    // Cek likuidasi user lain akibat perubahan harga ini
    checkLiquidation(market.current_price);

    await ctx.sock.sendMessage(ctx.from, { 
        text: `✅ *BELI BERHASIL (${wallet.mode})*\n+ ${amountToken.toLocaleString()} $ARA\n- Rp ${totalPrice.toLocaleString()}` 
    });
}

/**
 * 3. JUAL TOKEN (SPOT) - SADAR MODE
 */
async function performSell(ctx) {
    const amountToken = parseInt(ctx.args[0]);
    if (!amountToken || amountToken <= 0) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Contoh: .sell 10" });

    const market = getCurrentPrice();
    const users = db.load('users');
    const user = users[ctx.from];
    
    // Ambil Wallet yang sesuai
    const wallet = account.getWallet(user);
    const userAssets = wallet.assets.ara_coin || 0;

    if (userAssets < amountToken) {
        return ctx.sock.sendMessage(ctx.from, { text: `❌ Token ${wallet.mode} kurang! Cuma punya ${userAssets} $ARA` });
    }

    const rawTotal = amountToken * market.current_price;
    const fee = Math.floor(rawTotal * 0.05); // Fee Boss 5% dari penjualan
    const netTotal = rawTotal - fee;

    // Eksekusi Transaksi
    user[wallet.assetKey].ara_coin -= amountToken;
    user[wallet.balanceKey] += netTotal;

    // Efek Pasar
    if (wallet.mode === 'REAL') {
        // Real sell pushes price down 2%
        market.current_price = Math.floor(market.current_price * 0.98);
        if (market.current_price < FLOOR_PRICE) market.current_price = FLOOR_PRICE;
        db.save('market_data', market);
    }
    
    db.save('users', users);
    checkLiquidation(market.current_price);

    await ctx.sock.sendMessage(ctx.from, { 
        text: `✅ *JUAL BERHASIL (${wallet.mode})*\n- ${amountToken.toLocaleString()} $ARA\n💰 Dapat: Rp ${netTotal.toLocaleString()}\n(Fee 5%: Rp ${fee.toLocaleString()})` 
    });
}

/**
 * 4. LEADERBOARD (TOP 10 SULTAN REAL)
 * Hanya menampilkan kekayaan REAL untuk menjaga gengsi dan menghindari inflasi demo.
 */
async function performLeaderboardCheck(ctx) {
    const users = db.load('users');
    const market = getCurrentPrice();
    const currentPrice = market.current_price;
    
    const rankings = [];

    // Hitung Kekayaan
    for (const jid in users) {
        const user = users[jid];
        // Paksa ambil Real Balance & Asset
        const saldoReal = user.balance_real || 0;
        const assetReal = user.assets_real?.ara_coin || 0;
        
        const totalWealth = saldoReal + (assetReal * currentPrice);
        
        // Hanya yang punya kekayaan Real > 0 yang masuk list
        if (totalWealth > 0) {
            rankings.push({
                name: user.name || jid.split('@')[0],
                wealth: totalWealth,
                jid: jid
            });
        }
    }

    // Sortir Descending
    rankings.sort((a, b) => b.wealth - a.wealth);

    let msg = `🏆 *TOP 10 SULTAN CUANKITA (REAL ONLY)*\n`;
    msg += `_Wealth per Rp ${currentPrice.toLocaleString()} $ARA_\n`;
    msg += `-------------------------------------------------\n`;

    const displayCount = Math.min(10, rankings.length);
    if (displayCount === 0) {
        msg += "_Belum ada Sultan Real. Jadilah yang pertama!_";
    }

    for (let i = 0; i < displayCount; i++) {
        const rank = rankings[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        
        msg += `${medal} ${rank.name.padEnd(15)}: *Rp ${rank.wealth.toLocaleString('id-ID')}*\n`;
    }
    
    // Posisi User Sendiri (Cek di list Real)
    const userRank = rankings.findIndex(r => r.jid === ctx.from) + 1;
    const userWealth = rankings.find(r => r.jid === ctx.from)?.wealth || 0;

    msg += `-------------------------------------------------\n`;
    if (userRank > 0) {
        msg += `💎 Posisi Anda: #${userRank} (Rp ${userWealth.toLocaleString()})\n`;
    } else {
        msg += `💎 Posisi Anda: Belum masuk peringkat (Saldo Real 0)\n`;
    }

    await ctx.sock.sendMessage(ctx.from, { text: msg });
}

/**
 * 5. COMMAND KHUSUS OWNER (BANDAR PUMP/DUMP)
 * Mengubah harga secara paksa.
 */
async function performPumpDump(ctx) {
    const config = db.load('config');
    
    // Validasi Owner JID
    if (ctx.from !== config.owner_jid) {
        return ctx.sock.sendMessage(ctx.from, { text: "❌ Perintah ini hanya untuk Boss." });
    }

    const action = ctx.args[0]?.toLowerCase();
    const amount = parseFloat(ctx.args[1]);

    if (!['pump', 'dump'].includes(action) || isNaN(amount)) {
        return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Format: .bandar pump 10" });
    }

    const market = db.load('market_data');
    let newPrice = market.current_price || 1000;

    if (action === 'pump') {
        newPrice *= (1 + amount / 100);
        market.trend = `🚀 PUMP (${amount}%)`;
    } else {
        newPrice *= (1 - amount / 100);
        market.trend = `🩸 DUMP (${amount}%)`;
        if (newPrice < FLOOR_PRICE) newPrice = FLOOR_PRICE;
    }

    market.current_price = Math.round(newPrice);
    market.manual_override = true; // Kunci harga agar tidak ditimpa algoritma alami sesaat
    market.last_updated = Date.now();
    
    db.save('market_data', market);
    
    // Cek korban likuidasi akibat manipulasi harga
    checkLiquidation(market.current_price); 

    await ctx.sock.sendMessage(ctx.from, { 
        text: `✅ [BANDAR] Harga dimanipulasi ke Rp ${market.current_price.toLocaleString()} (${market.trend})` 
    });
}

module.exports = { 
    performCheckMarket, 
    performBuy, 
    performSell, 
    performLeaderboardCheck,
    performPumpDump 
};