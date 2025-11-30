module.exports = {
  apps : [{
    name   : "cuankita-autonomous",
    script : "./index.js",
    
    // Mode Eksekusi: fork adalah standar untuk bot tunggal
    exec_mode: "fork", 
    instances: 1,
    
    // Menonaktifkan watch agar PM2 tidak restart bot karena perubahan DB
    // Set ke true HANYA saat development.
    watch  : false,
    
    // Batas memori: Jika memori terpakai lebih dari 500MB, PM2 akan me-restart
    max_memory_restart: '500M',
    
    // Variabel Lingkungan
    env: {
        NODE_ENV: "production",
        PORT: 3000
    },

    // File/Folder yang diabaikan oleh Watcher (penting untuk stabilitas)
    ignore_watch: [
        "storage",
        "auth_info_baileys",
        "node_modules",
        "web/data/market.json" 
    ]
  }]
};