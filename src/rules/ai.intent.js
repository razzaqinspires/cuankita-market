const { when } = require('../engine/dsl');
const gemini = require('../services/geminiFeatures');
const registry = require('../engine/commandRegistry');

console.log("🧠 Loading Gemini AI Rules...");

// ==========================================
// 1. REGISTRASI MENU
// ==========================================

// Kategori: AI FEATURES (Public)
registry.register('analisa', 'AI FEATURES', 'Minta saran investasi ke Analis AI (Gemini)');
registry.register('tanya', 'AI FEATURES', 'Ngobrol dengan Ara (AI Assistant)', '[pertanyaan]');

// Kategori: ADMIN (Owner Only)
registry.register('setgemini', 'ADMIN', 'Set Google Gemini API Key', '[api_key]');


// ==========================================
// 2. DEFINISI NIAT (LOGIC MAPPING)
// ==========================================

// --- MARKET ANALYSIS (AI PREDICTION) ---
when(`when message: "analisa"`)
    .perform(gemini.performMarketAnalysis)
    .commit();

when(`when message: "analisis"`) // Alias
    .perform(gemini.performMarketAnalysis)
    .commit();

when(`when message: "predict"`) // Alias Inggris
    .perform(gemini.performMarketAnalysis)
    .commit();

// --- CHAT WITH ARA (PERSONA) ---
when(`when message: "tanya"`)
    .expect("query")
    .perform(gemini.performChat)
    .commit();

when(`when message: "ask"`) // Alias Inggris
    .expect("query")
    .perform(gemini.performChat)
    .commit();

when(`when message: "chat"`) // Alias umum
    .expect("query")
    .perform(gemini.performChat)
    .commit();

when(`when message: "ara"`) // Panggil nama
    .expect("query")
    .perform(gemini.performChat)
    .commit();

// --- CONFIGURATION (Owner Only) ---
when(`when message: "setgemini"`)
    .expect("key")
    .perform(gemini.performSetGeminiKey)
    .commit();