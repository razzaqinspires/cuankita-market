/**
 * GENERAL HELPER UTILITIES
 * Kumpulan fungsi yang sering digunakan: formatting, messaging, sleep.
 */

/**
 * Memformat angka menjadi format Rupiah.
 * @param {number} number
 * @returns {string} Contoh: Rp 1.500.000
 */
function formatRupiah(number) {
    if (typeof number !== 'number') {
        number = Number(number) || 0;
    }
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
}

/**
 * Memformat angka biasa dengan separator ribuan.
 * @param {number} number
 * @returns {string} Contoh: 1,500,000
 */
function formatNumber(number) {
    if (typeof number !== 'number') {
        number = Number(number) || 0;
    }
    return new Intl.NumberFormat('id-ID').format(number);
}

/**
 * Wrapper untuk mengirim pesan teks sederhana.
 * @param {import('@whiskeysockets/baileys').WASocket} sock
 * @param {string} jid
 * @param {string} text
 */
async function sendText(sock, jid, text) {
    if (sock && jid && text) {
        return sock.sendMessage(jid, { text: text });
    }
}

/**
 * Menghasilkan ID unik sederhana dengan prefix (misal untuk Transaksi).
 * @param {string} prefix
 * @returns {string} Contoh: TRX-1717000000000-ABC
 */
function getRandomID(prefix = 'TRX') {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${randomSuffix}`;
}

/**
 * Fungsi delay asynchronous.
 * @param {number} ms - Milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    formatRupiah,
    formatNumber,
    sendText,
    getRandomID,
    sleep
};