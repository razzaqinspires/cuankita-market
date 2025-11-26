/**
 * SESSION MANAGER
 * Mengelola State (Status) User: Onboarding, Menunggu Reply, Pending Deposit.
 */

const sessions = new Map();

// Set status user (sedang ngapain)
function setSession(jid, type, data = {}) {
  sessions.set(jid, {
    type: type, // Contoh: 'ONBOARDING_NAME', 'WAIT_PROOF'
    data: data, // Data sementara (nama, gender, trx_id)
    timestamp: Date.now(),
  });
}

// Ambil status user
function getSession(jid) {
  return sessions.get(jid);
}

// Hapus sesi (selesai)
function clearSession(jid) {
  sessions.delete(jid);
}

// Cek apakah user sedang terkunci (misal: Pending Deposit)
function isLocked(jid) {
  const sess = sessions.get(jid);
  if (sess && sess.type === "LOCKED_TRANSACTION") {
    const diff = Date.now() - sess.timestamp;
    const timeout = 30 * 60 * 1000; // 30 Menit Lock
    if (diff > timeout) {
      clearSession(jid); // Auto unlock jika kelamaan
      return false;
    }
    return true;
  }
  return false;
}

module.exports = { setSession, getSession, clearSession, isLocked };
