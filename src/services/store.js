const db = require('../database/core');
const account = require('../utils/account'); // Import Helper Dual Wallet

// Helper: Mengambil daftar produk dari config
function getProducts() {
    return db.load('config').products || {
        "EBOOK_V1": { name: "Ebook Rahasia Trading Pro V1", cost: 50000, description: "Strategi Swing Trading $ARA." },
        "BOT_PREMIUM": { name: "Akses Fitur Bot Premium", cost: 100000, description: "Fitur notifikasi harga & analisa eksklusif." },
        "AI_PACK": { name: "5x Credit AI Analyst", cost: 25000, description: "Tambahan kredit untuk .analyze." }
    };
}

/**
 * Menampilkan daftar produk yang tersedia di Toko.
 */
async function performStoreList(ctx) {
    const products = getProducts();
    
    let text = `🛒 *CUANKITA DIGITAL STORE*\n\n` +
               `Anda sedang di mode: *${db.load('users')[ctx.from]?.account_type || 'DEMO'}*\n\n`;
    
    let i = 1;
    for (const id in products) {
        const p = products[id];
        text += `${i}. *${p.name}*\n` +
                `   - ID: ${id}\n` +
                `   - Harga: Rp ${p.cost.toLocaleString()}\n` +
                `   - Deskripsi: ${p.description}\n` +
                `---------------------------\n`;
        i++;
    }

    text += `\n_Untuk membeli, ketik: .buy [ID_PRODUK]\nContoh: .buy EBOOK_V1_`;
    
    await ctx.sock.sendMessage(ctx.from, { text });
}

/**
 * Membeli produk dan mendebit saldo dari wallet aktif.
 */
async function performBuyProduct(ctx) {
    const users = db.load('users');
    const user = users[ctx.from];
    const products = getProducts();
    const productId = ctx.args[0]?.toUpperCase();
    
    if (!productId) return ctx.sock.sendMessage(ctx.from, { text: "Format: .buy [ID_PRODUK]\nCek ID dengan .store" });

    const product = products[productId];
    if (!product) return ctx.sock.sendMessage(ctx.from, { text: "❌ ID Produk tidak valid." });

    // 1. Cek Kepemilikan (Library)
    if (user.library?.includes(productId)) {
        return ctx.sock.sendMessage(ctx.from, { text: "⚠️ Anda sudah memiliki produk ini di Perpustakaan (.library)." });
    }

    // 2. Ambil Wallet Aktif & Cek Saldo
    const wallet = account.getWallet(user);
    const cost = product.cost;
    
    if (wallet.balance < cost) {
        return ctx.sock.sendMessage(ctx.from, { 
            text: `❌ Saldo ${wallet.mode} Kurang!\nButuh: Rp ${cost.toLocaleString()}\nPunya: Rp ${wallet.balance.toLocaleString()}` 
        });
    }

    // 3. Proses Pembelian
    
    // Debit Saldo
    user[wallet.balanceKey] -= cost;
    
    // Tambahkan ke Library
    if (!user.library) user.library = [];
    user.library.push(productId);
    
    db.save('users', users);

    // 4. Konfirmasi
    let confirmation = `🎉 *PEMBELIAN SUKSES (${wallet.mode})*\n\n` +
                       `Produk: *${product.name}*\n` +
                       `Harga: Rp ${cost.toLocaleString()}\n` +
                       `Saldo Tersisa: Rp ${user[wallet.balanceKey].toLocaleString()}`;
                       
    // Tambahkan informasi akses, tergantung jenis produk
    if (productId.includes('EBOOK')) {
        confirmation += `\n\n📖 Ebook sudah masuk ke Perpustakaan Anda.\nKetik *.library* untuk akses link download.`;
    } else if (productId === 'AI_PACK') {
        // Logika AI Credit (asumsi ada field credit)
        user.ai_credit = (user.ai_credit || 0) + 5;
        db.save('users', users);
        confirmation += `\n\n🤖 Credit AI ditambahkan (+5).\nSisa Credit: ${user.ai_credit}x`;
    }

    await ctx.sock.sendMessage(ctx.from, { text: confirmation });
}

/**
 * Menampilkan daftar produk yang sudah dibeli user.
 */
async function performLibrary(ctx) {
    const users = db.load('users');
    const user = users[ctx.from];
    const userLibrary = user.library || [];
    
    if (userLibrary.length === 0) {
        return ctx.sock.sendMessage(ctx.from, { text: "📚 Perpustakaan Anda kosong.\nKetik .store untuk melihat produk." });
    }

    const products = getProducts();
    let text = `📚 *PERPUSTAKAAN SAYA*\n\n`;
    
    userLibrary.forEach(id => {
        const p = products[id];
        if (p) {
            text += `[${id}] *${p.name}*\n`;
            
            // Tambahkan link/info akses (Simulasi)
            if (id.includes('EBOOK')) {
                text += `  Link Download: [Simulasi Link Ebook]\n`; // Ganti dengan link asli Boss
            } else if (id === 'BOT_PREMIUM') {
                 text += `  Status: Akses Premium Aktif.\n`;
            }
        }
    });

    await ctx.sock.sendMessage(ctx.from, { text });
}

module.exports = { 
    performStoreList, 
    performBuyProduct, 
    performLibrary 
};