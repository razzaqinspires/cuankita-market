/**
 * Command Registry - Database Metadata Semua Command
 * Setiap rule baru wajib mendaftarkan dirinya ke sini agar muncul di menu.
 */

const commands = [];
const categories = {};

/**
 * Mendaftarkan metadata sebuah command.
 * @param {string} rawCommand - Kata kunci command (misal: 'deposit')
 * @param {string} category - Kategori (misal: 'KEUANGAN')
 * @param {string} description - Deskripsi fungsi command
 * @param {string} args - Argumen yang dibutuhkan (misal: '[jumlah]')
 */
function register(rawCommand, category, description, args = "") {
  const entry = {
    rawCommand: rawCommand.toLowerCase(),
    category: category,
    description: description,
    args: args,
  };
  commands.push(entry);

  if (!categories[category]) {
    categories[category] = [];
  }
  categories[category].push(entry);
}

/**
 * Mengambil semua command yang sudah dikategorikan dan diurutkan.
 * @returns {object} Objek berisi kategori sebagai key, dan array command di dalamnya.
 */
function getCategorizedCommands() {
  // 1. Urutkan Kategori (A-Z)
  const sortedCategories = {};
  const categoryKeys = Object.keys(categories).sort();

  // 2. Urutkan Command di dalam tiap Kategori (A-Z)
  for (const key of categoryKeys) {
    sortedCategories[key] = categories[key].sort((a, b) =>
      a.rawCommand.localeCompare(b.rawCommand),
    );
  }
  return sortedCategories;
}

module.exports = { register, getCategorizedCommands };
