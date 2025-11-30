const db = require('../database/core');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ==========================================
// 1. SYSTEM MONITORING
// ==========================================

/**
 * Menampilkan status kesehatan server (RAM, Uptime, OS).
 */
async function performSystemStats(ctx) {
    const uptime = os.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const totalMem = Math.floor(os.totalmem() / 1024 / 1024);
    const freeMem = Math.floor(os.freemem() / 1024 / 1024);
    const usedMem = totalMem - freeMem;
    const platform = os.platform();
    const release = os.release();

    const text = `🖥️ *SYSTEM STATUS*\n` +
                 `-------------------------\n` +
                 `⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s\n` +
                 `💾 RAM: ${usedMem}MB / ${totalMem}MB\n` +
                 `💻 OS: ${platform} ${release}\n` +
                 `🤖 Node.js: ${process.version}\n` +
                 `⚡ PID: ${process.pid}`;

    await ctx.sock.sendMessage(ctx.from, { text });
}

// ==========================================
// 2. DATA BACKUP (OWNER ONLY)
// ==========================================

/**
 * Mengirimkan file database JSON ke WhatsApp Owner.
 */
async function performBackup(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    await ctx.sock.sendMessage(ctx.from, { text: "📦 Sedang memproses backup database..." });

    // Daftar file database yang ada di storage/live
    const files = [
        'users.json', 
        'market_data.json', 
        'config.json', 
        'transactions.json', 
        'products.json', 
        'vouchers.json'
    ];
    
    // Path absolut ke folder storage
    const storagePath = path.resolve(__dirname, '../../storage/live');

    let count = 0;
    for (const file of files) {
        const filePath = path.join(storagePath, file);
        if (fs.existsSync(filePath)) {
            // Kirim sebagai dokumen
            await ctx.sock.sendMessage(ctx.from, {
                document: { url: filePath },
                mimetype: 'application/json',
                fileName: `BACKUP-${file}`
            });
            count++;
        }
    }

    await ctx.sock.sendMessage(ctx.from, { text: `✅ Backup selesai. ${count} file berhasil dikirim.` });
}

// ==========================================
// 3. SECURITY & ACCESS CONTROL
// ==========================================

/**
 * Memblokir user (Banned) agar tidak bisa menggunakan bot.
 * Format: .ban [nomor]
 */
async function performBanUser(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    const targetNum = ctx.args[0];
    if (!targetNum) return ctx.sock.sendMessage(ctx.from, { text: "Format: .ban [nomor_wa]" });

    // Normalisasi nomor ke format JID
    const targetJid = targetNum.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    
    config.banned_users = config.banned_users || [];
    
    if (!config.banned_users.includes(targetJid)) {
        config.banned_users.push(targetJid);
        db.save('config', config);
        await ctx.sock.sendMessage(ctx.from, { text: `🚫 User ${targetNum} berhasil di-BANNED Permanent.` });
    } else {
        await ctx.sock.sendMessage(ctx.from, { text: "User ini sudah ada di daftar banned." });
    }
}

/**
 * Membuka blokir user.
 * Format: .unban [nomor]
 */
async function performUnbanUser(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    const targetNum = ctx.args[0];
    if (!targetNum) return ctx.sock.sendMessage(ctx.from, { text: "Format: .unban [nomor_wa]" });

    const targetJid = targetNum.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

    if (config.banned_users && config.banned_users.includes(targetJid)) {
        config.banned_users = config.banned_users.filter(id => id !== targetJid);
        db.save('config', config);
        await ctx.sock.sendMessage(ctx.from, { text: `✅ User ${targetNum} telah di-UNBAN.` });
    } else {
        await ctx.sock.sendMessage(ctx.from, { text: "User tidak ditemukan di daftar banned." });
    }
}

// ==========================================
// 4. GROUP MANAGEMENT
// ==========================================

/**
 * Mengizinkan Bot merespon di Grup tertentu (Whitelist).
 * Bisa diketik di dalam grup atau via japri dengan ID Grup.
 */
async function performAddGroup(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    let targetGroup = ctx.from;
    
    // Jika command pakai argumen (misal: .addgroup 12345@g.us)
    if (ctx.args[0] && ctx.args[0].includes('@g.us')) {
        targetGroup = ctx.args[0];
    }

    // Validasi apakah ini ID Grup
    if (!targetGroup.endsWith('@g.us')) {
        return ctx.sock.sendMessage(ctx.from, { text: "❌ Perintah ini harus dijalankan di dalam Grup atau masukkan ID Grup yang valid." });
    }

    config.allowed_groups = config.allowed_groups || [];
    
    if (!config.allowed_groups.includes(targetGroup)) {
        config.allowed_groups.push(targetGroup);
        db.save('config', config);
        await ctx.sock.sendMessage(ctx.from, { text: "✅ Grup ini telah diaktifkan (Whitelisted). Bot sekarang akan merespon member." });
    } else {
        await ctx.sock.sendMessage(ctx.from, { text: "Grup ini sudah aktif sebelumnya." });
    }
}

// ==========================================
// 5. MAINTENANCE MODE
// ==========================================

/**
 * Mengaktifkan/Mematikan Mode Maintenance.
 * Jika aktif, bot hanya merespon Owner.
 */
async function performMaintenanceToggle(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    config.maintenance_mode = !config.maintenance_mode;
    db.save('config', config);

    const status = config.maintenance_mode ? "AKTIF 🔴" : "NON-AKTIF 🟢";
    await ctx.sock.sendMessage(ctx.from, { text: `🔧 Maintenance Mode: *${status}*\n(Jika aktif, bot hanya merespon Owner).` });
}

module.exports = { 
    performSystemStats, 
    performBackup, 
    performBanUser, 
    performUnbanUser, 
    performAddGroup,
    performMaintenanceToggle
};