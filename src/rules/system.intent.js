const { when } = require('../engine/dsl');
const system = require('../services/system');
const registry = require('../engine/commandRegistry');

console.log("🛡️ Loading System Rules...");

// ==========================================
// 1. REGISTRASI MENU (ADMIN CATEGORY)
// ==========================================

// Kategori: SISTEM (Public)
registry.register('system', 'SISTEM', 'Cek statistik server (RAM/Uptime)');

// Kategori: ADMIN (Owner Only)
registry.register('backup', 'ADMIN', 'Download backup database lengkap');
registry.register('ban', 'ADMIN', 'Blokir user selamanya', '[nomor]');
registry.register('unban', 'ADMIN', 'Buka blokir user', '[nomor]');
registry.register('addgroup', 'ADMIN', 'Whitelist bot agar bisa respon di grup', '[id_grup]');
registry.register('maintenance', 'ADMIN', 'Toggle Mode Maintenance (On/Off)');


// ==========================================
// 2. DEFINISI NIAT (LOGIC MAPPING)
// ==========================================

// --- SYSTEM STATS ---
when(`when message: "system"`)
    .perform(system.performSystemStats)
    .commit();

when(`when message: "stats"`) // Alias
    .perform(system.performSystemStats)
    .commit();

// --- BACKUP DATA ---
when(`when message: "backup"`)
    .perform(system.performBackup)
    .commit();

when(`when message: "db"`) // Alias singkat
    .perform(system.performBackup)
    .commit();

// --- SECURITY (BAN/UNBAN) ---
when(`when message: "ban"`)
    .expect("target")
    .perform(system.performBanUser)
    .commit();

when(`when message: "block"`) // Alias
    .expect("target")
    .perform(system.performBanUser)
    .commit();

when(`when message: "unban"`)
    .expect("target")
    .perform(system.performUnbanUser)
    .commit();

when(`when message: "unblock"`) // Alias
    .expect("target")
    .perform(system.performUnbanUser)
    .commit();

// --- GROUP MANAGEMENT ---
when(`when message: "addgroup"`)
    .perform(system.performAddGroup)
    .commit();

when(`when message: "join"`) // Alias
    .perform(system.performAddGroup)
    .commit();

// --- MAINTENANCE MODE ---
when(`when message: "maintenance"`)
    .perform(system.performMaintenanceToggle)
    .commit();

when(`when message: "mt"`) // Alias singkat
    .perform(system.performMaintenanceToggle)
    .commit();