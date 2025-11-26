const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
  isJidUser,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const qrcode = require("qrcode-terminal");
const readline = require("readline");

const engine = require("./engine/intentEngine");
const db = require("./database/core");
const { serialize } = require("./utils/serializer");
const webBridge = require("./services/webBridge");

const session = require("./engine/sessionManager");
const onboarding = require("./services/onboarding");
const finance = require("./services/finance");
const drawing = require("./utils/drawing"); // Utk visual

// Load Rules
require("./rules/finance.intent");
require("./rules/exchange.intent");
require("./rules/mining.intent");
require("./rules/general.intent");
require("./rules/trading.intent");
require("./rules/marketing.intent");

const PORT = 3000;
let sock;

// --- FUNGSI BANTUAN INPUT (ANTI CRASH) ---
// Membuat interface baru setiap kali dipanggil, dan langsung menghancurkannya setelah selesai.
const question = (text) => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(text, (answer) => {
      rl.close(); // Hancurkan sesi readline agar tidak error saat reconnect
      resolve(answer);
    });
  });
};

/**
 * FUNGSI: HANDLE AUTHENTICATION CHOICE
 * Dipanggil hanya jika belum ada sesi login.
 * Memastikan urutan: Tanya User -> Baru Init Socket.
 */
async function handleAuth() {
  console.clear();
  console.log("===========================================");
  console.log("🔐 SISTEM OTENTIKASI BARU");
  console.log("===========================================");

  const choice = await question(
    "Pilih metode login:\n1. 📷 QR Code\n2. 🔢 Pairing Code (Nomor HP)\nPilihan [1/2]: ",
  );

  if (choice.trim() === "2") {
    const phone = await question("📱 Masukkan Nomor HP (Format: 628xxx): ");
    return { type: "pairing", phone: phone.trim() };
  } else {
    return { type: "qr" };
  }
}

/**
 * FUNGSI UTAMA: KONEKSI WA
 */
async function connectWA() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  // Cek status login
  const isRegistered = !!state.creds.me;
  let authConfig = { type: "qr" }; // Default config

  // ⛔ BLOKIR SOCKET: Jangan start socket jika belum login & belum milih metode
  // Logic: Jika tidak terdaftar, DAN ini bukan proses reconnect otomatis (biasanya ditandai creds kosong)
  if (!isRegistered && !state.creds.registered) {
    // Kita paksa tanya dulu sebelum socket jalan
    authConfig = await handleAuth();
  }

  console.log(`\n🚀 Memulai Socket WhatsApp v${version.join(".")}...`);

  sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // Kita handle manual sepenuhnya
    auth: {
      creds: state.creds,
      keys: state.keys, // v7.0.0 Support (Tanpa makeCacheableSignalRepository)
    },
    shouldIgnoreJid: (jid) => (isJidGroup(jid) ? true : false),
    browser: ["BotCuan-Ara", "Ubuntu", "3.0.0"],
  });

  // --- LOGIC PAIRING CODE (Jalan segera setelah init) ---
  if (authConfig.type === "pairing" && !isRegistered) {
    // Beri delay sedikit agar socket siap menerima request
    setTimeout(async () => {
      console.log("⏳ Meminta Pairing Code ke Server...");
      try {
        const code = await sock.requestPairingCode(authConfig.phone);
        console.log(`\n🔢 \x1b[32mKODE PAIRING ANDA:\x1b[0m`);
        console.log(`=============================`);
        console.log(`      \x1b[1m${code}\x1b[0m`);
        console.log(`=============================`);
        console.log("👉 Masukkan kode ini di HP Anda segera.\n");
      } catch (err) {
        console.error("❌ Gagal request pairing code:", err.message);
      }
    }, 2000);
  }

  // --- EVENT LISTENER ---
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    // HANDLE QR (Hanya jika user memilih QR / Default)
    if (qr && authConfig.type === "qr" && !isRegistered) {
      console.log("\n🔑 Scan QR Code di bawah ini:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect.error?.output?.statusCode;
      // Reconnect jika bukan Logout (401)
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        `\n⚠️ Koneksi terputus (Status: ${statusCode}). Reconnecting: ${shouldReconnect}`,
      );

      if (shouldReconnect) {
        setTimeout(connectWA, 3000);
      } else {
        console.log(
          "❌ Sesi Logout/Invalid. Hapus folder auth_info_baileys dan mulai ulang.",
        );
        process.exit(1);
      }
    } else if (connection === "open") {
      console.log("✅ CUANKITA SYSTEM ONLINE & OTONOM.");
      const user = jidNormalizedUser(sock.user.id);
      console.log(`👤 Connected as: ${user}`);
      db.load("config");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // MESSAGE HANDLER
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.remoteJid === "status@broadcast") return;

    const msg = serialize(sock, m);

    // ⚠️ FIX: DEFINISIKAN CONTEXT (CTX) DI PALING ATAS
    // Agar bisa dipakai oleh Gatekeeper di bawahnya
    const ctx = {
      sock,
      from: msg.remoteJid,
      sender: msg.sender,
      text: msg.text,
      command: msg.command,
      args: msg.args,
      m: msg.m,
      quoted: msg.quoted,
    };

    // --- GATEKEEPER 1: PRIVATE CHAT ONLY ---
    if (isJidGroup(msg.remoteJid)) {
      const config = db.load("config");
      const allowedGroups = config.allowed_groups || [];
      if (!allowedGroups.includes(msg.remoteJid)) return;
    }

    // --- GATEKEEPER 2: CEK USER BARU (ONBOARDING) ---
    const users = db.load("users");
    const userExists = !!users[msg.remoteJid];
    const currentSession = session.getSession(msg.remoteJid);

    // User Baru & Belum ada sesi -> Mulai Onboarding
    if (!userExists && !currentSession) {
      await onboarding.startOnboarding(ctx); // CTX sudah aman disini
      return;
    }

    // Sedang Onboarding -> Lanjut
    if (currentSession && currentSession.type.startsWith("ONBOARDING")) {
      await onboarding.handleOnboarding(ctx, currentSession);
      return;
    }

    // --- GATEKEEPER 3: LOCKED TRANSACTION (PENDING DEPOSIT) ---
    if (currentSession && currentSession.type === "LOCKED_TRANSACTION") {
      if (msg.m.message?.imageMessage) {
        await finance.handleProofUpload(ctx, currentSession);
        return;
      } else {
        // Abaikan teks biasa jika sedang lock
        return;
      }
    }

    // --- GATEKEEPER 4: REPLY HANDLER ---
    if (currentSession && currentSession.type === "DEPOSIT_SELECT_METHOD") {
      await finance.handleDepositStep(ctx, currentSession);
      return;
    }

    // Pseudo-Buttons
    if (msg.text.toLowerCase() === "switch real") {
      ctx.args = ["REAL"];
      await finance.performSwitchAccount(ctx);
      return;
    }
    if (msg.text.toLowerCase() === "switch demo") {
      ctx.args = ["DEMO"];
      await finance.performSwitchAccount(ctx);
      return;
    }

    // --- GATEKEEPER 5: COMMAND ENGINE ---
    if (!msg.command) return;

    // Eksekusi Command via Intent Engine
    await engine.interpret(msg.command, ctx);
  });
}

/**
 * APP ENTRY POINT
 */
function startApp() {
  // 1. Inisialisasi Webhook Server (Express)
  const app = express();
  app.use(express.json());

  app.post("/webhook", (req, res) => {
    console.log("📩 Webhook Data:", req.body);
    res.send("OK");
  });

  // Safe Listen (Anti Crash EADDRINUSE)
  const server = app.listen(PORT, () => {
    console.log(`🌐 Webhook Server listening on port ${PORT}`);
  });

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.log(
        `⚠️ Port ${PORT} sedang digunakan. Server webhook dilewati (Bot WA tetap jalan).`,
      );
    } else {
      console.error("Server Error:", e);
    }
  });

  // JALANKAN WEB BRIDGE
  webBridge.start();

  // 2. Jalankan Logika WA
  connectWA();
}

module.exports = { start: startApp };
