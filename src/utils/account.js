/**
 * ACCOUNT MANAGER HELPER
 * Mengatur pemisahan total antara Saldo REAL dan DEMO.
 * Memastikan fitur trading, mining, dan finance menggunakan dompet yang benar.
 */

/**
 * Mendapatkan pointer ke dompet yang aktif (Real/Demo).
 * @param {object} user - Objek user dari database
 * @returns {object} Metadata dompet aktif (Key dan Value)
 */
function getWallet(user) {
    // 1. Tentukan Mode (Default ke DEMO jika belum diset)
    // Hanya jika user.account_type eksplesit 'REAL', baru kita kasih akses Real.
    const mode = (user.account_type === 'REAL') ? 'REAL' : 'DEMO';
    const suffix = mode.toLowerCase(); // 'real' atau 'demo'

    // 2. Tentukan Nama Key di Database
    // Contoh: balance_real, assets_demo, positions_real
    const balanceKey = `balance_${suffix}`;
    const assetKey = `assets_${suffix}`;
    const posKey = `positions_${suffix}`;

    // 3. Return Object Helper
    return {
        mode: mode,       // String: 'REAL' atau 'DEMO'
        suffix: suffix,   // String: 'real' atau 'demo'
        
        // Key Names (Untuk update database manual: user[wallet.balanceKey] = ...)
        balanceKey: balanceKey,
        assetKey: assetKey,
        posKey: posKey,
        
        // Current Values (Untuk pembacaan cepat)
        balance: user[balanceKey] || 0,
        assets: user[assetKey] || {},
        positions: user[posKey] || []
    };
}

/**
 * Helper untuk inisialisasi struktur akun jika user baru/kosong.
 * @param {object} user - Objek user
 */
function initUserStructure(user) {
    if (!user.balance_demo) user.balance_demo = 500000; // Modal Awal Demo
    if (!user.balance_real) user.balance_real = 0;
    
    if (!user.assets_demo) user.assets_demo = {};
    if (!user.assets_real) user.assets_real = {};
    
    if (!user.positions_demo) user.positions_demo = [];
    if (!user.positions_real) user.positions_real = [];
    
    if (!user.account_type) user.account_type = 'DEMO';
    
    return user;
}

module.exports = { getWallet, initUserStructure };