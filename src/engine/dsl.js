const engine = require("./intentEngine");

/**
 * DSL PARSER (Domain Specific Language)
 * Mengubah sintaks "When... Expect... Perform" menjadi Logic Eksekusi.
 */

function when(line) {
  // Regex untuk menangkap pola: when message: "kata_kunci"
  // Contoh: when message: "deposit" -> keyword = deposit
  const match = line.match(/when message: "(.*)"/);
  const keyword = match ? match[1] : null;

  // Container untuk menyimpan daftar parameter dan fungsi yang akan dijalankan
  const block = {
    expects: [],
    performs: [],
  };

  // Return Chainable Methods (Agar bisa .expect().perform().commit())
  return {
    // Menentukan parameter apa yang diharapkan (misal: [jumlah])
    // Berguna untuk validasi atau dokumentasi otomatis nanti
    expect(field) {
      block.expects.push(field);
      return this;
    },

    // Menentukan fungsi Service mana yang akan dijalankan
    perform(actionFunction) {
      block.performs.push(actionFunction);
      return this;
    },

    // Mendaftarkan aturan ini ke dalam Otak Bot (Intent Engine)
    commit() {
      if (!keyword) {
        console.error(
          "❌ DSL Error: Pattern 'when message' tidak valid pada baris:",
          line,
        );
        return;
      }

      // Daftarkan ke Engine
      engine.define(
        // 1. MATCHER: Fungsi untuk mengecek apakah pesan user cocok dengan keyword
        (input) => input === keyword.toLowerCase(),

        // 2. HANDLER: Fungsi yang dijalankan jika cocok
        async (ctx) => {
          console.log(`🤖 Executing Intent: [${keyword}]`);

          try {
            // Validasi Argumen Sederhana (Opsional)
            // Jika intent butuh argumen tapi user tidak memberikannya
            /* if (block.expects.length > 0 && ctx.args.length < block.expects.length) {
                   await ctx.sock.sendMessage(ctx.from, { text: `⚠️ Format salah. Parameter kurang: ${block.expects.join(', ')}` });
                   return;
               } 
               */

            // Jalankan semua action yang didaftarkan secara berurutan
            for (const action of block.performs) {
              await action(ctx);
            }
          } catch (err) {
            console.error(`❌ Error executing intent: ${err.message}`);
            console.error(err.stack); // Print stack trace untuk debugging

            // Beritahu user ada error (tapi jangan kasih detail teknis biar elegan)
            await ctx.sock.sendMessage(ctx.from, {
              text: "⚠️ Terjadi kesalahan sistem saat memproses niat Anda.",
            });
          }
        },
      );
    },
  };
}

module.exports = { when };
