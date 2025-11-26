const db = require("../database/core");
const session = require("../engine/sessionManager");
const drawing = require("../utils/drawing");

// --- CONFIG & HELPERS ---
function getPaymentList() {
  return (
    db.load("config").payment_methods || {
      DANA: "08123456789 (A.n Boss)",
      BCA: "1234567890 (A.n PT Cuan)",
    }
  );
}

// 1. REQUEST DEPOSIT (Langkah 1)
async function performDeposit(ctx) {
  const amount = parseInt(ctx.args[0]);
  if (isNaN(amount) || amount < 10000)
    return ctx.sock.sendMessage(ctx.from, {
      text: "⚠️ Minimal deposit Rp 10.000",
    });

  const methods = getPaymentList();
  let text = `💳 *PILIH METODE PEMBAYARAN*\nNominal: Rp ${amount.toLocaleString()}\n\n`;
  let i = 1;
  const methodKeys = Object.keys(methods);

  methodKeys.forEach((m) => {
    text += `${i}. ${m}\n`;
    i++;
  });

  text += `\n_Balas dengan angka (contoh: 1) untuk memilih._`;

  // Set Session menunggu jawaban angka
  session.setSession(ctx.from, "DEPOSIT_SELECT_METHOD", {
    amount,
    methods: methodKeys,
  });
  await ctx.sock.sendMessage(ctx.from, { text });
}

// 2. HANDLE REPLY USER (Langkah 2 & 3)
async function handleDepositStep(ctx, userSession) {
  // User memilih metode pembayaran
  if (userSession.type === "DEPOSIT_SELECT_METHOD") {
    const choice = parseInt(ctx.text);
    const methodKey = userSession.data.methods[choice - 1];

    if (!methodKey)
      return ctx.sock.sendMessage(ctx.from, {
        text: "⚠️ Pilihan salah. Balas dengan angka yang tersedia.",
      });

    const config = db.load("config");
    const paymentDetail = config.payment_methods[methodKey];
    const trxId = `DEP-${Date.now().toString().slice(-6)}`;
    const amount = userSession.data.amount;

    // LOCK USER: Tidak bisa transaksi lain sampai kirim bukti
    session.setSession(ctx.from, "LOCKED_TRANSACTION", {
      trxId,
      amount,
      method: methodKey,
      startTime: Date.now(),
    });

    const caption =
      `⏳ *MENUNGGU TRANSFER*\n` +
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

// 3. HANDLE UPLOAD BUKTI (Langkah 4)
async function handleProofUpload(ctx, userSession) {
  const isImage = ctx.m.message?.imageMessage;
  if (!isImage)
    return ctx.sock.sendMessage(ctx.from, {
      text: "⚠️ Harap kirim FOTO bukti transfer.",
    });

  const config = db.load("config");
  const ownerJid = config.owner_jid;
  const { trxId, amount, method } = userSession.data;

  // Forward Bukti ke Owner
  const captionForOwner =
    `🔔 *DEPOSIT BARU MENUNGGU ACC*\n\n` +
    `👤 User: ${ctx.from.split("@")[0]}\n` +
    `💰 Nominal: Rp ${amount.toLocaleString()}\n` +
    `🏦 Via: ${method}\n` +
    `🆔 TrxID: ${trxId}\n\n` +
    `_Action:_\n` +
    `.acc ${ctx.from.split("@")[0]} ${amount}\n` +
    `.reject ${ctx.from.split("@")[0]}`;

  await ctx.sock.sendMessage(ownerJid, {
    image: ctx.m.message.imageMessage,
    caption: captionForOwner,
  });

  await ctx.sock.sendMessage(ctx.from, {
    text: "✅ Bukti diterima. Sedang dicek Admin. Mohon tunggu...",
  });

  // Clear session agar user tidak stuck, tapi saldo belum masuk sampai di-ACC
  session.clearSession(ctx.from);
}

// 4. ADMIN: ACC DEPOSIT (Langkah 5)
async function performAccDeposit(ctx) {
  const config = db.load("config");
  if (ctx.from !== config.owner_jid) return;

  const targetNum = ctx.args[0];
  const amount = parseInt(ctx.args[1]);

  if (!targetNum || !amount)
    return ctx.sock.sendMessage(ctx.from, {
      text: "Format: .acc [nomor] [jumlah]",
    });

  const targetJid = targetNum + "@s.whatsapp.net";
  const users = db.load("users");

  if (!users[targetJid]) users[targetJid] = { saldo: 0 };
  const user = users[targetJid];

  // A. Tambah Saldo Utama
  user.saldo = (user.saldo || 0) + amount;
  user.xp = (user.xp || 0) + 500; // Bonus XP
  user.account_type = "REAL"; // Auto switch ke Real Account

  // B. Logika Komisi Referral (1% dari Deposit)
  if (user.referrer_id) {
    const referrerId = user.referrer_id;
    // Cari JID upline berdasarkan kode referral
    const referrerJid = Object.keys(users).find((jid) =>
      jid.startsWith(referrerId),
    );

    if (referrerJid) {
      const commissionRate = 0.01; // 1%
      const commission = Math.floor(amount * commissionRate);

      if (commission > 0) {
        const referrer = users[referrerJid];
        referrer.referral_commission =
          (referrer.referral_commission || 0) + commission;
        referrer.saldo += commission; // Langsung masuk saldo aktif

        // Notif ke Upline
        await ctx.sock.sendMessage(referrerJid, {
          text: `🎉 *KOMISI MASUK!*\nAnda dapat Rp ${commission.toLocaleString()} dari deposit downline Anda!`,
        });
      }
    }
  }

  db.save("users", users);
  session.clearSession(targetJid); // Pastikan user tidak terkunci

  // Notif ke User & Owner
  await ctx.sock.sendMessage(targetJid, {
    text: `✅ *DEPOSIT DITERIMA!*\nSaldo Rp ${amount.toLocaleString()} telah masuk.\nStatus Akun: REAL.`,
  });
  await ctx.sock.sendMessage(ctx.from, {
    text: "✅ Sukses di-acc. Saldo & Komisi terdistribusi.",
  });
}

// 5. ADMIN: REJECT DEPOSIT
async function performRejectDeposit(ctx) {
  const config = db.load("config");
  if (ctx.from !== config.owner_jid) return;

  const targetNum = ctx.args[0];
  if (!targetNum)
    return ctx.sock.sendMessage(ctx.from, { text: "Format: .reject [nomor]" });

  const targetJid = targetNum + "@s.whatsapp.net";

  // Unlock user session
  session.clearSession(targetJid);

  await ctx.sock.sendMessage(targetJid, {
    text: `❌ *DEPOSIT DITOLAK*\nBukti tidak valid atau dana belum masuk mutasi.\nSilakan hubungi Admin jika ini kesalahan.`,
  });
  await ctx.sock.sendMessage(ctx.from, { text: "Deposit ditolak." });
}

// 6. FITUR PROFILE & AKUN
async function performProfile(ctx) {
  const users = db.load("users");
  const user = users[ctx.from] || {
    name: "Guest",
    account_type: "DEMO",
    xp: 0,
  };

  await ctx.sock.sendMessage(ctx.from, {
    text: "🎨 Sedang menggambar kartu profil...",
  });

  // Generate Gambar Profile menggunakan Engine Hybrid
  const buffer = await drawing.createProfileCard(user, ctx.from);

  const caption =
    `Kartu Identitas Investor.\n\n` +
    `Ingin beralih akun?\n` +
    `Reply pesan ini dengan:\n` +
    `👉 *"Switch Real"* untuk Akun Asli\n` +
    `👉 *"Switch Demo"* untuk Akun Latihan`;

  await ctx.sock.sendMessage(ctx.from, { image: buffer, caption: caption });
}

async function performCheckBalance(ctx) {
  const users = db.load("users");
  const user = users[ctx.from] || { saldo: 0, assets: {} };
  const araCoin = user.assets?.ara_coin || 0;

  const market = db.load("market_data");
  const currentPrice = market.current_price || 1000;
  const assetValue = araCoin * currentPrice;
  const totalWealth = user.saldo + assetValue;

  const text =
    `💰 *DOMPET (${user.account_type || "DEMO"})*\n` +
    `---------------------------\n` +
    `💵 Tunai: *Rp ${user.saldo.toLocaleString()}*\n` +
    `💎 Token: *${araCoin.toLocaleString()} $ARA*\n` +
    `   (Valuasi: ± Rp ${assetValue.toLocaleString()})\n` +
    `---------------------------\n` +
    `📊 *Total Kekayaan: Rp ${totalWealth.toLocaleString()}*`;

  await ctx.sock.sendMessage(ctx.from, { text: text });
}

async function performSwitchAccount(ctx) {
  const type = ctx.args[0]?.toUpperCase();
  if (!["REAL", "DEMO"].includes(type))
    return ctx.sock.sendMessage(ctx.from, {
      text: "Pilih: .switch real atau .switch demo",
    });

  const users = db.load("users");
  if (!users[ctx.from]) return;

  users[ctx.from].account_type = type;
  db.save("users", users);

  await ctx.sock.sendMessage(ctx.from, {
    text: `🔄 Berhasil beralih ke akun: *${type}*`,
  });
}

// 7. FITUR REFERRAL
async function performCheckReferral(ctx) {
  const users = db.load("users");
  const user = users[ctx.from];
  // Gunakan nomor HP sebagai kode referral
  const referralId = ctx.from.split("@")[0];

  // Hitung Downline
  const downlines = Object.values(users).filter(
    (u) => u.referrer_id === referralId,
  );

  let msg = `🔗 *SISTEM AFFILIATE CUANKITA*\n\n`;
  msg += `Kode Referral Anda: *${referralId}*\n\n`;
  msg += `👤 Total Downline: *${downlines.length} Investor*\n`;
  msg += `💸 Total Komisi: *Rp ${user.referral_commission?.toLocaleString() || 0}* (Sudah masuk saldo)\n\n`;
  msg += `Ajak teman Anda, suruh mereka ketik:\n`;
  msg += `*👉 .register ${referralId}*\n\n`;
  msg += `*KOMISI:* 1% dari setiap deposit downline!`;

  await ctx.sock.sendMessage(ctx.from, { text: msg });
}

async function performReferralRegistration(ctx) {
  const users = db.load("users");
  const user = users[ctx.from];
  const referrerId = ctx.args[0];

  if (user.referrer_id) {
    return ctx.sock.sendMessage(ctx.from, {
      text: "❌ Anda sudah punya upline.",
    });
  }

  if (!referrerId) {
    return ctx.sock.sendMessage(ctx.from, {
      text: "❌ Format: .register [kode_referral]",
    });
  }

  // Cek Validitas Kode (Cari user yang punya nomor tsb)
  const referrerJid = Object.keys(users).find((jid) =>
    jid.startsWith(referrerId),
  );

  if (!referrerJid || referrerJid === ctx.from) {
    return ctx.sock.sendMessage(ctx.from, {
      text: "❌ Kode referral tidak valid.",
    });
  }

  user.referrer_id = referrerId;
  db.save("users", users);

  await ctx.sock.sendMessage(ctx.from, {
    text: `✅ Sukses mendaftar di bawah upline *${referrerId}*!`,
  });
  // Opsional: Beritahu Upline
  await ctx.sock.sendMessage(referrerJid, {
    text: `👤 Ada downline baru mendaftar: ${ctx.from.split("@")[0]}`,
  });
}

// 8. KONFIGURASI OWNER
async function performSetPayment(ctx) {
  const config = db.load("config");
  if (ctx.from !== config.owner_jid) return;

  const raw = ctx.text.replace(".setpayment ", "");
  const [bank, number] = raw.split("|");

  if (!bank || !number)
    return ctx.sock.sendMessage(ctx.from, {
      text: "Format: .setpayment BANK|NOMOR",
    });

  config.payment_methods = config.payment_methods || {};
  config.payment_methods[bank.trim().toUpperCase()] = number.trim();
  db.save("config", config);

  await ctx.sock.sendMessage(ctx.from, {
    text: "✅ Metode pembayaran ditambahkan.",
  });
}

async function performSetRate(ctx) {
  const config = db.load("config");
  if (ctx.from !== config.owner_jid) return;

  const key = ctx.args[0];
  const val = parseFloat(ctx.args[1]);

  if (!key || isNaN(val))
    return ctx.sock.sendMessage(ctx.from, {
      text: "Format: .setrate [key] [value]",
    });

  config[key] = val;
  db.save("config", config);

  await ctx.sock.sendMessage(ctx.from, {
    text: `⚙️ Config Updated: ${key} = ${val}`,
  });
}

module.exports = {
  performDeposit,
  handleDepositStep,
  handleProofUpload,
  performAccDeposit,
  performRejectDeposit,
  performProfile,
  performCheckBalance,
  performSwitchAccount,
  performCheckReferral,
  performReferralRegistration,
  performSetPayment,
  performSetRate,
};
