/**
 * CUANKITA QUANTUM ENGINE V3.0
 * Procedural Animation, Particle System & Idle Game Logic
 * Handles the "Inner Game" (Core, Drones, Upgrades)
 */

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Game State
        this.hashRate = 0;
        this.sessionTokens = 0; // Token sementara untuk beli upgrade di web
        this.lastUpdate = Date.now();
        this.overdrive = false;
        
        // Entities Containers
        this.core = { x: this.width/2, y: this.height/2, radius: 70, pulse: 0 };
        this.drones = [];
        this.particles = [];
        this.floatText = [];

        // Inventory System (Persistent via LocalStorage)
        this.loadSave();
        
        // Init
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Render UI Inventory
        this.initInventoryUI();
        
        // Start Loop
        this.loop();

        // Auto-Save interval (5 detik)
        setInterval(() => this.saveGame(), 5000);
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.core.x = this.width / 2;
        this.core.y = this.height / 2;
    }

    // --- SAVE/LOAD SYSTEM ---
    loadSave() {
        const save = JSON.parse(localStorage.getItem('miningSave')) || {};
        this.upgrades = save.upgrades || {
            'drone': { lvl: 1, name: 'Nano Drone', cost: 100, rate: 5 },
            'cooling': { lvl: 1, name: 'Cryo Cooler', cost: 250, rate: 0 }, // Passive multiplier
            'ai': { lvl: 0, name: 'AI Node', cost: 1000, rate: 25 }
        };
        this.sessionTokens = save.tokens || 0;
        this.recalcHashrate();
        this.spawnDrones();
    }

    saveGame() {
        localStorage.setItem('miningSave', JSON.stringify({ 
            upgrades: this.upgrades,
            tokens: this.sessionTokens
        }));
    }

    recalcHashrate() {
        let base = 0;
        // Hitung base hashrate dari item
        base += (this.upgrades.drone.lvl * this.upgrades.drone.rate);
        base += (this.upgrades.ai.lvl * this.upgrades.ai.rate);
        
        // Multiplier dari cooling system
        const mult = 1 + (this.upgrades.cooling.lvl * 0.1); // Tiap level nambah 10% efisiensi
        
        // Total
        this.hashRate = Math.floor(base * mult);
        
        // Update UI Text
        const hashDisplay = document.getElementById('hashDisplay');
        if(hashDisplay) hashDisplay.innerText = this.hashRate + " MH/s";
    }

    // --- ENTITY MANAGEMENT ---
    spawnDrones() {
        this.drones = [];
        const count = Math.min(this.upgrades.drone.lvl, 20); // Max 20 visual drones biar ga lag
        for(let i=0; i<count; i++) {
            this.drones.push({
                angle: (Math.PI * 2 / count) * i,
                dist: 140 + Math.random() * 60, // Jarak orbit
                speed: 0.01 + Math.random() * 0.02, // Kecepatan orbit
                size: 2 + Math.random() * 2,
                color: Math.random() > 0.5 ? '#00F0FF' : '#ffffff'
            });
        }
    }

    spawnFloatText(x, y, text, color) {
        this.floatText.push({x, y, text, color, life: 1.0, dy: 0});
    }

    // --- INTERACTION ---
    buyUpgrade(key) {
        const item = this.upgrades[key];
        
        if (this.sessionTokens >= item.cost) {
            this.sessionTokens -= item.cost;
            
            // Level Up Logic
            item.lvl++;
            item.cost = Math.floor(item.cost * 1.6); // Harga naik eksponensial
            
            this.recalcHashrate();
            if(key === 'drone') this.spawnDrones();
            
            this.initInventoryUI(); // Refresh UI harga
            this.spawnFloatText(this.width/2, this.height - 150, "UPGRADE SUCCESS!", "#00F0FF");
            this.saveGame();
        } else {
            this.spawnFloatText(this.width/2, this.height - 150, "INSUFFICIENT DATA", "#FF003C");
        }
    }

    // Triggered by HTML Button
    activateOverdrive() {
        // Panggil fungsi utama di mining.js (logic cooldown & hash)
        if (typeof startSequence === 'function') {
            startSequence(); 
        }

        // Visual Effects only
        this.overdrive = true;
        this.spawnFloatText(this.width/2, this.height/2, "OVERDRIVE ACTIVATED", "#FFD700");
        
        // Particle Explosion
        for(let i=0; i<40; i++) {
            this.particles.push({
                x: this.width/2, y: this.height/2,
                vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
                life: 1.0, color: '#FFD700', size: Math.random()*3
            });
        }

        // Reset visual overdrive after 3s
        setTimeout(() => { this.overdrive = false; }, 3000); 
    }

    // --- RENDERING LOOP ---
    drawCore() {
        const ctx = this.ctx;
        const cx = this.core.x;
        const cy = this.core.y;
        
        // Dynamic Pulse
        const pulse = Math.sin(Date.now() * 0.005) * 5;
        
        // Outer Glow
        const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 120 + pulse);
        grad.addColorStop(0, this.overdrive ? 'rgba(255, 215, 0, 0.4)' : 'rgba(0, 240, 255, 0.1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI*2); ctx.fill();

        // Core Geometry (Hexagons)
        ctx.strokeStyle = this.overdrive ? '#FFD700' : '#00F0FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(let i=0; i<6; i++) {
            const ang = (Math.PI/3 * i) + (Date.now() * 0.0005);
            const r = this.core.radius + pulse;
            const x = cx + Math.cos(ang) * r;
            const y = cy + Math.sin(ang) * r;
            if(i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        // Inner Rings
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath(); ctx.arc(cx, cy, this.core.radius * 1.5, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, this.core.radius * 2.2, 0, Math.PI*2); ctx.stroke();
    }

    drawDrones() {
        const ctx = this.ctx;
        const cx = this.core.x;
        const cy = this.core.y;

        this.drones.forEach(d => {
            // Update position
            let speed = this.overdrive ? d.speed * 8 : d.speed;
            d.angle += speed;
            
            const x = cx + Math.cos(d.angle) * d.dist;
            const y = cy + Math.sin(d.angle) * d.dist;

            // Draw Drone Body
            ctx.fillStyle = d.color;
            ctx.shadowColor = d.color;
            ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(x, y, d.size, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0; // Reset
            
            // Draw Laser Beam to Core (Randomly)
            if (Math.random() > 0.92) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(cx, cy);
                ctx.strokeStyle = `rgba(0, 240, 255, ${Math.random() * 0.5})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
                
                // Spawn impact particle
                this.particles.push({
                    x: cx, y: cy,
                    vx: (x - cx) * 0.02, vy: (y - cy) * 0.02, // Reverse direction out
                    life: 0.4, color: '#00F0FF', size: 1
                });
            }
        });
    }

    drawParticles() {
        const ctx = this.ctx;
        for(let i = this.particles.length-1; i>=0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            
            if(p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    drawUI() {
        const ctx = this.ctx;
        // Floating Text Animation
        ctx.font = "bold 16px 'Rajdhani'";
        ctx.textAlign = "center";
        for(let i = this.floatText.length-1; i>=0; i--) {
            const t = this.floatText[i];
            t.y -= 1; // Float up
            t.life -= 0.015;
            if(t.life <= 0) { this.floatText.splice(i, 1); continue; }
            
            ctx.fillStyle = t.color;
            ctx.globalAlpha = t.life;
            ctx.fillText(t.text, t.x, t.y);
            ctx.globalAlpha = 1.0;
        }
    }

    updateLogic() {
        // Generate Session Token (Visual Currency for this minigame)
        // Ini HANYA untuk beli upgrade di web, tidak masuk ke saldo Bot WA
        // Token Bot WA didapat dari kode hash.
        const now = Date.now();
        const delta = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
        
        if (this.hashRate > 0) {
            this.sessionTokens += (this.hashRate * delta * 0.1);
            
            // Update UI Balance
            const balanceEl = document.getElementById('sessionReward');
            if(balanceEl) balanceEl.innerText = Math.floor(this.sessionTokens).toLocaleString();
        }
    }

    loop() {
        // Clear Canvas with Fade Effect (untuk trail)
        this.ctx.fillStyle = 'rgba(5, 7, 10, 0.2)'; 
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.updateLogic();
        this.drawCore();
        this.drawDrones();
        this.drawParticles();
        this.drawUI();

        requestAnimationFrame(() => this.loop());
    }

    // --- UI GENERATOR ---
    initInventoryUI() {
        const container = document.getElementById('inventory');
        if(!container) return;
        
        container.innerHTML = '';

        Object.keys(this.upgrades).forEach(key => {
            const item = this.upgrades[key];
            
            // SVG Icons defined inline
            let svg = '';
            if (key === 'drone') svg = `<svg viewBox="0 0 24 24" fill="none" stroke="#00F0FF" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 9V5 M12 19v-4 M19 12h4 M5 12H1"/></svg>`;
            if (key === 'cooling') svg = `<svg viewBox="0 0 24 24" fill="none" stroke="#00F0FF" stroke-width="2"><path d="M12 2v20 M2 12h20 M4.93 4.93l14.14 14.14 M4.93 19.07l14.14-14.14"/></svg>`;
            if (key === 'ai') svg = `<svg viewBox="0 0 24 24" fill="none" stroke="#D4AF37" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`;

            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div class="item-lvl">LVL ${item.lvl}</div>
                <div class="item-icon">${svg}</div>
                <div class="item-name">${item.name}</div>
                <div class="item-cost">${item.cost} DATA</div>
            `;
            
            // Click Event
            card.onclick = () => this.buyUpgrade(key);
            
            container.appendChild(card);
        });
    }
}

// --- INITIALIZATION ---
// Start Game Engine
const game = new Game();