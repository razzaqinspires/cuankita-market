const db = require('../database/core');
const registry = require('../engine/commandRegistry'); 

// 1. MENU OTOMATIS (DYNAMIC & PERSONALIZED)
async function performMenu(ctx) {
    const config = db.load('config');
    const users = db.load('users');
    const user = users[ctx.from]; // Ambil data user dari database

    // LOGIKA SAPAAN
    let greetingName = ctx.sender.split('@')[0]; // Default: Nomor HP
    let ownerBadge = "";

    // Cek apakah user sudah register
    if (user && user.name) {
        greetingName = user.name;
    }

    // Cek apakah ini Owner
    if (ctx.from === config.owner_jid) {
        ownerBadge = " 👑 [OWNER]";
        // Jika owner belum set nama di database, panggil Boss
        if (greetingName === ctx.sender.split('@')[0]) greetingName = "Big Boss";
    }

    const categorizedCommands = registry.getCategorizedCommands();
    
    // Hitung total fitur
    let totalCommands = 0;
    Object.values(categorizedCommands).forEach(list => totalCommands += list.length);

    let text = `🤖 *CUANKITA SYSTEM v${config.system_version}*\n`;
    text += `👋 Halo, *${greetingName}*${ownerBadge}\n`;
    text += `_Total ${totalCommands} fitur siap digunakan._\n`;

    // Loop Kategori
    for (const category in categorizedCommands) {
        text += `\n*${category.toUpperCase()}*\n`; 
        categorizedCommands[category].forEach(cmd => {
            text += `.${cmd.rawCommand} ${cmd.args} - ${cmd.description}\n`;
        });
    }

    text += `\n_Ketik perintah tanpa tanda kurung._\n`;
    text += `_Powered by Intent-Aware Engine_`;
    
    await ctx.sock.sendMessage(ctx.from, { text: text.trim() });
}

// 2. INFO OWNER
async function performOwnerInfo(ctx) {
    const config = db.load('config');
    const ownerNum = config.owner_jid ? config.owner_jid.split('@')[0] : '-';
    
    await ctx.sock.sendMessage(ctx.from, { 
        text: `👑 *OWNER INFO*\n\nNomor: wa.me/${ownerNum}\nStatus: Developer & Bandar Pasar\n\n_Hubungi Owner untuk Deposit/Withdraw atau kerjasama._`
    });
}

// 3. PING
async function performPing(ctx) {
    const start = Date.now();
    await ctx.sock.sendMessage(ctx.from, { text: '🏓 Pong!' });
    const latensi = Date.now() - start;
    await ctx.sock.sendMessage(ctx.from, { text: `Kecepatan Respon: ${latensi}ms` });
}

// 4. LEADERBOARD (FIX DISPLAY NAME)
async function performLeaderboard(ctx) {
    const users = db.load('users');
    const market = db.load('market_data');
    const price = market.current_price || 1000;

    const rankings = [];

    Object.keys(users).forEach(jid => {
        const u = users[jid];
        const saldo = u.balance_real || 0;
        const assets = (u.assets_real?.ara_coin || 0) * price;
        const totalWealth = saldo + assets;

        if (totalWealth > 0) {
            rankings.push({
                jid: jid,
                // Gunakan nama asli jika ada, fallback ke nomor
                tag: u.name || jid.split('@')[0], 
                wealth: totalWealth
            });
        }
    });

    rankings.sort((a, b) => b.wealth - a.wealth);
    const top10 = rankings.slice(0, 10);

    let text = `🏆 *TOP 10 SULTAN CUANKITA (REAL)* 🏆\n`;
    text += `_Kekayaan dihitung dari Saldo Tunai + Aset Token_\n\n`;

    if (top10.length === 0) {
        text += "_Belum ada data Sultan._";
    } else {
        top10.forEach((sultan, index) => {
            let medal = '';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            else medal = `${index + 1}.`;

            text += `${medal} *${sultan.tag}*\n   💰 Rp ${sultan.wealth.toLocaleString('id-ID')}\n`;
        });
    }

    const myIndex = rankings.findIndex(x => x.jid === ctx.from);
    if (myIndex !== -1) {
        const myData = rankings[myIndex];
        text += `\n---------------------------\n`;
        text += `🫵 Posisi Anda: Peringkat #${myIndex + 1}\n`;
        text += `Total Kekayaan: Rp ${myData.wealth.toLocaleString('id-ID')}`;
    }

    await ctx.sock.sendMessage(ctx.from, { text: text });
}

module.exports = { 
    performMenu, 
    performOwnerInfo, 
    performPing, 
    performLeaderboard 
};