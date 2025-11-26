const kill = require("kill-port");
const { exec } = require("child_process"); // Tambahkan exec untuk Prettier

/**
 * BOOTSTRAPPER (PENYALA MESIN)
 * Tugas:
 * 1. Membunuh proses liar di port 3000.
 * 2. Merapikan kode (Prettier).
 * 3. Menjalankan Main Controller.
 */

const APP_PORT = 3000;

async function bootstrap() {
  console.clear();
  console.log("=========================================");
  console.log("   💎 CUANKITA AUTONOMOUS SYSTEM v2.0   ");
  console.log("=========================================");

  try {
    // 1. Kill Port (Bersih-bersih)
    console.log(`🧹 Membersihkan Port ${APP_PORT}...`);
    await kill(APP_PORT, "tcp");
    console.log("✅ Port bersih.");
  } catch (e) {
    console.log("ℹ️ Port sudah bersih atau tidak bisa diakses.");
  }

  // 2. Auto Prettier (Merapikan Kode)
  console.log("✨ Merapikan kode dengan Prettier...");
  exec("npx prettier --write .", (err, stdout, stderr) => {
    if (err) console.error(`Prettier Gagal: ${stderr}`);
    else console.log("✅ Kode rapi.");

    // Lanjut ke step 3 setelah Prettier selesai (atau gagal)
    startMainController();
  });
}

function startMainController() {
  console.log("🔄 Memulai Main Controller...");

  // 3. Import & Start Main Module
  try {
    const main = require("./src/main");
    main.start(); // Panggil start() tanpa await
  } catch (error) {
    console.error("🔥 FATAL ERROR saat Booting:", error);
  }
}

// Jalankan Bootstrap
bootstrap();
