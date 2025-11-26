const db = require("../database/core");
const session = require("../engine/sessionManager");
const moment = require("moment");

// Triggered jika user belum ada di database
async function startOnboarding(ctx) {
  await ctx.sock.sendMessage(ctx.from, {
    text:
      `👋 Selamat Datang di *Cuankita Private Ecosystem*.\n\n` +
      `Sebelum memulai investasi, kami perlu mengenal Anda.\n` +
      `Siapa nama panggilan Anda?`,
  });
  session.setSession(ctx.from, "ONBOARDING_NAME", {});
}

// Handler jawaban user
async function handleOnboarding(ctx, userSession) {
  const step = userSession.type;
  const input = ctx.text.trim();

  // STEP 1: NAMA
  if (step === "ONBOARDING_NAME") {
    const temp = { name: input };
    session.setSession(ctx.from, "ONBOARDING_GENDER", temp);
    await ctx.sock.sendMessage(ctx.from, {
      text: `Halo ${input}. Apa jenis kelamin Anda? (L/P)`,
    });
  }

  // STEP 2: GENDER
  else if (step === "ONBOARDING_GENDER") {
    const gender = input.toUpperCase() === "L" ? "Laki-laki" : "Perempuan";
    const temp = { ...userSession.data, gender };
    session.setSession(ctx.from, "ONBOARDING_DOB", temp);
    await ctx.sock.sendMessage(ctx.from, {
      text: `Oke. Terakhir, ketik Tanggal Lahir Anda.\nFormat: DD-MM-YYYY (Contoh: 12-05-1995)`,
    });
  }

  // STEP 3: TANGGAL LAHIR & FINISH
  else if (step === "ONBOARDING_DOB") {
    const dob = moment(input, "DD-MM-YYYY");
    if (!dob.isValid())
      return ctx.sock.sendMessage(ctx.from, {
        text: "⚠️ Format salah. Gunakan DD-MM-YYYY",
      });

    const age = moment().diff(dob, "years");
    if (age < 17)
      return ctx.sock.sendMessage(ctx.from, {
        text: "⚠️ Maaf, Anda belum cukup umur (17+) untuk berinvestasi.",
      });

    // SIMPAN USER KE DB
    const users = db.load("users");
    users[ctx.from] = {
      name: userSession.data.name,
      gender: userSession.data.gender,
      dob: input,
      age: age,
      saldo: 0, // Saldo Real
      demo_saldo: 10000000, // Saldo Demo 10 Juta
      account_type: "DEMO",
      xp: 0,
      joined_at: Date.now(),
    };
    db.save("users", users);
    session.clearSession(ctx.from);

    // KIRIM RULES (GAMBAR IKLAN)
    // Pastikan ada file rules.jpg di folder assets, atau pakai URL
    // Disini kita pakai Text dulu biar aman
    const rules =
      `📜 *RULES & DISCLAIMER*\n\n` +
      `1. Ini adalah High Risk Investment.\n` +
      `2. Gunakan uang dingin.\n` +
      `3. Kami tidak bertanggung jawab atas kerugian.\n\n` +
      `Akun Anda saat ini: *DEMO (Latihan)*\n` +
      `Ketik .menu untuk memulai.`;

    await ctx.sock.sendMessage(ctx.from, { text: rules });
  }
}

module.exports = { startOnboarding, handleOnboarding };
