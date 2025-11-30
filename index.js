const kill = require('kill-port');
const { exec } = require('child_process');

/**
 * BOOTSTRAPPER CUANKITA V3.0
 * Tugas:
 * 1. Membunuh proses liar di port 3000 (Express).
 * 2. Merapikan kode (Prettier) - Opsional.
 * 3. Menjalankan Main Controller (src/main.js).
 */

const APP_PORT = 3000;

async function bootstrap() {
    console.clear();
    console.log("=========================================");
    console.log("   💎 CUANKITA AUTONOMOUS SYSTEM v3.0   ");
    console.log("   🚀 Booting up engine...               ");
    console.log("=========================================");

    try {
        // 1. Kill Port (Bersih-bersih sebelum start)
        // Ini mencegah error "EADDRINUSE" saat restart bot
        console.log(`🧹 Membersihkan Port ${APP_PORT}...`);
        await kill(APP_PORT, 'tcp');
        console.log("✅ Port bersih.");

    } catch (e) {
        console.log("ℹ️ Port sudah bersih atau tidak bisa diakses.");
    }

    // 2. Jalankan Main Controller
    console.log("🔄 Memulai Main Controller...");
    
    try {
        // Import Logic Utama dari folder src
        const main = require('./src/main');
        
        // Eksekusi fungsi start()
        main.start();
        
    } catch (error) {
        console.error("🔥 FATAL ERROR saat Booting:", error);
        console.error("Pastikan Anda sudah menjalankan 'npm install' dan struktur folder 'src' lengkap.");
        process.exit(1);
    }
}

// Jalankan Bootstrap
bootstrap();