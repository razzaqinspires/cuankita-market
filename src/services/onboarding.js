const db = require('../database/core');
const session = require('../engine/sessionManager');
const moment = require('moment'); 

async function startOnboarding(ctx) {
    await ctx.sock.sendMessage(ctx.from, { 
        text: `👋 Selamat Datang di *Cuankita Private Ecosystem*.\n\n` +
              `Saya Ara, asisten pribadi Anda.\n` +
              `Sebelum memulai investasi, mari lengkapi profil Anda.\n\n` +
              `Siapa nama panggilan Anda?` 
    });
    session.setSession(ctx.from, 'ONBOARDING_NAME', {});
}

async function handleOnboarding(ctx, userSession) {
    const step = userSession.type;
    const input = ctx.text ? ctx.text.trim() : '';

    if (!input) return; 
    if (input.startsWith('.')) return; 

    // STEP 1: NAMA
    if (step === 'ONBOARDING_NAME') {
        const config = db.load('config');
        
        // CEK NAMA TERLARANG (ANTI IMPERSONATOR)
        const forbiddenNames = ["OWNER", "ADMIN", "ARIFI RAZZAQ", "BOSS", "BANDAR", "CUANKITA"];
        const isOwner = ctx.from === config.owner_jid;

        // Jika nama mengandung kata terlarang DAN bukan Owner asli -> Blokir
        if (forbiddenNames.some(w => input.toUpperCase().includes(w)) && !isOwner) {
            return ctx.sock.sendMessage(ctx.from, { 
                text: "⚠️ Nama tersebut dilindungi oleh sistem. Gunakan nama lain." 
            });
        }

        if (input.length < 3) {
            return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Nama terlalu pendek. Masukkan minimal 3 huruf." });
        }
        
        if (!/^[a-zA-Z\s]+$/.test(input)) {
             return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Gunakan nama asli (Huruf saja)." });
        }
        
        const temp = { name: input };
        session.setSession(ctx.from, 'ONBOARDING_GENDER', temp);
        
        await ctx.sock.sendMessage(ctx.from, { text: `Halo ${input} ✨\nApa jenis kelamin Anda? (Ketik L untuk Laki-laki, P untuk Perempuan)` });
    }
    
    // STEP 2: GENDER
    else if (step === 'ONBOARDING_GENDER') {
        let gender = '';
        const choice = input.toUpperCase();
        
        if (choice === 'L' || choice === 'LAKI') gender = 'Laki-laki';
        else if (choice === 'P' || choice === 'PEREMPUAN') gender = 'Perempuan';
        else return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Ketik L atau P saja." });

        const temp = { ...userSession.data, gender };
        session.setSession(ctx.from, 'ONBOARDING_DOB', temp);
        
        await ctx.sock.sendMessage(ctx.from, { text: `Oke. Terakhir, ketik Tanggal Lahir Anda.\nFormat: DD-MM-YYYY\n(Contoh: 12-05-1995)` });
    }

    // STEP 3: TANGGAL LAHIR
    else if (step === 'ONBOARDING_DOB') {
        const dob = moment(input, 'DD-MM-YYYY', true); 
        
        if (!dob.isValid()) {
            return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Format tanggal salah. Gunakan garis datar (-). Contoh: 01-01-2000" });
        }

        const age = moment().diff(dob, 'years');
        if (age < 17) {
            return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Maaf, Platform ini hanya untuk usia 17+ (Regulasi Investasi)." });
        }

        const users = db.load('users');
        users[ctx.from] = {
            name: userSession.data.name,
            gender: userSession.data.gender,
            dob: input,
            age: age,
            account_type: 'DEMO', 
            balance_real: 0,
            assets_real: {},
            positions_real: [],
            balance_demo: 500000, 
            assets_demo: {},
            positions_demo: [],
            xp: 0,
            joined_at: Date.now()
        };
        
        db.save('users', users);
        session.clearSession(ctx.from); 

        const rules = `✅ *REGISTRASI BERHASIL*\n\n` +
                      `Selamat bergabung, ${userSession.data.name}!\n` +
                      `Akun Anda saat ini: *DEMO (Latihan)*\n` +
                      `Saldo Awal: *Rp 500.000* (Uang Virtual)\n\n` +
                      `📜 *RULES:*\n` +
                      `1. Gunakan akun DEMO untuk belajar.\n` +
                      `2. Dilarang spamming.\n` +
                      `3. Keputusan investasi ada di tangan Anda.\n\n` +
                      `Ketik *.menu* untuk memulai perjalanan cuan Anda! 🚀`;
                      
        await ctx.sock.sendMessage(ctx.from, { text: rules });
    }
}

module.exports = { startOnboarding, handleOnboarding };