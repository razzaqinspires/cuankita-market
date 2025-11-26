const db = require('../database/core');

// KONFIGURASI PASAR
const FLOOR_PRICE = 50; // 🛡️ Harga mentok bawah (Anti 0)
const CEILING_PRICE = 100000; // Harga mentok atas

function getCurrentPrice() {
    const market = db.load('market_data');
    
    // Inisialisasi Data Pasar
    if (!market.current_price) {
        market.current_price = 1000;
        market.trend = 'STABLE';
        db.save('market_data', market);
    }

    // --- ALGORITMA FLUKTUASI ALAMI ---
    // Hanya berubah jika belum ada intervensi bandar
    if (!market.manual_override) {
        const volatility = 0.05; // 5% naik turun
        const change = 1 + (Math.random() * (volatility * 2) - volatility);
        let newPrice = Math.floor(market.current_price * change);

        // 🛡️ SAFETY NET (Agar tidak hangus/nol)
        if (newPrice < FLOOR_PRICE) newPrice = FLOOR_PRICE;
        if (newPrice > CEILING_PRICE) newPrice = CEILING_PRICE;

        market.current_price = newPrice;
        market.trend = change >= 1 ? '📈 NAIK' : '📉 TURUN';
        
        // Simpan
        db.save('market_data', market);
    } else {
        // Reset manual override setelah satu kali cek (biar kembali alami)
        market.manual_override = false;
        db.save('market_data', market);
    }

    return market;
}

async function performCheckMarket(ctx) {
    const market = getCurrentPrice();
    const users = db.load('users');
    const userTokens = users[ctx.from]?.assets?.ara_coin || 0;

    const caption = `📊 *PASAR SAHAM $ARA*\n` +
                    `---------------------------\n` +
                    `Harga: *Rp ${market.current_price.toLocaleString()}* / token\n` +
                    `Tren: ${market.trend}\n` +
                    `---------------------------\n` +
                    `💼 Dompet: ${userTokens} $ARA\n` +
                    `💵 Nilai: Rp ${(userTokens * market.current_price).toLocaleString()}\n\n` +
                    `_Aset aman. Harga bisa naik/turun, tapi jumlah token tetap._`;

    await ctx.sock.sendMessage(ctx.from, { text: caption });
}

async function performBuyToken(ctx) {
    const amountToken = parseInt(ctx.args[0]);
    if (!amountToken || amountToken <= 0) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Contoh: .buy 10" });

    const market = getCurrentPrice();
    const pricePerToken = market.current_price;
    const totalPrice = amountToken * pricePerToken;

    const users = db.load('users');
    const user = users[ctx.from] || { saldo: 0, assets: {} };
    
    if (user.saldo < totalPrice) {
        return ctx.sock.sendMessage(ctx.from, { text: `❌ Saldo Kurang! Butuh Rp ${totalPrice.toLocaleString()}` });
    }

    user.saldo -= totalPrice;
    user.assets = user.assets || {};
    user.assets.ara_coin = (user.assets.ara_coin || 0) + amountToken; // JUMLAH TOKEN BERTAMBAH

    // Efek Beli: Harga Naik dikit
    market.current_price = Math.floor(market.current_price * 1.02); 
    db.save('market_data', market);
    db.save('users', users);

    await ctx.sock.sendMessage(ctx.from, { text: `✅ *BELI BERHASIL*\nAnda kini punya ${user.assets.ara_coin} $ARA.` });
}

async function performSellToken(ctx) {
    const amountToken = parseInt(ctx.args[0]);
    if (!amountToken || amountToken <= 0) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Contoh: .sell 10" });

    const market = getCurrentPrice();
    const users = db.load('users');
    const user = users[ctx.from];
    const userAssets = user?.assets?.ara_coin || 0;

    if (userAssets < amountToken) {
        return ctx.sock.sendMessage(ctx.from, { text: `❌ Barang kurang! Cuma punya ${userAssets} $ARA` });
    }

    const rawTotal = amountToken * market.current_price;
    const fee = Math.floor(rawTotal * 0.05); // Fee Boss 5%
    const netTotal = rawTotal - fee;

    user.assets.ara_coin -= amountToken; // JUMLAH TOKEN BERKURANG
    user.saldo += netTotal;

    // Efek Jual: Harga Turun dikit
    market.current_price = Math.floor(market.current_price * 0.98);
    // Tapi tetap dijaga Floor Price
    if (market.current_price < FLOOR_PRICE) market.current_price = FLOOR_PRICE;
    
    db.save('market_data', market);
    db.save('users', users);

    await ctx.sock.sendMessage(ctx.from, { text: `✅ *JUAL BERHASIL*\nDapat Duit: Rp ${netTotal.toLocaleString()}` });
}

// --- FITUR BARU: GOD MODE (BANDAR) ---
async function performPumpDump(ctx) {
    // Validasi: Cuma Boss yang bisa (Ganti logic ini dengan cek ID Boss)
    // if (ctx.from !== BOSS_ID) return;

    const action = ctx.args[0]; // pump atau dump
    const percent = parseInt(ctx.args[1]) || 10; // Berapa persen

    const market = db.load('market_data');
    market.current_price = market.current_price || 1000;

    if (action === 'pump') {
        market.current_price = Math.floor(market.current_price * (1 + percent/100));
        market.trend = '🚀 MOON!!';
        await ctx.sock.sendMessage(ctx.from, { text: `📈 BANDAR BERAKSI: Harga dipompa naik ${percent}%!` });
    } else if (action === 'dump') {
        market.current_price = Math.floor(market.current_price * (1 - percent/100));
        market.trend = '🩸 CRASH!!';
        await ctx.sock.sendMessage(ctx.from, { text: `📉 BANDAR BERAKSI: Harga dibanting turun ${percent}%!` });
    }

    // Jaga batas aman
    if (market.current_price < FLOOR_PRICE) market.current_price = FLOOR_PRICE;

    market.manual_override = true; // Tandai agar algoritma alami tidak menimpa langsung
    db.save('market_data', market);
}

module.exports = { performCheckMarket, performBuyToken, performSellToken, performPumpDump };