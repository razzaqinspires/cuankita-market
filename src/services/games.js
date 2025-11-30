const db = require('../database/core');
const account = require('../utils/account'); // Import Helper Dual Wallet

// --- UTILS ---
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * 1. SLOT MACHINE 🎰
 */
async function performSlot(ctx) {
    const bet = parseInt(ctx.args[0]);
    if (!bet || bet < 1000) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Minimal bet Rp 1.000. Contoh: .slot 5000" });

    const users = db.load('users');
    const user = users[ctx.from];
    
    // Ambil Wallet Sesuai Mode
    const wallet = account.getWallet(user);

    if (wallet.balance < bet) return ctx.sock.sendMessage(ctx.from, { text: `❌ Saldo ${wallet.mode} kurang!` });

    // Potong Saldo
    user[wallet.balanceKey] -= bet;
    db.save('users', users);

    // Animasi
    await ctx.sock.sendMessage(ctx.from, { text: "🎰 *SPINNING...*\n\n[ ❓ | ❓ | ❓ ]" });
    
    const items = ["🍒", "🍋", "🍇", "🍉", "💎", "7️⃣"];
    const reel1 = items[randomInt(0, items.length - 1)];
    const reel2 = items[randomInt(0, items.length - 1)];
    const reel3 = items[randomInt(0, items.length - 1)];

    await sleep(1500);
    
    const resultText = `🎰 *SLOT MACHINE (${wallet.mode})*\n\n[ ${reel1} | ${reel2} | ${reel3} ]\n\n`;
    let winMessage = "";
    let winAmount = 0;

    if (reel1 === reel2 && reel2 === reel3) {
        if (reel1 === "7️⃣") {
            winAmount = bet * 50;
            winMessage = `🔥 *JACKPOT 777!* 🔥\nMenang: Rp ${winAmount.toLocaleString()}`;
        } else if (reel1 === "💎") {
            winAmount = bet * 20;
            winMessage = `💎 *BIG WIN!* 💎\nMenang: Rp ${winAmount.toLocaleString()}`;
        } else {
            winAmount = bet * 5;
            winMessage = `🎉 *WINNER!* 🎉\nMenang: Rp ${winAmount.toLocaleString()}`;
        }
    } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
        winAmount = Math.floor(bet * 1.5);
        winMessage = `✨ *Small Win* (2 Sama)\nMenang: Rp ${winAmount.toLocaleString()}`;
    } else {
        winMessage = `📉 *ZONK!* Coba lagi.`;
    }

    if (winAmount > 0) {
        user[wallet.balanceKey] += winAmount;
        user.xp = (user.xp || 0) + 100;
        db.save('users', users);
    }

    await ctx.sock.sendMessage(ctx.from, { text: resultText + winMessage });
}

/**
 * 2. COIN FLIP 🪙
 */
async function performCoinFlip(ctx) {
    const side = ctx.args[0]?.toLowerCase(); 
    const bet = parseInt(ctx.args[1]);

    if (!['head', 'tail', 'kepala', 'ekor'].includes(side) || !bet || bet < 1000) {
        return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Format: .coin [kepala/ekor] [jumlah]" });
    }

    const users = db.load('users');
    const user = users[ctx.from];
    const wallet = account.getWallet(user);

    if (wallet.balance < bet) return ctx.sock.sendMessage(ctx.from, { text: `❌ Saldo ${wallet.mode} kurang.` });

    user[wallet.balanceKey] -= bet;
    db.save('users', users);

    const result = Math.random() > 0.5 ? 'head' : 'tail';
    const resultIndo = result === 'head' ? 'KEPALA' : 'EKOR';
    const userPick = (side === 'kepala' || side === 'head') ? 'head' : 'tail';

    let text = `🪙 *COIN FLIP*\nMemutar koin...\n\n`;
    await sleep(1000);

    if (userPick === result) {
        const win = bet * 2;
        user[wallet.balanceKey] += win;
        user.xp = (user.xp || 0) + 50;
        db.save('users', users);
        text += `Hasil: *${resultIndo}* ✅\nSelamat! Menang Rp ${win.toLocaleString()}`;
    } else {
        text += `Hasil: *${resultIndo}* ❌\nAnda kalah Rp ${bet.toLocaleString()}`;
    }

    await ctx.sock.sendMessage(ctx.from, { text });
}

/**
 * 3. TEBAK DADU 🎲
 */
async function performDice(ctx) {
    const guess = parseInt(ctx.args[0]);
    const bet = parseInt(ctx.args[1]);

    if (!guess || !bet || guess < 1 || guess > 6) {
        return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Format: .dice [angka 1-6] [taruhan]" });
    }

    const users = db.load('users');
    const user = users[ctx.from];
    const wallet = account.getWallet(user);

    if (wallet.balance < bet) return ctx.sock.sendMessage(ctx.from, { text: `❌ Saldo ${wallet.mode} kurang.` });

    user[wallet.balanceKey] -= bet;
    db.save('users', users);

    const result = randomInt(1, 6);
    let text = `🎲 *DICE ROLL*\nTebakan: ${guess}\n\n`;
    await sleep(1000);
    text += `Dadu keluar... 🎲 *${result}*\n\n`;

    if (guess === result) {
        const win = bet * 5;
        user[wallet.balanceKey] += win;
        user.xp = (user.xp || 0) + 200;
        db.save('users', users);
        text += `🎉 *JACKPOT!* Tebakan Tepat!\nMenang: Rp ${win.toLocaleString()}`;
    } else {
        text += `💩 Salah tebak.`;
    }

    await ctx.sock.sendMessage(ctx.from, { text });
}

module.exports = { performSlot, performCoinFlip, performDice };