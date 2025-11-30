const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * THE VAULT ARCHITECTURE v2.0
 * Mengelola penyimpanan data dengan strategi Atomic Write & Cold Storage.
 * Menjamin data tidak rusak meski listrik mati saat save.
 */

// --- ZONASI FOLDER AMAN ---
// Naik 2 level dari src/database/core.js ke root project
const ROOT_DIR = path.resolve(__dirname, '../../');
const STORAGE_PATH = path.join(ROOT_DIR, 'storage');

const ZONES = {
    LIVE: path.join(STORAGE_PATH, 'live'),       // Zona Panas (Data Aktif)
    TEMP: path.join(STORAGE_PATH, 'temp'),       // Zona Masak (Buffer Penulisan)
    BACKUP: path.join(STORAGE_PATH, 'backups'),  // Zona Snapshot (Manual Backup)
    ARCHIVE: path.join(STORAGE_PATH, 'archives'),// Zona Dingin (Log Tahunan)
    INSPECTION: path.join(STORAGE_PATH, 'inspection') // Zona Bedah (Lihat Arsip)
};

class DatabaseVault {
    constructor() {
        this.cache = {}; // Memory cache agar baca cepat (RAM)
        this._initializeVault();
    }

    // 1. AUTO INIT: Membuat folder otomatis jika tidak ada
    _initializeVault() {
        console.log('🛡️  Memeriksa Integritas Vault Storage...');
        Object.entries(ZONES).forEach(([zoneName, zonePath]) => {
            if (!fs.existsSync(zonePath)) {
                // console.log(`🔨 Membangun zona: ${zoneName}`);
                fs.mkdirSync(zonePath, { recursive: true });
            }
        });
        
        // Bersihkan temp sisa crash sebelumnya agar bersih
        this._cleanTempZone();
    }

    _cleanTempZone() {
        if (fs.existsSync(ZONES.TEMP)) {
            const files = fs.readdirSync(ZONES.TEMP);
            for (const file of files) {
                fs.unlinkSync(path.join(ZONES.TEMP, file));
            }
        }
    }

    // 2. SAFE LOAD: Membaca data dengan fallback aman
    load(collection) {
        // Cek Cache Memory dulu (Tercepat)
        if (this.cache[collection]) return this.cache[collection];

        const filePath = path.join(ZONES.LIVE, `${collection}.json`);
        
        if (!fs.existsSync(filePath)) {
            // Jika file belum ada, kembalikan object kosong & cache
            this.cache[collection] = {};
            return {};
        }

        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);
            this.cache[collection] = data; // Simpan ke RAM
            return data;
        } catch (error) {
            console.error(`🚨 CRITICAL: File ${collection} KORUP!`);
            // TODO: Implement logic auto-restore from backup here
            return {};
        }
    }

    // 3. ATOMIC WRITE: Tulis Temp -> Rename (Anti Crash)
    save(collection, data) {
        this.cache[collection] = data; // Update cache RAM

        const fileName = `${collection}.json`;
        // Nama file temp unik dengan timestamp
        const tempPath = path.join(ZONES.TEMP, `${fileName}.tmp-${Date.now()}`);
        const livePath = path.join(ZONES.LIVE, fileName);

        try {
            const jsonString = JSON.stringify(data, null, 2);

            // A. Tulis ke TEMP
            fs.writeFileSync(tempPath, jsonString);

            // B. Flush ke disk (memastikan data tertulis fisik, bukan cuma di buffer OS)
            const fd = fs.openSync(tempPath, 'r+');
            fs.fsyncSync(fd);
            fs.closeSync(fd);

            // C. ATOMIC RENAME (Operasi instan OS, menggantikan file lama dengan aman)
            fs.renameSync(tempPath, livePath);

            return true;
        } catch (error) {
            console.error(`❌ GAGAL SAVE ${collection}:`, error);
            return false;
        }
    }

    // 4. AUTO ROTATION: Pengarsipan Log Transaksi
    rotateLog(collectionName, maxSizeMB = 5) {
        const livePath = path.join(ZONES.LIVE, `${collectionName}.json`);
        if (!fs.existsSync(livePath)) return;

        try {
            const stats = fs.statSync(livePath);
            const maxBytes = maxSizeMB * 1024 * 1024;

            if (stats.size > maxBytes) {
                console.log(`📦 Rotasi Arsip dimulai untuk: ${collectionName}`);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const year = new Date().getFullYear().toString();
                
                // Folder Tahun
                const archiveYearDir = path.join(ZONES.ARCHIVE, year);
                if (!fs.existsSync(archiveYearDir)) fs.mkdirSync(archiveYearDir, { recursive: true });

                const archiveFile = path.join(archiveYearDir, `${collectionName}-${timestamp}.json.gz`);

                // Baca -> Kompres (GZIP) -> Simpan
                const rawData = fs.readFileSync(livePath);
                const compressed = zlib.gzipSync(rawData);
                fs.writeFileSync(archiveFile, compressed);

                // Kosongkan Live Data (Reset)
                this.save(collectionName, {}); 
                console.log(`✅ Arsip tersimpan: ${archiveFile}`);
            }
        } catch (e) {
            console.error("Gagal Rotasi Log:", e);
        }
    }

    // 5. INSPECTION: Bedah Arsip Tanpa Merusak
    inspect(year, filename) {
        const archivePath = path.join(ZONES.ARCHIVE, year.toString(), filename);
        if (!fs.existsSync(archivePath)) return null;

        try {
            const compressed = fs.readFileSync(archivePath);
            const unzipped = zlib.gunzipSync(compressed);
            
            // Tulis hasil ekstrak ke zona inspection
            const inspectFile = path.join(ZONES.INSPECTION, `view-${filename.replace('.gz', '')}`);
            fs.writeFileSync(inspectFile, unzipped);
            
            return JSON.parse(unzipped.toString());
        } catch (error) {
            console.error("Gagal inspeksi:", error);
            return null;
        }
    }
}

// Export Instance Singleton (Satu database manager untuk seluruh aplikasi)
module.exports = new DatabaseVault();