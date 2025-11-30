const db = require('../database/core');
const session = require('../engine/sessionManager');
const drawing = require('../utils/drawing');
const account = require('../utils/account'); // Import Helper Dual Wallet

// --- CONFIG PAYMENT HELPER ---
function getPaymentList() {
    return db.load('config').payment_methods || {
        "DANA": "08123456789 (A.n Boss)",
        "BCA": "1234567890 (A.n PT Cuan)",
    };
}

// ==========================================
// 1. DEPOSIT SYSTEM (MANUAL)
// ==========================================

// Request Deposit (Hanya bisa di akun REAL)
async function performDeposit(ctx) {
    const users = db.load('users');
    const user = users[ctx.from];

    // VALIDASI MODE AKUN
    // User tidak boleh deposit ke saldo mainan
    if (user.account_type !== 'REAL') {
        return ctx.sock.sendMessage(ctx.from, {
            text: `🚫 *AKSES DITOLAK*\n\nAnda sedang di mode *DEMO*.\nSwitch ke akun *REAL* dulu untuk deposit.\n\nKetik: .switch real`
        });
    }

    const amount = parseInt(ctx.args[0]);
    if (isNaN(amount) || amount < 10000) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Minimal deposit Rp 10.000" });

    const methods = getPaymentList();
    let text = `💳 *DEPOSIT (REAL ACCOUNT)*\nNominal: Rp ${amount.toLocaleString()}\n\n`;
    let i = 1;
    const methodKeys = Object.keys(methods);
    
    methodKeys.forEach(m => {
        text += `${i}. ${m}\n`;
        i++;
    });

    text += `\n_Balas dengan angka (contoh: 1) untuk memilih._`;

    // Set Session: Menunggu jawaban angka dari user
    session.setSession(ctx.from, 'DEPOSIT_SELECT_METHOD', { amount, methods: methodKeys });
    await ctx.sock.sendMessage(ctx.from, { text });
}

// Handle Reply User (Memilih Metode Pembayaran)
async function handleDepositStep(ctx, userSession) {
    if (userSession.type === 'DEPOSIT_SELECT_METHOD') {
        const choice = parseInt(ctx.text);
        const methodKey = userSession.data.methods[choice - 1];

        if (!methodKey) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Pilihan salah. Balas dengan angka yang tersedia." });

        const config = db.load('config');
        const paymentDetail = config.payment_methods[methodKey];
        const trxId = `DEP-${Date.now().toString().slice(-6)}`;
        const amount = userSession.data.amount;

        // LOCK USER SESSION: User tidak bisa transaksi lain sampai kirim bukti/timeout
        session.setSession(ctx.from, 'LOCKED_TRANSACTION', {
            trxId, amount, method: methodKey, startTime: Date.now()
        });

        const caption = `⏳ *MENUNGGU TRANSFER*\n` +
                        `--------------------------\n` +
                        `Bank/E-Wallet: *${methodKey}*\n` +
                        `Nomor: *${paymentDetail}*\n` +
                        `Total: *Rp ${amount.toLocaleString()}*\n` +
                        `Ref: *${trxId}*\n` +
                        `--------------------------\n` +
                        `⚠️ *INSTRUKSI:*\n` +
                        `1. Transfer sesuai nominal.\n` +
                        `2. Kirim FOTO BUKTI TRANSFER di sini (Reply pesan ini).\n` +
                        `3. Batas waktu 30 Menit.`;

        await ctx.sock.sendMessage(ctx.from, { text: caption });
    }
}

// Handle Upload Bukti (Gambar)
async function handleProofUpload(ctx, userSession) {
    const isImage = ctx.m.message?.imageMessage;
    if (!isImage) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Harap kirim FOTO bukti transfer." });

    const config = db.load('config');
    const ownerJid = config.owner_jid;
    const { trxId, amount, method } = userSession.data;

    // Forward Bukti ke Owner/Admin
    const captionForOwner = `🔔 *DEPOSIT BARU MENUNGGU ACC*\n\n` +
                            `👤 User: ${ctx.from.split('@')[0]}\n` +
                            `💰 Nominal: Rp ${amount.toLocaleString()}\n` +
                            `🏦 Via: ${method}\n` +
                            `🆔 TrxID: ${trxId}\n\n` +
                            `_Action:_\n` +
                            `.acc ${ctx.from.split('@')[0]} ${amount}\n` +
                            `.reject ${ctx.from.split('@')[0]}`;

    await ctx.sock.sendMessage(ownerJid, { 
        image: ctx.m.message.imageMessage, 
        caption: captionForOwner 
    });

    await ctx.sock.sendMessage(ctx.from, { text: "✅ Bukti diterima. Sedang dicek Admin. Mohon tunggu..." });
    
    // Clear session agar user tidak stuck (bisa main demo sambil nunggu)
    session.clearSession(ctx.from);
}

// ==========================================
// 2. ADMIN ACTIONS (OWNER ONLY)
// ==========================================

// ACC Deposit (Masuk ke Saldo REAL)
async function performAccDeposit(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    const targetNum = ctx.args[0]; 
    const amount = parseInt(ctx.args[1]);

    if (!targetNum || !amount) return ctx.sock.sendMessage(ctx.from, { text: "Format: .acc [nomor] [jumlah]" });

    const targetJid = targetNum + '@s.whatsapp.net';
    const users = db.load('users');
    
    // Init user jika belum ada (jarang terjadi di flow deposit)
    if (!users[targetJid]) users[targetJid] = { account_type: 'REAL' };
    const user = users[targetJid];
    
    // A. Update Saldo REAL secara eksplisit
    user.balance_real = (user.balance_real || 0) + amount;
    user.xp = (user.xp || 0) + 500; // Bonus XP
    user.account_type = 'REAL'; // Paksa switch ke Real agar user sadar saldo masuk

    // B. Logika Komisi Referral (1% dari Deposit)
    if (user.referrer_id) {
        const referrerId = user.referrer_id;
        const referrerJid = Object.keys(users).find(jid => jid.startsWith(referrerId));
        
        if (referrerJid) {
            const commission = Math.floor(amount * 0.01); // 1%
            if (commission > 0) {
                const referrer = users[referrerJid];
                referrer.referral_commission = (referrer.referral_commission || 0) + commission;
                // Masuk ke saldo Real Upline langsung
                referrer.balance_real = (referrer.balance_real || 0) + commission; 
                
                await ctx.sock.sendMessage(referrerJid, { 
                    text: `🎉 *KOMISI MASUK!*\nAnda dapat Rp ${commission.toLocaleString()} dari deposit downline.` 
                });
            }
        }
    }

    db.save('users', users);
    session.clearSession(targetJid); // Pastikan user tidak terkunci

    await ctx.sock.sendMessage(targetJid, { text: `✅ *DEPOSIT DITERIMA!*\nSaldo REAL Rp ${amount.toLocaleString()} masuk.` });
    await ctx.sock.sendMessage(ctx.from, { text: "✅ Sukses di-acc." });
}

// Reject Deposit
async function performRejectDeposit(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    const targetNum = ctx.args[0]; 
    if (!targetNum) return ctx.sock.sendMessage(ctx.from, { text: "Format: .reject [nomor]" });

    const targetJid = targetNum + '@s.whatsapp.net';
    
    // Unlock user session
    session.clearSession(targetJid);

    await ctx.sock.sendMessage(targetJid, { text: `❌ *DEPOSIT DITOLAK*\nBukti tidak valid atau dana belum masuk.\nSilakan hubungi Admin jika ini kesalahan.` });
    await ctx.sock.sendMessage(ctx.from, { text: "Deposit ditolak." });
}

// Config Payment Methods
async function performSetPayment(ctx) {
    const config = db.load('config');
    if(ctx.from !== config.owner_jid) return;

    const raw = ctx.text.replace('.setpayment ', '');
    const [bank, number] = raw.split('|');
    if(!bank || !number) return ctx.sock.sendMessage(ctx.from, {text: "Format: .setpayment BANK|NOMOR"});

    config.payment_methods = config.payment_methods || {};
    config.payment_methods[bank.trim().toUpperCase()] = number.trim();
    db.save('config', config);
    
    await ctx.sock.sendMessage(ctx.from, { text: "✅ Metode pembayaran ditambahkan." });
}

// Config Rate/Fee
async function performSetRate(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;
    const key = ctx.args[0];
    const val = parseFloat(ctx.args[1]);
    if (!key || isNaN(val)) return ctx.sock.sendMessage(ctx.from, { text: "Format: .setrate [key] [value]" });
    config[key] = val;
    db.save('config', config);
    await ctx.sock.sendMessage(ctx.from, { text: `⚙️ Config Updated: ${key} = ${val}` });
}

// ==========================================
// 3. ACCOUNT MANAGEMENT & PROFILE
// ==========================================

// Cek Saldo (Sadar Mode Real/Demo via Helper)
async function performCheckBalance(ctx) {
    const users = db.load('users');
    const user = users[ctx.from] || { account_type: 'DEMO' };
    
    // GUNAKAN HELPER UTILS untuk mengambil saldo yg benar sesuai mode
    const wallet = account.getWallet(user);
    
    const araCoin = wallet.assets.ara_coin || 0;
    const market = db.load('market_data');
    const currentPrice = market.current_price || 1000;
    const assetValue = araCoin * currentPrice;
    const totalWealth = wallet.balance + assetValue;

    const text = `💰 *DOMPET (${wallet.mode})*\n` +
                 `---------------------------\n` +
                 `💵 Tunai: *Rp ${wallet.balance.toLocaleString()}*\n` +
                 `💎 Token: *${araCoin.toLocaleString()} $ARA*\n` +
                 `   (Valuasi: ± Rp ${assetValue.toLocaleString()})\n` +
                 `---------------------------\n` +
                 `📊 *Total Kekayaan: Rp ${totalWealth.toLocaleString()}*`;

    await ctx.sock.sendMessage(ctx.from, { text: text });
}

// Switch Account (Real <-> Demo)
async function performSwitchAccount(ctx) {
    const type = ctx.args[0]?.toUpperCase();
    if(!['REAL', 'DEMO'].includes(type)) return ctx.sock.sendMessage(ctx.from, {text: "Pilih: .switch real atau .switch demo"});

    const users = db.load('users');
    const user = users[ctx.from] || {};
    
    // Inisialisasi saldo jika baru pertama kali switch
    if (type === 'DEMO' && user.balance_demo === undefined) {
        user.balance_demo = 500000; // Modal Demo Awal
    }
    if (type === 'REAL' && user.balance_real === undefined) {
        user.balance_real = 0;
    }

    user.account_type = type;
    db.save('users', users);

    await ctx.sock.sendMessage(ctx.from, { text: `🔄 Berhasil beralih ke akun: *${type}*\nKetik .saldo untuk cek dana.` });
}

// Reset Demo (Reset saldo latihan)
async function performResetDemo(ctx) {
    const users = db.load('users');
    const user = users[ctx.from];

    // Cooldown 1 Jam
    const now = Date.now();
    const lastReset = user.last_demo_reset || 0;
    const cooldown = 60 * 60 * 1000; 

    if (now - lastReset < cooldown) {
        const minutesLeft = Math.ceil((cooldown - (now - lastReset)) / 60000);
        return ctx.sock.sendMessage(ctx.from, { text: `⏳ Tunggu ${minutesLeft} menit lagi untuk reset demo.` });
    }

    // Reset Data Demo Saja
    user.balance_demo = 500000; 
    user.assets_demo = {};      
    user.positions_demo = [];   
    user.last_demo_reset = now;
    user.account_type = 'DEMO'; // Paksa pindah ke demo

    db.save('users', users);
    await ctx.sock.sendMessage(ctx.from, { text: "🔄 *AKUN DEMO DI-RESET*\nSaldo latihan kembali ke Rp 500.000." });
}

// Visual Profile Card
async function performProfile(ctx) {
    const users = db.load('users');
    const user = users[ctx.from] || { name: 'Guest', account_type: 'DEMO', xp: 0 };
    
    await ctx.sock.sendMessage(ctx.from, { text: "🎨 Sedang menggambar kartu profil..." });

    // Gambar kartu menggunakan Engine Hybrid
    const buffer = await drawing.createProfileCard(user, ctx.from);
    
    const caption = `Kartu Identitas Investor.\n\n` +
                    `Ingin beralih akun?\n` +
                    `Reply pesan ini dengan:\n` +
                    `👉 *"Switch Real"* untuk Akun Asli\n` +
                    `👉 *"Switch Demo"* untuk Akun Latihan`;

    await ctx.sock.sendMessage(ctx.from, { image: buffer, caption: caption });
}

// ==========================================
// 4. REFERRAL SYSTEM
// ==========================================

// Cek Status Referral
async function performCheckReferral(ctx) {
    const users = db.load('users');
    const user = users[ctx.from];
    // Gunakan nomor HP sebagai kode referral
    const referralId = ctx.from.split('@')[0]; 
    
    const downlines = Object.values(users).filter(u => u.referrer_id === referralId);
    
    let msg = `🔗 *SISTEM AFFILIATE CUANKITA*\n\n`;
    msg += `Kode Referral Anda: *${referralId}*\n\n`;
    msg += `👤 Total Downline: *${downlines.length} Investor*\n`;
    msg += `💸 Komisi Terkumpul: *Rp ${user.referral_commission?.toLocaleString() || 0}* (Sudah masuk saldo)\n\n`;
    msg += `Ajak teman Anda, suruh mereka ketik:\n`;
    msg += `*👉 .register ${referralId}*\n\n`;
    msg += `*KOMISI:* 1% dari setiap deposit downline!`;

    await ctx.sock.sendMessage(ctx.from, { text: msg });
}

// Daftar jadi Downline
async function performReferralRegistration(ctx) {
    const users = db.load('users');
    const user = users[ctx.from];
    const referrerId = ctx.args[0];

    if (user.referrer_id) {
        return ctx.sock.sendMessage(ctx.from, { text: "❌ Anda sudah punya upline." });
    }

    if (!referrerId) {
        return ctx.sock.sendMessage(ctx.from, { text: "❌ Format: .register [kode_referral]" });
    }

    // Cek Validitas Kode (Cari user yang punya nomor tsb)
    const referrerJid = Object.keys(users).find(jid => jid.startsWith(referrerId));
    
    if (!referrerJid || referrerJid === ctx.from) {
        return ctx.sock.sendMessage(ctx.from, { text: "❌ Kode referral tidak valid (Tidak ditemukan atau kode sendiri)." });
    }

    user.referrer_id = referrerId;
    db.save('users', users);

    await ctx.sock.sendMessage(ctx.from, { text: `✅ Berhasil mendaftar di bawah *${referrerId}*! Selamat berinvestasi.` });
    // Beritahu Upline
    await ctx.sock.sendMessage(referrerJid, { text: `👤 Downline baru mendaftar: ${ctx.from.split('@')[0]}` });
}

module.exports = { 
    performDeposit, handleDepositStep, handleProofUpload, 
    performAccDeposit, performRejectDeposit,
    performProfile, performCheckBalance, performSwitchAccount, performResetDemo,
    performCheckReferral, performReferralRegistration,
    performSetPayment, performSetRate
};