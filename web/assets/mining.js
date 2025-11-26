const terminal = document.getElementById('terminal');
const fans = document.querySelectorAll('.fan');
const btn = document.getElementById('startBtn');
const resultArea = document.getElementById('resultArea');
const hashCodeEl = document.getElementById('hashCode');

function log(text) {
    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerText = `> ${text}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

function generateDailyHash() {
    // Kode sederhana berbasis Tanggal + Jam agar validasinya mudah di Bot
    const date = new Date();
    const seed = date.getDate() + date.getHours(); // Berubah tiap jam
    const chars = "ABCDEF0123456789";
    let hash = "BOOST-";
    for(let i=0; i<6; i++) {
        // Simple pseudo-random based on seed
        hash += chars.charAt(Math.floor((Math.random() * seed * (i+1)) % chars.length));
    }
    // Tambahkan jam asli di belakang (tersembunyi/encoded) untuk validasi
    // Biar gampang, kita hardcode logic di bot nanti untuk mengenali pola ini
    return hash + date.getHours(); 
}

async function startMining() {
    btn.disabled = true;
    btn.innerText = "MINING IN PROGRESS...";
    resultArea.style.display = 'none';
    
    // Start Animations
    fans.forEach(f => f.classList.add('spinning'));
    
    const logs = [
        "Connecting to $ARA Blockchain...",
        "Allocating DAG file...",
        "Hashrate: 45 MH/s",
        "Hashrate: 52 MH/s",
        "Accepting shares...",
        "Verifying Proof of Work...",
        "Solving block...",
        "BLOCK FOUND!"
    ];

    for (let i = 0; i < logs.length; i++) {
        await new Promise(r => setTimeout(r, 800)); // Delay tiap baris
        log(logs[i]);
    }

    // Finish
    fans.forEach(f => f.classList.remove('spinning'));
    btn.innerText = "MINING COOLDOWN";
    
    // Show Code
    const code = generateDailyHash();
    hashCodeEl.innerText = code;
    resultArea.style.display = 'block';
    
    log(`SUCCESS: Hash generated [${code}]`);
    
    // Enable button again after 10 seconds (Demo mode)
    setTimeout(() => {
        btn.disabled = false;
        btn.innerText = "START MINING";
    }, 10000);
}