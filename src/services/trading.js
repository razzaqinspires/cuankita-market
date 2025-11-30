const db = require('../database/core');
const account = require('../utils/account'); // Helper Dual Wallet

// Konfigurasi Bandar
const MAX_LEVERAGE = 125; // Max Leverage (Bisa diset 20-125x)
const TRADING_FEE = 0.001; // Fee buka posisi 0.1%

// Helper: Ambil harga pasar terkini
function getMarketPrice() {
    return db.load('market_data').current_price || 1000;
}

/**
 * BUKA POSISI (LONG/SHORT)
 * Mendukung Real & Demo Account
 */
async function openPosition(ctx, type) {
    const margin = parseInt(ctx.args[0]); // Modal Margin
    let leverage = parseInt(ctx.args[1]) || 1; // Leverage

    if (!margin || margin < 10000) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Minimal margin Rp 10.000" });
    if (leverage > MAX_LEVERAGE) return ctx.sock.sendMessage(ctx.from, { text: `⚠️ Max leverage ${MAX_LEVERAGE}x!` });
    if (leverage < 1) leverage = 1;

    const users = db.load('users');
    const user = users[ctx.from]; // User pasti ada karena sudah lewat gatekeeper onboarding
    
    // 1. AMBIL DOMPET SESUAI MODE (REAL/DEMO)
    const wallet = account.getWallet(user);

    // 2. CEK SALDO
    if (wallet.balance < margin) {
        return ctx.sock.sendMessage(ctx.from, { 
            text: `❌ Saldo ${wallet.mode} Kurang!\nButuh: Rp ${margin.toLocaleString()}\nPunya: Rp ${wallet.balance.toLocaleString()}` 
        });
    }

    const entryPrice = getMarketPrice();
    const totalSize = margin * leverage; 
    const fee = Math.floor(totalSize * TRADING_FEE);
    const totalDeduct = margin + fee;

    // Cek saldo lagi incase fee bikin kurang
    if (wallet.balance < totalDeduct) {
        return ctx.sock.sendMessage(ctx.from, { text: `❌ Saldo kurang untuk bayar Fee Trading (Rp ${fee.toLocaleString()}).` });
    }
    
    // 3. POTONG SALDO
    user[wallet.balanceKey] -= totalDeduct;

    // 4. SIMPAN POSISI
    const positionId = Date.now().toString().slice(-4); 
    const newPosition = {
        id: positionId,
        type: type, // 'LONG' atau 'SHORT'
        margin: margin,
        leverage: leverage,
        entryPrice: entryPrice,
        size: totalSize,
        timestamp: Date.now()
    };

    // Pastikan array posisi ada
    if (!user[wallet.posKey]) user[wallet.posKey] = [];
    user[wallet.posKey].push(newPosition);
    
    db.save('users', users);

    const icon = type === 'LONG' ? '📈' : '📉';
    await ctx.sock.sendMessage(ctx.from, { 
        text: `${icon} *OPEN ${type} SUKSES (${wallet.mode})*\n\n` +
              `🆔 ID: #${positionId}\n` +
              `💰 Margin: Rp ${margin.toLocaleString()}\n` +
              `🚀 Leverage: ${leverage}x\n` +
              `💎 Size: Rp ${totalSize.toLocaleString()}\n` +
              `🎯 Entry: Rp ${entryPrice}\n` +
              `\n_Hati-hati! Jika rugi >80%, posisi otomatis likuidasi._`
    });
}

/**
 * CEK POSISI SAYA
 * Menampilkan posisi sesuai mode akun aktif
 */
async function checkPositions(ctx) {
    const users = db.load('users');
    const user = users[ctx.from];
    const wallet = account.getWallet(user);
    
    // Ambil posisi dari key yang benar (positions_real / positions_demo)
    const positions = user[wallet.posKey] || [];
    const currentPrice = getMarketPrice();

    if (positions.length === 0) {
        return ctx.sock.sendMessage(ctx.from, { text: `📂 Tidak ada posisi aktif di akun *${wallet.mode}*` });
    }

    let text = `💼 *PORTOFOLIO FUTURES (${wallet.mode})*\nMarket Price: Rp ${currentPrice}\n`;
    
    positions.forEach((pos, index) => {
        // Hitung PNL (Untung/Rugi)
        let pnlPercent = 0;
        
        if (pos.type === 'LONG') {
            const priceDiff = (currentPrice - pos.entryPrice) / pos.entryPrice;
            pnlPercent = priceDiff * pos.leverage * 100;
        } else {
            const priceDiff = (pos.entryPrice - currentPrice) / pos.entryPrice;
            pnlPercent = priceDiff * pos.leverage * 100;
        }

        const pnlRp = Math.floor(pos.margin * (pnlPercent / 100));
        const icon = pnlRp >= 0 ? '🟢' : '🔴';

        text += `\n${index + 1}. *${pos.type} ${pos.leverage}x* (#${pos.id})\n` +
                `   Entry: ${pos.entryPrice} -> Now: ${currentPrice}\n` +
                `   PNL: ${icon} ${pnlPercent.toFixed(2)}% (Rp ${pnlRp.toLocaleString()})\n`;
    });

    text += `\n_Tutup posisi: .close [ID]_`;
    await ctx.sock.sendMessage(ctx.from, { text: text });
}

/**
 * TUTUP POSISI (AMBIL PROFIT/CUT LOSS)
 */
async function closePosition(ctx) {
    const targetId = ctx.args[0];
    if (!targetId) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Masukkan ID posisi. Cek di .positions" });

    const users = db.load('users');
    const user = users[ctx.from];
    const wallet = account.getWallet(user);
    
    const positions = user[wallet.posKey] || [];
    const posIndex = positions.findIndex(p => p.id === targetId);

    if (posIndex === -1) return ctx.sock.sendMessage(ctx.from, { text: `❌ Posisi #${targetId} tidak ditemukan di akun ${wallet.mode}.` });

    const pos = positions[posIndex];
    const currentPrice = getMarketPrice();

    // Hitung Final PNL
    let pnlPercent = 0;
    if (pos.type === 'LONG') {
        pnlPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * pos.leverage;
    } else {
        pnlPercent = ((pos.entryPrice - currentPrice) / pos.entryPrice) * pos.leverage;
    }

    const pnlRp = Math.floor(pos.margin * pnlPercent);
    const returnToWallet = pos.margin + pnlRp;

    // Proteksi Saldo Negatif (Jika rugi melebihi modal, hanya modal yang hilang)
    const finalReturn = returnToWallet > 0 ? returnToWallet : 0; 
    
    // Kembalikan ke saldo yang sesuai
    user[wallet.balanceKey] += finalReturn;
    
    // Hapus posisi
    positions.splice(posIndex, 1);
    
    // Update DB
    db.save('users', users);

    const emoji = pnlRp >= 0 ? '🤑' : '😭';
    const status = pnlRp >= 0 ? 'PROFIT' : 'LOSS';
    
    await ctx.sock.sendMessage(ctx.from, { 
        text: `${emoji} *POSISI DITUTUP (${wallet.mode})*\n\n` +
              `Type: ${pos.type} ${pos.leverage}x\n` +
              `Status: ${status}\n` +
              `PNL: Rp ${pnlRp.toLocaleString()}\n` +
              `\n💰 Saldo dikembalikan: Rp ${finalReturn.toLocaleString()}` 
    });
}

// Wrapper untuk Intent
async function performLong(ctx) { await openPosition(ctx, 'LONG'); }
async function performShort(ctx) { await openPosition(ctx, 'SHORT'); }

module.exports = { performLong, performShort, checkPositions, closePosition };