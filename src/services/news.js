const db = require('../database/core');

// DATABASE BERITA CADANGAN (Fallback jika AI Mati/Limit)
const NEWS_DB = [
    { text: "Boss $ARA mengumumkan partnership strategis dengan Google Cloud!", impact: 1.05, type: "GOOD" },
    { text: "Whale misterius memborong 1 Juta Token $ARA pagi ini.", impact: 1.03, type: "GOOD" },
    { text: "Sistem mining $ARA di-upgrade menjadi lebih efisien dan hemat energi.", impact: 1.02, type: "GOOD" },
    { text: "Isu regulasi krypto global membuat investor retail panik.", impact: 0.95, type: "BAD" },
    { text: "Server pusat mengalami gangguan latensi kecil, teknisi sedang memperbaiki.", impact: 0.98, type: "BAD" },
    { text: "Inflasi global meningkat, pasar saham dunia lesu.", impact: 0.97, type: "BAD" },
    { text: "Komunitas $ARA mencapai rekor 10.000 member aktif di Telegram.", impact: 1.01, type: "GOOD" },
    { text: "Laporan keuangan kuartal ini menunjukkan profit fantastis.", impact: 1.04, type: "GOOD" },
    { text: "Rumor: Token $ARA akan listing di exchange Tier-1 bulan depan.", impact: 1.06, type: "GOOD" },
    { text: "Aksi jual massal (Panic Selling) terdeteksi di zona Asia.", impact: 0.94, type: "BAD" }
];

/**
 * GENERATE BERITA BARU
 * Mencoba pakai AI dulu, kalau gagal pakai database manual.
 * Berita ini akan langsung mempengaruhi harga pasar.
 */
async function generateNews() {
    const market = db.load('market_data');
    let newsItem;

    // 1. COBA PAKAI GEMINI AI DULU
    try {
        // Lazy load untuk menghindari circular dependency
        const gemini = require('./geminiFeatures');
        
        // Minta AI buat headline
        const aiHeadline = await gemini.generateAINews();
        
        if (aiHeadline) {
            // Tentukan sentimen & impact secara logis berdasarkan tren saat ini
            // Jika pasar sedang NAIK, berita cenderung BAGUS (Momentum)
            // Tapi kadang kita kasih kejutan (Correction - 20% chance)
            const isBullish = market.trend && (market.trend.includes('NAIK') || market.trend.includes('BULLISH'));
            
            const followTrend = Math.random() > 0.2; 
            let type = "NEUTRAL";
            let impact = 1.0;

            if (followTrend) {
                // Ikuti tren (Bullish -> Good News, Bearish -> Bad News)
                type = isBullish ? "GOOD" : "BAD";
            } else {
                // Lawan tren (Kejutan)
                type = isBullish ? "BAD" : "GOOD";
            }

            // Random Impact (0.5% - 3%)
            const volatility = (Math.random() * 0.025) + 0.005; 
            
            if (type === "GOOD") {
                impact = 1 + volatility;
            } else {
                impact = 1 - volatility;
            }
            
            newsItem = { text: aiHeadline, impact: impact, type: type };
        }
    } catch (e) {
        // Silent fail: Lanjut ke fallback jika AI error
        // console.log("AI News Failed, using fallback.");
    }

    // 2. JIKA AI GAGAL / OFF, PAKAI DATABASE MANUAL
    if (!newsItem) {
        newsItem = NEWS_DB[Math.floor(Math.random() * NEWS_DB.length)];
    }
    
    // 3. UPDATE MARKET DATA
    market.last_news = {
        headline: newsItem.text,
        type: newsItem.type,
        timestamp: Date.now()
    };

    // 4. EFEK KE HARGA (REAL IMPACT)
    // Harga berubah langsung saat berita rilis
    market.current_price = Math.floor(market.current_price * newsItem.impact);
    
    // Pastikan harga tidak dibawah floor price (50)
    if (market.current_price < 50) market.current_price = 50;

    // Update Tren Text
    if (newsItem.type === 'GOOD') {
        market.trend = '📈 BULLISH (News)';
    } else if (newsItem.type === 'BAD') {
        market.trend = '📉 BEARISH (News)';
    } else {
        market.trend = '➡️ SIDEWAYS';
    }
    
    db.save('market_data', market);
    return newsItem;
}

/**
 * COMMAND: .news / .berita
 * User membaca berita terakhir untuk analisa fundamental.
 */
async function performCheckNews(ctx) {
    const market = db.load('market_data');
    
    // Default data jika belum ada berita
    const news = market.last_news || { 
        headline: "Pasar stabil, belum ada berita signifikan.", 
        type: "NEUTRAL",
        timestamp: Date.now()
    };
    
    const time = new Date(news.timestamp).toLocaleTimeString('id-ID');
    
    // Icon Sentimen
    let icon = 'ℹ️';
    if (news.type === 'GOOD') icon = '🚀';
    else if (news.type === 'BAD') icon = '⚠️';

    // Sumber Berita (Gimmick agar terlihat canggih)
    const source = news.headline.toLowerCase().includes('partner') || news.headline.toLowerCase().includes('google') ? 'Global Wire' : 'Cuankita Insider';

    await ctx.sock.sendMessage(ctx.from, { 
        text: `📰 *BREAKING NEWS ($ARA)*\n` +
              `---------------------------\n` +
              `${icon} "${news.headline}"\n\n` +
              `🕒 Rilis: ${time}\n` +
              `📊 Sentimen: *${news.type}*\n` +
              `📉 Dampak Pasar: ${market.trend}\n` +
              `---------------------------\n` +
              `_Sumber: ${source}_` 
    });
}

module.exports = { generateNews, performCheckNews };