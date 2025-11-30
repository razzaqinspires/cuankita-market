const db = require('../database/core');
const { OpenAI } = require('openai');

// Helper: Setup AI Connection
function getAI() {
    const config = db.load('config');
    if (!config.openai_key) return null;
    return new OpenAI({ apiKey: config.openai_key });
}

/**
 * 1. SET API KEY (OWNER ONLY)
 * Format: .setkey sk-proj-xxxx...
 */
async function performSetKey(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    const key = ctx.args[0];
    if (!key || !key.startsWith('sk-')) {
        return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Format salah. Masukkan API Key OpenAI yang valid (sk-...)" });
    }

    config.openai_key = key;
    db.save('config', config);
    await ctx.sock.sendMessage(ctx.from, { text: "✅ Otak AI berhasil dipasang! Sistem siap generate produk." });
}

/**
 * 2. GENERATE EBOOK (AUTO PRODUCT CREATOR)
 * Format: .makebook [topik]
 */
async function performMakeBook(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    const topic = ctx.args.join(' ');
    if (!topic) return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Mau buat buku apa? Contoh: .makebook Psikologi Trading" });

    const openai = getAI();
    if (!openai) return ctx.sock.sendMessage(ctx.from, { text: "❌ API Key belum diset. Gunakan .setkey [API_KEY]" });

    await ctx.sock.sendMessage(ctx.from, { text: "🤖 AI sedang menulis buku & meriset harga pasar... (Mohon tunggu ±30 detik)" });

    try {
        // Prompt Engineering: Meminta format JSON strict
        const prompt = `
        Bertindaklah sebagai Pakar Bisnis & Finansial.
        Saya ingin membuat Produk Digital Ebook tentang: "${topic}".
        
        Tolong buatkan output JSON saja (tanpa teks pembuka/penutup) dengan format:
        {
            "title": "Judul Bombastis & Menjual (Clickbait)",
            "description": "Deskripsi singkat marketing yang memicu urgensi (2 kalimat)",
            "price": (angka harga dalam Rupiah antara 50000 - 250000, sesuaikan dengan value topik),
            "content": "Isi materi lengkap, minimal 5 poin pembahasan, gunakan bahasa motivasi & taktis."
        }
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
        });

        const rawResult = completion.choices[0].message.content;
        let result;
        
        // Parsing JSON dengan Error Handling
        try {
            // Bersihkan markdown code block jika ada (```json ... ```)
            const cleanJson = rawResult.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(cleanJson);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            return ctx.sock.sendMessage(ctx.from, { text: "❌ AI meracau (Format JSON rusak). Coba topik lain." });
        }

        // Simpan ke Database Produk
        const products = db.load('products') || {};
        const productId = `EBOOK-${Date.now().toString().slice(-4)}`; // ID Unik Simple
        
        products[productId] = {
            id: productId,
            type: 'EBOOK',
            title: result.title,
            desc: result.description,
            price: result.price,
            content: result.content,
            sold: 0,
            created_at: Date.now()
        };
        
        db.save('products', products);

        const msg = `📚 *PRODUK AI SELESAI!*\n` +
                    `--------------------------\n` +
                    `Judul: *${result.title}*\n` +
                    `Harga: Rp ${result.price.toLocaleString()}\n` +
                    `Deskripsi: _${result.description}_\n` +
                    `--------------------------\n` +
                    `✅ Otomatis masuk ke Toko (.shop)\n` +
                    `🆔 Kode Produk: ${productId}`;

        await ctx.sock.sendMessage(ctx.from, { text: msg });

    } catch (error) {
        console.error("OpenAI Error:", error);
        await ctx.sock.sendMessage(ctx.from, { text: "❌ Gagal menghubungi server AI. Cek kuota atau koneksi." });
    }
}

/**
 * 3. AUTO MARKETING POST
 * Membuat copywriting iklan otomatis untuk broadcast.
 * Format: .autopost [topik]
 */
async function performAutoPost(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    const topic = ctx.args.join(' ');
    const openai = getAI();
    
    if (!openai) return ctx.sock.sendMessage(ctx.from, { text: "❌ API Key belum diset." });

    await ctx.sock.sendMessage(ctx.from, { text: "🤖 AI sedang meracik konten marketing..." });

    try {
        const prompt = `
        Buatkan pesan Broadcast WhatsApp pendek, santai, tapi memicu FOMO (Fear Of Missing Out).
        Topik: ${topic || "Peluang Investasi $ARA"}.
        Gunakan emoji yang menarik.
        Akhiri dengan ajakan: "Ketik .menu untuk mulai cuan sekarang!"
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
        });

        const content = completion.choices[0].message.content;

        // Preview ke Owner
        await ctx.sock.sendMessage(ctx.from, { 
            text: `📢 *DRAFT KONTEN MARKETING:*\n\n${content}\n\n_Copy pesan di atas dan gunakan .bc all [pesan] untuk mengirim._` 
        });

    } catch (error) {
        await ctx.sock.sendMessage(ctx.from, { text: "❌ Gagal generate konten." });
    }
}

module.exports = { performSetKey, performMakeBook, performAutoPost };