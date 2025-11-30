const { when } = require('../engine/dsl');
const store = require('../services/store');
const ai = require('../services/ai');
const registry = require('../engine/commandRegistry');

console.log("🏪 Loading Store & AI Rules...");

// ==========================================
// 1. REGISTRASI MENU
// ==========================================

// Kategori: DIGITAL STORE (Public)
registry.register('shop', 'DIGITAL STORE', 'Beli Ebook & Tools Premium');
registry.register('library', 'DIGITAL STORE', 'Lihat koleksi produk yang sudah dibeli');
registry.register('buyproduct', 'DIGITAL STORE', 'Beli produk spesifik', '[kode_produk]');

// Kategori: ADMIN (AI Tools)
registry.register('makebook', 'ADMIN', 'AI: Buat Produk Ebook Otomatis', '[topik]');
registry.register('autopost', 'ADMIN', 'AI: Buat Konten Marketing', '[topik]');
registry.register('setkey', 'ADMIN', 'Set API Key OpenAI', '[sk-...]');


// ==========================================
// 2. DEFINISI NIAT (LOGIC MAPPING)
// ==========================================

// --- STORE FRONT ---
when(`when message: "shop"`)
    .perform(store.performStoreList)
    .commit();

when(`when message: "toko"`) // Alias Indonesia
    .perform(store.performStoreList)
    .commit();

// --- BUY PRODUCT ---
when(`when message: "buyproduct"`)
    .expect("id")
    .perform(store.performBuyProduct)
    .commit();

when(`when message: "beliitem"`) // Alias Indonesia
    .expect("id")
    .perform(store.performBuyProduct)
    .commit();

// --- LIBRARY ---
when(`when message: "library"`)
    .perform(store.performLibrary)
    .commit();

when(`when message: "lib"`) // Alias singkat
    .perform(store.performLibrary)
    .commit();

// --- AI TOOLS (Owner Only) ---
when(`when message: "setkey"`)
    .expect("key")
    .perform(ai.performSetKey)
    .commit();

when(`when message: "makebook"`)
    .expect("topic")
    .perform(ai.performMakeBook)
    .commit();

when(`when message: "autopost"`)
    .expect("topic")
    .perform(ai.performAutoPost)
    .commit();