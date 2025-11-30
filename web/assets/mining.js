/**
 * CUANKITA QUANTUM MINER LOGIC
 * Handles Visuals, Mining Sequence, and Cooldown Persistence.
 */

// --- CONFIGURATION ---
const COOLDOWN_MS = 60 * 60 * 1000; // 1 JAM (60 Menit)

// --- DOM ELEMENTS ---
const terminal = document.getElementById('terminal');
const btn = document.getElementById('mineBtn');
const resultBox = document.getElementById('resultBox'); // Hash Box
const hashDisplay = document.getElementById('finalHash'); // Text Hash inside modal
const cooldownDisplay = document.getElementById('cooldownDisplay');
const timerEl = document.getElementById('timer');
const coreStatus = document.getElementById('coreStatus');
const coreAnim = document.getElementById('coreAnim');
const fans = document.querySelectorAll('.fan');
const modal = document.getElementById('rewardModal'); // Modal Pop-up

// --- 1. BACKGROUND PARTICLE SYSTEM (VISUAL EFFECT) ---
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');

// Resize Canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const particles = [];
class Particle {
    constructor() {
        this.reset();
    }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2;
        this.speedX = (Math.random() * 1) - 0.5;
        this.speedY = (Math.random() * 1) - 0.5;
        this.opacity = Math.random() * 0.5 + 0.1;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        // Wrap around screen
        if (this.x > canvas.width) this.x = 0;
        else if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        else if (this.y < 0) this.y = canvas.height;
    }
    draw() {
        ctx.fillStyle = `rgba(0, 243, 255, ${this.opacity})`; // Cyan Neon
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Init Particles
for (let i = 0; i < 80; i++) particles.push(new Particle());

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw connecting lines (Network effect)
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        
        // Connect nearby particles
        for (let j = i; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < 100) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
    requestAnimationFrame(animateParticles);
}
animateParticles();


// --- 2. GAME LOGIC & STATE MANAGEMENT ---

function log(text) {
    const div = document.createElement('div');
    div.className = 'log-line';
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    div.innerHTML = `<span style="color:#555">[${time}]</span> ${text}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

// Generate Kode Unik untuk Validasi Bot
function generateHash() {
    const date = new Date();
    // Seed sederhana berbasis jam agar hash berubah tiap jam
    const seed = date.getDate() + date.getHours(); 
    const chars = "ABCDEF0123456789";
    let hash = "BOOST-";
    
    // Random string
    for(let i=0; i<6; i++) {
        // Pseudo-random formula
        const index = Math.floor((Math.random() * 100 * (i+1)) + seed) % chars.length;
        hash += chars.charAt(index);
    }
    
    // Tambahkan jam saat ini di akhir (tersembunyi dalam logika bot) untuk validasi waktu
    return hash + date.getHours(); 
}

// Mengatur Tampilan berdasarkan Status (IDLE / MINING / COOLDOWN)
function setVisualState(state) {
    if (state === 'IDLE') {
        // Core Status
        coreStatus.innerText = "IDLE";
        coreStatus.style.color = "#fff";
        coreStatus.style.textShadow = "none";
        
        // Animation
        coreAnim.style.animationDuration = "0s"; // Stop spinning
        coreAnim.style.opacity = "0.3";
        
        // Fans
        fans.forEach(f => {
            f.style.borderColor = "#333";
            f.style.boxShadow = "none";
            f.querySelector('svg').style.animation = "none";
            f.querySelector('svg').style.fill = "#555";
        });

        // Button
        btn.style.display = 'block';
        btn.disabled = false;
        btn.innerText = "INITIALIZE SEQUENCE";
        
        // Cooldown
        cooldownDisplay.style.display = 'none';
        cooldownDisplay.classList.remove('active');

    } else if (state === 'MINING') {
        // Core Status
        coreStatus.innerText = "RUNNING";
        coreStatus.style.color = "#00F0FF";
        coreStatus.style.textShadow = "0 0 15px #00F0FF";
        
        // Animation
        coreAnim.style.animationDuration = "0.5s"; // Fast spin
        coreAnim.style.opacity = "1";
        
        // Fans
        fans.forEach(f => {
            f.style.borderColor = "#00F0FF";
            f.style.boxShadow = "0 0 10px rgba(0, 240, 255, 0.5)";
            f.querySelector('svg').style.animation = "spin 0.2s linear infinite"; // Fast fan
            f.querySelector('svg').style.fill = "#00F0FF";
        });

        // Button
        btn.disabled = true;
        btn.innerText = "SEQUENCE RUNNING...";
        btn.style.background = "#333";
        btn.style.color = "#888";
        btn.style.boxShadow = "none";

    } else if (state === 'COOLDOWN') {
        // Core Status
        coreStatus.innerText = "OVERHEAT";
        coreStatus.style.color = "#FF003C"; // Red
        coreStatus.style.textShadow = "0 0 15px #FF003C";
        
        // Animation
        coreAnim.style.animationDuration = "10s"; // Very slow
        coreAnim.style.opacity = "0.5";
        
        // Fans
        fans.forEach(f => {
            f.style.borderColor = "#FF003C";
            f.style.boxShadow = "none";
            f.querySelector('svg').style.animation = "spin 5s linear infinite"; // Slow fan
            f.querySelector('svg').style.fill = "#FF003C";
        });

        // Button
        btn.style.display = 'none'; // Hide button
        
        // Show Timer Overlay
        cooldownDisplay.classList.add('active');
        cooldownDisplay.style.display = 'block';
    }
}

// --- 3. COOLDOWN TIMER SYSTEM ---

function checkCooldown() {
    const lastMine = localStorage.getItem('lastMineTime');
    if (lastMine) {
        const diff = Date.now() - parseInt(lastMine);
        
        // Jika masih dalam masa cooldown
        if (diff < COOLDOWN_MS) {
            const remaining = COOLDOWN_MS - diff;
            startCooldownTimer(remaining);
            return true;
        } else {
            // Sudah lewat masa cooldown
            localStorage.removeItem('lastMineTime');
            return false;
        }
    }
    return false;
}

function startCooldownTimer(remainingTime) {
    setVisualState('COOLDOWN');
    
    // Interval update timer setiap detik
    const interval = setInterval(() => {
        remainingTime -= 1000;
        
        if (remainingTime <= 0) {
            clearInterval(interval);
            localStorage.removeItem('lastMineTime');
            setVisualState('IDLE');
            log("System cooled down. Ready for next sequence.");
        } else {
            // Format Menit:Detik
            const m = Math.floor(remainingTime / 60000);
            const s = Math.floor((remainingTime % 60000) / 1000);
            // Tambahkan leading zero (09:05)
            const mStr = m < 10 ? "0" + m : m;
            const sStr = s < 10 ? "0" + s : s;
            
            timerEl.innerText = `${mStr}:${sStr}`;
        }
    }, 1000);
}

// --- 4. MAIN ACTION SEQUENCE ---

async function startSequence() {
    // Double check sebelum mulai
    if (checkCooldown()) return;

    setVisualState('MINING');
    
    // Simulasi Log Terminal
    const logs = [
        "Connecting to node pool...",
        "Verifying blockchain integrity...",
        "Allocating GPU resources...",
        "<span style='color:#00F0FF'>Hashrate stable: 145 MH/s</span>",
        "Solving block #99281...",
        "Proof of Work accepted!",
        "<span style='color:#FFD700'>BLOCK REWARD FOUND!</span>"
    ];

    // Loop logs dengan delay random
    for (let i = 0; i < logs.length; i++) {
        await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
        log(logs[i]);
    }

    // Generate Hash & Show Modal
    const code = generateHash();
    hashDisplay.innerText = code;
    modal.classList.add('active'); // Tampilkan Modal
    
    log(`Success: Hash generated [${code}]`);

    // Set Waktu Mulai Cooldown
    localStorage.setItem('lastMineTime', Date.now().toString());
    
    // Mulai Timer (User bisa close modal tapi timer jalan terus di background)
    startCooldownTimer(COOLDOWN_MS);
}

// Helper untuk menutup modal
window.closeModal = function() {
    modal.classList.remove('active');
}

// --- INIT ---
// Cek status saat halaman dimuat
if (!checkCooldown()) {
    setVisualState('IDLE');
    log("Terminal initialized. Waiting for input.");
} else {
    log("System is in cooling state.");
}