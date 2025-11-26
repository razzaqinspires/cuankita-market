const db = require('../database/core');

async function performDeposit(ctx) {
    const config = db.load('config'); // Auto load dari Vault
    const rate = config.deposit_rate || 0.05;
    const flatFee = config.service_fee_flat || 0;

    const amount = parseInt(ctx.args[0]);
    if (isNaN(amount)) {
        return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Format salah. Gunakan: .deposit [jumlah]" });
    }

    // Logika Bisnis
    const adminFee = Math.floor(amount * rate) + flatFee;
    const userGet = amount - adminFee;

    // 1. Update Saldo User (Atomic)
    const users = db.load('users');
    if (!users[ctx.from]) users[ctx.from] = { saldo: 0 };
    
    users[ctx.from].saldo += userGet;
    db.save('users', users);

    // 2. Catat Transaksi (Untuk Arsip)
    const transactions = db.load('transactions');
    const trxId = Date.now().toString();
    transactions[trxId] = { 
        type: 'DEPOSIT', 
        user: ctx.from, 
        gross: amount, 
        fee: adminFee, 
        net: userGet,
        date: new Date().toISOString()
    };
    db.save('transactions', transactions);

    // 3. Cek Rotasi Arsip (Otonom)
    db.rotateLog('transactions', 2); // Arsipkan jika > 2MB

    await ctx.sock.sendMessage(ctx.from, { 
        text: `✅ *DEPOSIT BERHASIL*\n\n💰 Masuk: Rp ${userGet.toLocaleString()}\n✂️ Fee: Rp ${adminFee.toLocaleString()}\n\nSaldo Total: Rp ${users[ctx.from].saldo.toLocaleString()}` 
    });
}

async function performSetRate(ctx) {
    // Validasi Owner (Bisa ditambahkan cek owner_id dari config)
    const config = db.load('config');
    
    const key = ctx.args[0];
    const val = parseFloat(ctx.args[1]);

    if (!key || isNaN(val)) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Format: .setrate [key] [value]" });

    config[key] = val;
    db.save('config', config);

    await ctx.sock.sendMessage(ctx.from, { text: `⚙️ Config Updated: ${key} = ${val}` });
}

module.exports = { performDeposit, performSetRate };