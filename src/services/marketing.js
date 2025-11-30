const db = require('../database/core');
const account = require('../utils/account');
const { sleep } = require('../utils/helpers'); // Asumsi ada helper sleep
const { generateRandomString } = require('../utils/helpers'); // Asumsi ada helper generateRandomString

// ==========================================
// 1. BROADCAST SYSTEM (ADMIN ONLY)
// ==========================================

/**
 * Mengirim pesan ke semua user yang terdaftar.
 * @param {object} ctx - Konteks pesan
 */
async function performBroadcast(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    // Ambil pesan setelah command .bc
    const message = ctx.text.substring(ctx.text.indexOf(' ') + 1).trim();
    if (!message || message.toLowerCase() === '.bc') {
        return ctx.sock.sendMessage(ctx.from, { text: "Format: .bc [pesan_yang_mau_dikirim]" });
    }

    const users = db.load('users');
    const userJids = Object.keys(users);
    
    await ctx.sock.sendMessage(ctx.from, { 
        text: `⏳ *BROADCAST DIMULAI*\nTotal ${userJids.length} user akan dikirimi pesan...` 
    });

    let successCount = 0;
    
    for (const jid of userJids) {
        try {
            await ctx.sock.sendMessage(jid, { text: `📢 *PENGUMUMAN CUANKITA*\n\n${message}` });
            successCount++;
            await sleep(1000); // Jeda 1 detik untuk menghindari Rate Limit
        } catch (e) {
            console.error(`❌ Gagal BC ke ${jid}: ${e.message}`);
        }
    }

    await ctx.sock.sendMessage(ctx.from, { 
        text: `✅ *BROADCAST SELESAI*\nBerhasil terkirim ke ${successCount} user.` 
    });
}

// ==========================================
// 2. VOUCHER SYSTEM
// ==========================================

/**
 * Membuat kode voucher baru (Admin Only).
 * @param {object} ctx - Konteks pesan
 */
async function performCreateVoucher(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    const amount = parseInt(ctx.args[0]);
    const durationDays = parseInt(ctx.args[1]) || 7; // Default 7 hari

    if (isNaN(amount) || amount < 1000) return ctx.sock.sendMessage(ctx.from, { text: "Format: .createvoucher [jumlah] [hari_aktif]" });

    const vouchers = db.load('vouchers');
    const code = generateRandomString(8).toUpperCase(); // Asumsi helper generateRandomString ada
    const expiryTimestamp = Date.now() + (durationDays * 24 * 60 * 60 * 1000);

    vouchers[code] = {
        amount: amount,
        expiry: expiryTimestamp,
        used_by: [], // Array JID yang sudah menggunakan
        createdBy: ctx.from.split('@')[0]
    };

    db.save('vouchers', vouchers);

    await ctx.sock.sendMessage(ctx.from, { 
        text: `🎁 *VOUCHER BERHASIL DIBUAT*\n\n` +
              `Kode: *${code}*\n` +
              `Nominal: Rp ${amount.toLocaleString()}\n` +
              `Expired: ${new Date(expiryTimestamp).toLocaleDateString()}\n\n` +
              `Perintah Redeem: *.redeem ${code}*`
    });
}

/**
 * Redeem kode voucher (User Command).
 * @param {object} ctx - Konteks pesan
 */
async function performRedeemVoucher(ctx) {
    const users = db.load('users');
    const user = users[ctx.from];
    const voucherCode = ctx.args[0]?.toUpperCase();

    if (!voucherCode) return ctx.sock.sendMessage(ctx.from, { text: "Format: .redeem [kode_voucher]" });

    const vouchers = db.load('vouchers');
    const voucher = vouchers[voucherCode];

    // 1. Validasi Keberadaan
    if (!voucher) return ctx.sock.sendMessage(ctx.from, { text: "❌ Kode voucher tidak ditemukan." });

    // 2. Validasi Kedaluwarsa
    if (Date.now() > voucher.expiry) return ctx.sock.sendMessage(ctx.from, { text: "❌ Kode voucher sudah kedaluwarsa." });

    // 3. Validasi Penggunaan (Sudah pernah dipakai user ini?)
    if (voucher.used_by.includes(ctx.from)) return ctx.sock.sendMessage(ctx.from, { text: "❌ Kode voucher sudah pernah Anda gunakan." });

    // 4. Update Saldo ke Wallet Aktif
    const wallet = account.getWallet(user);
    const amount = voucher.amount;

    user[wallet.balanceKey] += amount;
    
    // 5. Tandai Voucher Sudah Digunakan
    voucher.used_by.push(ctx.from);

    db.save('users', users);
    db.save('vouchers', vouchers);

    await ctx.sock.sendMessage(ctx.from, { 
        text: `🎉 *VOUCHER DITERIMA (${wallet.mode})*\n\n` +
              `Selamat! Anda mendapatkan bonus *Rp ${amount.toLocaleString()}*.\n` +
              `Saldo Anda sekarang: Rp ${user[wallet.balanceKey].toLocaleString()}` 
    });
}


module.exports = { 
    performBroadcast, 
    performCreateVoucher, 
    performRedeemVoucher 
};