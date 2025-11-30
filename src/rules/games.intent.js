const { when } = require('../engine/dsl');
const games = require('../services/games');
const registry = require('../engine/commandRegistry');

console.log("🎮 Loading Game Rules...");

// ==========================================
// 1. REGISTRASI MENU
// ==========================================

// Kategori: GAME ZONE (Hiburan & Bakar Saldo)
registry.register('slot', 'GAME ZONE', 'Main Slot Machine (Jackpot 50x)', '[bet]');
registry.register('coin', 'GAME ZONE', 'Judi Koin 50:50 (Head/Tail)', '[side] [bet]');
registry.register('dice', 'GAME ZONE', 'Tebak Dadu (Win 5x)', '[angka 1-6] [bet]');


// ==========================================
// 2. DEFINISI NIAT (LOGIC MAPPING)
// ==========================================

// --- SLOT MACHINE ---
when(`when message: "slot"`)
    .expect("bet")
    .perform(games.performSlot)
    .commit();

when(`when message: "judi"`) // Alias Indonesia
    .expect("bet")
    .perform(games.performSlot)
    .commit();

when(`when message: "spin"`) // Alias Inggris
    .expect("bet")
    .perform(games.performSlot)
    .commit();

// --- COIN FLIP ---
when(`when message: "coin"`)
    .expect("side")
    .expect("bet")
    .perform(games.performCoinFlip)
    .commit();

when(`when message: "koin"`) // Alias Indonesia
    .expect("side")
    .expect("bet")
    .perform(games.performCoinFlip)
    .commit();

when(`when message: "flip"`) // Alias Inggris
    .expect("side")
    .expect("bet")
    .perform(games.performCoinFlip)
    .commit();

// --- DICE ROLL ---
when(`when message: "dice"`)
    .expect("guess")
    .expect("bet")
    .perform(games.performDice)
    .commit();

when(`when message: "dadu"`) // Alias Indonesia
    .expect("guess")
    .expect("bet")
    .perform(games.performDice)
    .commit();

when(`when message: "roll"`) // Alias Inggris
    .expect("guess")
    .expect("bet")
    .perform(games.performDice)
    .commit();