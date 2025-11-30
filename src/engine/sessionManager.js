/**
 * SESSION MANAGER SYSTEM
 * Mengelola State (Status) User: Onboarding, Menunggu Reply, Pending Deposit.
 * Berfungsi sebagai Short-Term Memory bot.
 */

// Penyimpanan sesi di Memori RAM (Map)
// Format: Key = JID User, Value = Object { type, data, timestamp }
const sessions = new Map();

/**
 * Menyimpan status user saat ini.
 * @param {string} jid - ID WhatsApp User (nomor@s.whatsapp.net)
 * @param {string} type - Jenis aktivitas (misal: 'ONBOARDING_NAME', 'DEPOSIT_SELECT_METHOD')
 * @param {object} data - Data tambahan (misal: nominal deposit yang sedang diproses)
 */
function setSession(jid, type, data = {}) {
    sessions.set(jid, {
        type: type,
        data: data,
        timestamp: Date.now()
    });
    // console.log(`💾 Session SET for ${jid}: ${type}`);
}

/**
 * Mengambil status user saat ini.
 * @param {string} jid - ID WhatsApp User
 * @returns {object|undefined} Objek sesi atau undefined jika tidak ada sesi
 */
function getSession(jid) {
    return sessions.get(jid);
}

/**
 * Menghapus sesi user (digunakan saat proses selesai atau dibatalkan).
 * @param {string} jid - ID WhatsApp User
 */
function clearSession(jid) {
    if (sessions.has(jid)) {
        sessions.delete(jid);
        // console.log(`🗑️ Session CLEARED for ${jid}`);
    }
}

/**
 * Mengecek apakah user sedang dalam posisi terkunci (Locked Transaction).
 * Digunakan agar user tidak bisa melakukan spam command lain saat sedang transaksi penting.
 * @param {string} jid - ID WhatsApp User
 * @returns {boolean} True jika terkunci
 */
function isLocked(jid) {
    const sess = sessions.get(jid);
    
    // Cek tipe sesi
    if (sess && sess.type === 'LOCKED_TRANSACTION') {
        const diff = Date.now() - sess.timestamp;
        const timeout = 30 * 60 * 1000; // Timeout 30 Menit
        
        // Jika sudah lebih dari 30 menit gantung, otomatis buka kunci
        if (diff > timeout) {
            clearSession(jid);
            console.log(`🔓 Auto-unlock session for ${jid} (Timeout)`);
            return false;
        }
        return true; // Masih terkunci
    }
    
    return false; // Tidak terkunci
}

module.exports = { 
    setSession, 
    getSession, 
    clearSession, 
    isLocked 
};