const db = require("../database/core");
const session = require("../engine/sessionManager");
const { delay } = require("@whiskeysockets/baileys");

/**
 * MARKETING & CONTROL MODULE
 * Fitur: Broadcast Tersegmen & Voucher System
 */

// --- UTILS ---
// Jeda waktu acak antara min dan max detik (Anti-Ban)
const randomDelay = (min, max) =>
  new Promise((resolve) =>
    setTimeout(resolve, Math.random() * (max - min) + min),
  );

// 1. BROADCAST ENGINE (HANYA OWNER)
async function performBroadcast(ctx) {
  const config = db.load("config");
  if (ctx.from !== config.owner_jid)
    return ctx.sock.sendMessage(ctx.from, { text: "❌ Akses Ditolak." });

  // Format: .bc [target] [pesan]
  // Target: all, real, demo, whales (saldo > 10jt)
  const target = ctx.args[0]?.toLowerCase();
  const message = ctx.args.slice(1).join(" ");

  if (!target || !message) {
    return ctx.sock.sendMessage(ctx.from, {
      text: "⚠️ Format: .bc [target] [pesan]\n\nTarget:\n- all (Semua User)\n- real (Akun Real)\n- demo (Akun Demo)\n- whales (Sultan > 10jt)",
    });
  }

  const users = db.load("users");
  let targets = [];

  // Filter Target
  Object.keys(users).forEach((jid) => {
    const u = users[jid];
    if (target === "all") targets.push(jid);
    else if (target === "real" && u.account_type === "REAL") targets.push(jid);
    else if (target === "demo" && u.account_type === "DEMO") targets.push(jid);
    else if (
      target === "whales" &&
      u.saldo + (u.assets?.ara_coin || 0) * 1000 > 10000000
    )
      targets.push(jid);
  });

  if (targets.length === 0)
    return ctx.sock.sendMessage(ctx.from, {
      text: "⚠️ Tidak ada user yang sesuai target.",
    });

  await ctx.sock.sendMessage(ctx.from, {
    text: `📢 Memulai Broadcast ke ${targets.length} user...\nEstimasi waktu: ${targets.length * 3} detik.`,
  });

  // EKSEKUSI BROADCAST (DENGAN DELAY)
  let success = 0;
  for (const jid of targets) {
    try {
      // Cek apakah ada gambar yang dilampirkan (Quoted Image atau Image Message)
      if (ctx.m.message?.imageMessage || ctx.quoted?.type === "imageMessage") {
        // Logic forward gambar agak kompleks, kita kirim teks dulu untuk versi ini
        // Atau kirim teks biasa
        await ctx.sock.sendMessage(jid, {
          text: `📢 *INFORMASI RESMI*\n\n${message}\n\n_~ Management Cuankita_`,
        });
      } else {
        await ctx.sock.sendMessage(jid, {
          text: `📢 *INFORMASI RESMI*\n\n${message}\n\n_~ Management Cuankita_`,
        });
      }
      success++;
      // Jeda 2-5 detik per pesan agar aman
      await randomDelay(2000, 5000);
    } catch (e) {
      console.log(`Gagal kirim ke ${jid}`);
    }
  }

  await ctx.sock.sendMessage(ctx.from, {
    text: `✅ Broadcast Selesai.\nSukses: ${success}/${targets.length}`,
  });
}

// 2. BUAT VOUCHER (BAGI-BAGI DUIT)
async function performCreateVoucher(ctx) {
  const config = db.load("config");
  if (ctx.from !== config.owner_jid) return;

  const amount = parseInt(ctx.args[0]);
  const quota = parseInt(ctx.args[1]) || 1; // Berapa orang bisa klaim

  if (!amount)
    return ctx.sock.sendMessage(ctx.from, {
      text: "Format: .voucher [nominal] [kuota]",
    });

  const code = `GIFT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Simpan ke Config (atau file voucher terpisah, tapi config oke utk MVP)
  config.vouchers = config.vouchers || {};
  config.vouchers[code] = {
    amount: amount,
    quota: quota,
    claimed_by: [],
  };
  db.save("config", config);

  await ctx.sock.sendMessage(ctx.from, {
    text: `🎫 *VOUCHER DIBUAT*\n\nKode: *${code}*\nIsi: Rp ${amount.toLocaleString()}\nKuota: ${quota} orang\n\n_Sebarkan kode ini ke grup/channel!_`,
  });
}

// 3. REDEEM VOUCHER (UNTUK USER)
async function performRedeem(ctx) {
  const code = ctx.args[0]?.toUpperCase();
  if (!code)
    return ctx.sock.sendMessage(ctx.from, {
      text: "⚠️ Masukkan kode. Contoh: .redeem GIFT-XYZ",
    });

  const config = db.load("config");
  const voucher = config.vouchers?.[code];

  // Validasi Voucher
  if (!voucher)
    return ctx.sock.sendMessage(ctx.from, {
      text: "❌ Kode tidak valid / sudah hangus.",
    });
  if (voucher.quota <= 0)
    return ctx.sock.sendMessage(ctx.from, {
      text: "❌ Yah... Kuota voucher habis!",
    });
  if (voucher.claimed_by.includes(ctx.from))
    return ctx.sock.sendMessage(ctx.from, {
      text: "❌ Anda sudah klaim voucher ini.",
    });

  // Eksekusi Klaim
  const users = db.load("users");
  const user = users[ctx.from] || { saldo: 0 };

  user.saldo += voucher.amount;
  voucher.quota -= 1;
  voucher.claimed_by.push(ctx.from);

  // Hapus jika habis
  if (voucher.quota <= 0) delete config.vouchers[code];
  else config.vouchers[code] = voucher;

  db.save("config", config);
  db.save("users", users);

  await ctx.sock.sendMessage(ctx.from, {
    text: `🎉 *KLAIM SUKSES!*\n\nSelamat! Anda mendapatkan Rp ${voucher.amount.toLocaleString()}.\nSaldo sekarang: Rp ${user.saldo.toLocaleString()}`,
  });
}

module.exports = { performBroadcast, performCreateVoucher, performRedeem };
