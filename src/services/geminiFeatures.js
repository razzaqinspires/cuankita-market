const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require('../database/core');

/**
 * GEMINI AI SERVICE v3.0
 * Mengintegrasikan Google Gemini Pro untuk analisis pasar finansial & interaksi persona.
 */

// Helper: Inisialisasi Model AI
function getModel() {
    const config = db.load('config');
    if (!config.gemini_key) return null;
    
    try {
        const genAI = new GoogleGenerativeAI(config.gemini_key);
        // Menggunakan model gemini-pro (atau gemini-1.5-flash jika tersedia dan lebih cepat)
        return genAI.getGenerativeModel({ model: "gemini-pro" });
    } catch (e) {
        console.error("Gemini Init Error:", e);
        return null;
    }
}

// ==========================================
// 1. CONFIGURATION
// ==========================================

/**
 * Set API Key Google Gemini (Owner Only)
 * Format: .setgemini AIzaSy...
 */
async function performSetGeminiKey(ctx) {
    const config = db.load('config');
    if (ctx.from !== config.owner_jid) return;

    const key = ctx.args[0];
    if (!key || !key.startsWith('AIza')) {
        return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Format salah. Masukkan API Key Gemini yang valid (Dimulai dengan 'AIza...')." });
    }

    config.gemini_key = key;
    db.save('config', config);
    await ctx.sock.sendMessage(ctx.from, { text: "✅ Otak Gemini berhasil dipasang! Fitur AI siap digunakan." });
}

// ==========================================
// 2. MARKET ANALYST (AI PREDICTION)
// ==========================================

/**
 * Menganalisis kondisi pasar saat ini dan memberikan saran investasi.
 * Command: .analisa / .predict
 */
async function performMarketAnalysis(ctx) {
    const model = getModel();
    if (!model) return ctx.sock.sendMessage(ctx.from, { text: "❌ Fitur AI belum aktif. Hubungi Admin untuk pasang API Key." });

    await ctx.sock.sendMessage(ctx.from, { text: "🤖 Ara sedang membaca grafik dan berita pasar... (Mohon tunggu)" });

    // 1. Kumpulkan Data Pasar Realtime
    const market = db.load('market_data');
    const users = db.load('users');
    const totalInvestors = Object.keys(users).length;
    const price = market.current_price || 1000;
    const trend = market.trend || "STABLE";
    const lastNews = market.last_news?.headline || "Belum ada berita signifikan";

    // 2. Buat Prompt Kontekstual
    const prompt = `
    Bertindaklah sebagai Analis Pasar Saham & Kripto Senior yang berpengalaman namun sedikit eksentrik dan humoris.
    Analisis data pasar berikut untuk token lokal bernama "$ARA":
    
    - Harga Saat Ini: Rp ${price.toLocaleString()}
    - Tren Pasar: ${trend}
    - Sentimen Berita Terakhir: "${lastNews}"
    - Jumlah Investor: ${totalInvestors} orang
    
    Tugas Anda:
    1. Tentukan Sentimen Pasar (Sangat Bullish / Bullish / Netral / Bearish / Sangat Bearish).
    2. Berikan Prediksi Harga jangka pendek (Naik ke berapa / Turun ke berapa).
    3. Berikan Saran Aksi (SEROK / HOLD / JUAL / PANIC SELLING).
    4. Berikan alasan teknikal/fundamental singkat yang terdengar masuk akal tapi "cocoklogi".
    
    Gunakan format yang rapi dengan emoji. Jangan terlalu kaku. Panggil user dengan sebutan "Sobat Cuan".
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        await ctx.sock.sendMessage(ctx.from, { 
            text: `🧠 *ANALISIS AI GEMINI*\n--------------------------\n${text}\n\n_Disclaimer: Prediksi AI bukan saran finansial pasti. DYOR._` 
        });

    } catch (error) {
        console.error("Gemini Error:", error);
        await ctx.sock.sendMessage(ctx.from, { text: "⚠️ Otak AI sedang *overload* atau limit tercapai. Coba lagi nanti." });
    }
}

// ==========================================
// 3. CHAT PERSONA (ARA)
// ==========================================

/**
 * Ngobrol santai dengan Bot.
 * Command: .tanya [pertanyaan]
 */
async function performChat(ctx) {
    const model = getModel();
    if (!model) return; // Silent fail kalau belum setup

    const query = ctx.args.join(' ');
    if (!query) return ctx.sock.sendMessage(ctx.from, { text: "Mau tanya apa Boss? Ketik .tanya [pertanyaan]" });

    const users = db.load('users');
    const user = users[ctx.from] || { name: "Bos", account_type: "DEMO" };

    const prompt = `
    Kamu adalah "Ara", asisten pribadi cerdas di platform investasi "Cuankita".
    Karaktermu: Pintar, ramah, sedikit genit tapi profesional, sangat paham uang dan investasi, dan setia kepada Boss.
    
    User yang bertanya bernama: ${user.name} (Status Akun: ${user.account_type}).
    Pertanyaan user: "${query}"
    
    Jawablah dengan singkat (maksimal 3-4 kalimat), membantu, dan sertakan emoji.
    Jika user bertanya soal cara kaya, arahkan untuk deposit atau mining.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        await ctx.sock.sendMessage(ctx.from, { text: response.text() });
    } catch (error) {
        // Fallback jika error
        await ctx.sock.sendMessage(ctx.from, { text: "Maaf, Ara lagi pusing mikirin chart merah. Tanya nanti lagi ya beb. 🤕" });
    }
}

// ==========================================
// 4. NEWS GENERATOR (INTERNAL HELPER)
// ==========================================

/**
 * Membuat judul berita pasar secara otomatis berdasarkan tren harga.
 * Dipanggil oleh news.js
 */
async function generateAINews() {
    const model = getModel();
    if (!model) return null;

    const market = db.load('market_data');
    const trend = market.trend || "STABLE";
    const price = market.current_price;

    const prompt = `
    Buatkan 1 (satu) judul berita singkat (maksimal 10-12 kata) untuk Running Text website bursa saham token "$ARA".
    
    Kondisi Pasar:
    - Harga: Rp ${price}
    - Tren: ${trend}
    
    Instruksi:
    - Jika tren NAIK, buat berita positif (investor senang, adopsi massal, whale masuk).
    - Jika tren TURUN, buat berita negatif (regulasi, panic sell, server down).
    - Gunakan bahasa berita finansial yang dramatis (seperti CNBC Indonesia / Bloomberg).
    - Output HANYA teks judulnya saja, tanpa tanda kutip.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().replace(/['"]+/g, '').trim(); 
    } catch (error) {
        console.error("AI News Error:", error.message);
        return null; // news.js akan pakai database fallback
    }
}

module.exports = { 
    performSetGeminiKey, 
    performMarketAnalysis, 
    performChat, 
    generateAINews 
};