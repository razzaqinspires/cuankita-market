const intentEngine = require('./intentEngine');

/**
 * DOMAIN SPECIFIC LANGUAGE (DSL)
 * Penerjemah bahasa "When... Expect... Perform" menjadi Logic.
 */

function when(input) {
  let keyword = input;

  // 1. Support Format DSL: 'when message: "kata_kunci"'
  // Regex untuk menangkap teks di dalam tanda kutip
  const dslMatch = input.match(/when message: "(.*)"/);
  
  if (dslMatch) {
      keyword = dslMatch[1]; // Ambil kata kuncinya saja (misal: "deposit")
  }

  // Normalisasi ke lowercase agar tidak sensitif huruf besar/kecil
  keyword = keyword.toLowerCase();

  // Container untuk menyimpan urutan logika
  const block = {
    expects: [],
    performs: []
  };

  // Return Object dengan Chaining Methods
  return {
    /**
     * Mendaftarkan parameter yang diharapkan (opsional, untuk validasi/dokumentasi)
     * Contoh: .expect("amount")
     */
    expect(field) {
      block.expects.push(field);
      return this; // PENTING: Return this agar bisa di-chain (.expect(...).perform(...))
    },

    /**
     * Mendaftarkan fungsi service yang akan dijalankan
     * Contoh: .perform(finance.performDeposit)
     */
    perform(actionFunction) {
      block.performs.push(actionFunction);
      return this; // Return this agar bisa di-chain
    },

    /**
     * Menyimpan aturan ke dalam Otak Bot (Intent Engine)
     * Ini harus dipanggil di akhir rantai.
     */
    commit() {
      if (!keyword) {
          console.error("❌ DSL Error: Keyword kosong/tidak valid pada:", input);
          return;
      }

      // Daftarkan ke Engine
      intentEngine.define(
        // 1. MATCHER (Pengecek)
        // Cek apakah pesan user dimulai dengan keyword ini
        (text) => text.startsWith(keyword), 
        
        // 2. HANDLER (Eksekutor)
        async (ctx) => {
           console.log(`🤖 Executing Intent: [${keyword}]`);
           
           try {
               // Jalankan semua action yang didaftarkan secara berurutan
               for (const action of block.performs) {
                   await action(ctx);
               }
           } catch (err) {
               console.error(`❌ Error executing intent [${keyword}]:`, err);
               if(ctx.sock) {
                   await ctx.sock.sendMessage(ctx.from, { text: "⚠️ Terjadi kesalahan sistem internal." });
               }
           }
        }
      );
    }
  };
}

// Utility Helper (Opsional, jika dibutuhkan service lain)
function getArgs(command, pattern) {
    if (!command.toLowerCase().startsWith(pattern.toLowerCase())) return [];
    const argsString = command.substring(pattern.length).trim();
    return argsString ? argsString.split(/\s+/).filter(a => a.length > 0) : [];
}

module.exports = { when, getArgs };