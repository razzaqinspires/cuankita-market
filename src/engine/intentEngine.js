/**
 * INTENT ENGINE CORE
 * Mesin pemroses niat yang menghubungkan input user dengan fungsi layanan.
 */

class IntentEngine {
  constructor() {
    this.rules = [];
  }

  /**
   * Mendaftarkan pola niat baru.
   * @param {Function} patternFunc - Fungsi pengecek kecocokan (input string -> boolean)
   * @param {Function} handlerFunc - Fungsi eksekutor (ctx -> Promise)
   */
  define(patternFunc, handlerFunc) {
    this.rules.push({ pattern: patternFunc, handler: handlerFunc });
  }

  /**
   * Menafsirkan input user dan menjalankan handler yang sesuai.
   * @param {string} command - Kata kunci perintah (tanpa prefix)
   * @param {object} ctx - Konteks pesan (sock, sender, args, dll)
   * @returns {Promise<boolean>} True jika intent ditemukan & dijalankan, False jika tidak.
   */
  async interpret(command, ctx) {
    // Normalisasi input (lowercase & trim) untuk pencocokan yang fleksibel
    const text = command.toLowerCase().trim();

    // Loop semua aturan yang sudah didaftarkan lewat DSL
    for (const { pattern, handler } of this.rules) {
      // Cek apakah pola cocok
      if (pattern(text)) {
        try {
            console.log(`🤖 [ENGINE] Matched Intent: ${text}`);
            
            // Eksekusi Handler
            await handler(ctx);
            
            return true; // Match found & executed successfully

        } catch (err) {
            console.error("❌ [ENGINE] Error executing intent:", err);
            
            // Berikan feedback ke user jika terjadi error internal
            if (ctx.sock && ctx.from) {
                await ctx.sock.sendMessage(ctx.from, { 
                    text: "⚠️ Terjadi kesalahan sistem saat memproses perintah ini." 
                });
            }
            return true; // Tetap return true karena intent dikenali (meski error)
        }
      }
    }
    
    // Jika tidak ada rule yang cocok, return false.
    // Main Controller bisa menggunakan ini untuk trigger Fallback AI.
    return false; 
  }
}

// Export instance tunggal (Singleton) agar state rules persisten
module.exports = new IntentEngine();