/**
 * COMMAND REGISTRY SYSTEM
 * Sentralisasi metadata command untuk keperluan Auto-Menu dan Help.
 */

// Penyimpanan sementara (In-Memory)
const commands = [];
const categories = {};

/**
 * Mendaftarkan metadata sebuah command agar muncul di menu.
 * * @param {string} rawCommand - Kata kunci command (tanpa titik, misal: 'deposit')
 * @param {string} category - Kategori menu (misal: 'KEUANGAN', 'GAME', 'SYSTEM')
 * @param {string} description - Penjelasan singkat fungsi command
 * @param {string} args - (Opsional) Argumen yang dibutuhkan, misal: '[jumlah]'
 */
function register(rawCommand, category, description, args = '') {
    const entry = {
        rawCommand: rawCommand.toLowerCase(),
        category: category.toUpperCase(), // Paksa uppercase biar rapi
        description: description,
        args: args
    };

    // Simpan ke list flat
    commands.push(entry);

    // Simpan ke grouping kategori
    if (!categories[entry.category]) {
        categories[entry.category] = [];
    }
    categories[entry.category].push(entry);
}

/**
 * Mengambil seluruh command yang sudah dikelompokkan dan diurutkan.
 * Digunakan oleh service general.js untuk mencetak menu.
 * * @returns {object} Object dengan key Kategori dan value Array of Commands
 */
function getCategorizedCommands() {
    const sortedCategories = {};
    
    // 1. Ambil nama kategori dan urutkan A-Z
    const categoryKeys = Object.keys(categories).sort();
    
    // 2. Loop setiap kategori, lalu urutkan command di dalamnya A-Z
    for (const key of categoryKeys) {
        sortedCategories[key] = categories[key].sort((a, b) => 
            a.rawCommand.localeCompare(b.rawCommand)
        );
    }

    return sortedCategories;
}

/**
 * Mengambil total jumlah fitur yang terdaftar.
 */
function getTotalCommands() {
    return commands.length;
}

module.exports = { 
    register, 
    getCategorizedCommands,
    getTotalCommands
};