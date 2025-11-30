const { Canvas, Path2D } = require('skia-canvas');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');
const db = require('../database/core');
const path = require('path');
const fs = require('fs');

/**
 * 🚀 HYBRID RENDERING ENGINE v5.1 (OWNER EDITION)
 */

// --- VECTOR ASSETS ---
const ICONS = {
    chip: `
        <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#F7BF64;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#B4832E;stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect x="0" y="0" width="70" height="50" rx="8" fill="url(#goldGrad)" stroke="#8B6914" stroke-width="1"/>
        <path d="M20 0v50 M50 0v50 M0 18h20 M0 32h20 M50 18h20 M50 32h20 M28 12h14v26h-14z" stroke="rgba(0,0,0,0.2)" stroke-width="1.5" fill="none"/>
    `,
    wifi: `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-6-8c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm6-6c3.31 0 6 2.69 6 6 0 .34-.03.67-.08 1-.51 0-1.02-.03-1.52-.08.06-.3.1-.61.1-.92 0-2.48-2.02-4.5-4.5-4.5S7.5 9.52 7.5 12c0 .31.04.62.1.92-.5.05-1.01.08-1.52.08-.05-.33-.08-.66-.08-1 0-3.31 2.69-6 6-6z" fill="white" fill-opacity="0.6"/>`,
    logo: `<path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20H5.5L12 5.5z" fill="white" fill-opacity="0.9"/>`
};

// --- HELPER FUNCTIONS ---
function getRankMeta(level, isOwner) {
    // Jika Owner, Rank selalu Spesial
    if (isOwner) return { name: "SYSTEM OVERLORD", color: "#00FFFF" }; // Cyan Neon

    if (level < 5) return { name: "RETAIL INVESTOR", color: "#A0A0A0" }; 
    if (level < 10) return { name: "DAY TRADER", color: "#00d2ff" }; 
    if (level < 20) return { name: "FUND MANAGER", color: "#00ff00" }; 
    if (level < 50) return { name: "INSTITUTIONAL", color: "#FFD700" }; 
    return { name: "GLOBAL WHALE", color: "#FF0055" }; 
}

function formatCompact(num) {
    return Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 2 }).format(num);
}

// --- RENDERER ---

async function renderBaseLayer(width, height, isReal, isOwner) {
    const canvas = new Canvas(width, height);
    const ctx = canvas.getContext("2d");

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#08080a");
    bgGrad.addColorStop(1, "#121214");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Dynamic Lighting
    // Jika Owner -> Warna Cyan & Magenta (God Mode)
    // Jika Real -> Emas
    // Jika Demo -> Biru
    let primaryColor = isReal ? '#FFD700' : '#00d2ff';
    let secondaryColor = isReal ? '#FF4500' : '#7B68EE';
    
    if (isOwner) {
        primaryColor = '#00FFFF'; // Cyan
        secondaryColor = '#FF00FF'; // Magenta
    }

    ctx.filter = 'blur(120px)'; 
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(0, 0, 500, 0, Math.PI * 2); ctx.fillStyle = primaryColor; ctx.fill();
    ctx.beginPath(); ctx.arc(width, height, 400, 0, Math.PI * 2); ctx.fillStyle = secondaryColor; ctx.fill();
    ctx.filter = 'none'; ctx.globalAlpha = 1.0;

    // Noise
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 15;
        data[i] += noise; data[i+1] += noise; data[i+2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    // Glass Card
    const pad = 50;
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath(); ctx.roundRect(pad, pad, width - pad*2, height - pad*2, 32); ctx.fill();
    ctx.strokeStyle = isOwner ? "rgba(0, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.1)"; 
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    return await canvas.toBuffer('png');
}

function renderVectorLayer(width, height, user, jid, rankMeta, isOwner) {
    const saldo = isOwner ? (user.balance_real || 0) : (user.account_type === 'REAL' ? user.balance_real : user.balance_demo);
    const assetsData = isOwner ? (user.assets_real || {}) : (user.account_type === 'REAL' ? user.assets_real : user.assets_demo);
    const posData = isOwner ? (user.positions_real || []) : (user.account_type === 'REAL' ? user.positions_real : user.positions_demo);
    
    const araCoin = assetsData.ara_coin || 0;
    const market = db.load('market_data');
    const currentPrice = market.current_price || 1000;
    const assetsVal = araCoin * currentPrice;
    const totalWealth = saldo + assetsVal;
    
    const isReal = user.account_type === 'REAL';
    
    // LABELING KHUSUS OWNER
    let accLabel = isReal ? "PLATINUM / REAL" : "SANDBOX / DEMO";
    let accColor = isReal ? "#F7BF64" : "#A0A0A0";
    
    if (isOwner) {
        accLabel = "GOD MODE / OWNER";
        accColor = "#00FFFF"; // Cyan
    }
    
    const xp = user.xp || 0;
    const level = Math.floor(xp / 1000) + 1;
    const nextXp = level * 1000;
    const progress = Math.min((xp % 1000) / 1000, 1) * 100;

    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
            .font-title { font-family: sans-serif; font-weight: bold; font-size: 24px; fill: rgba(255,255,255,0.5); letter-spacing: 2px; }
            .font-balance { font-family: monospace; font-weight: bold; font-size: 70px; fill: white; filter: drop-shadow(0px 0px 15px ${rankMeta.color}88); }
            .font-name { font-family: sans-serif; font-weight: 800; font-size: 32px; fill: white; text-transform: uppercase; }
            .font-id { font-family: monospace; font-size: 22px; fill: rgba(255,255,255,0.6); letter-spacing: 2px; }
            .font-rank { font-family: sans-serif; font-weight: bold; font-size: 28px; fill: ${rankMeta.color}; text-anchor: end; }
            .font-label { font-family: sans-serif; font-size: 16px; fill: rgba(255,255,255,0.4); }
            .font-val { font-family: monospace; font-weight: bold; font-size: 24px; fill: white; }
            .font-brand { font-family: sans-serif; font-weight: bold; font-size: 24px; fill: rgba(255,255,255,0.4); text-anchor: end; }
        </style>
        <g transform="translate(100, 100)">${ICONS.chip}</g>
        <g transform="translate(1000, 100) scale(3)">${ICONS.wifi}</g>
        <g transform="translate(1080, 50) scale(2)">${ICONS.logo}</g>
        <text x="1115" y="150" class="font-brand">CUANKITA</text>
        
        <text x="100" y="240" class="font-title" style="fill:${accColor}">${accLabel}</text>
        <text x="100" y="290" class="font-label">TOTAL NET WORTH</text>
        <text x="95" y="360" class="font-balance">Rp ${formatCompact(totalWealth)}</text>
        
        <g transform="translate(100, 420)">
            <text x="0" y="0" class="font-label">CASH BALANCE</text>
            <text x="0" y="30" class="font-val">Rp ${saldo.toLocaleString('id-ID')}</text>
            <text x="350" y="0" class="font-label">TOKEN ASSETS</text>
            <text x="350" y="30" class="font-val">${araCoin.toLocaleString()} $ARA</text>
            <text x="700" y="0" class="font-label">ACTIVE TRADES</text>
            <text x="700" y="30" class="font-val">${posData?.length || 0} POSITIONS</text>
        </g>
        
        <g transform="translate(100, 600)">
            <text x="0" y="0" class="font-name">${user.name || 'INVESTOR'}</text>
            <text x="0" y="30" class="font-id">${jid.split('@')[0]}</text>
        </g>
        
        <g transform="translate(1100, 600)">
            <text x="0" y="0" class="font-rank">${rankMeta.name} • LVL ${level}</text>
            <text x="0" y="30" style="text-anchor: end; fill: rgba(255,255,255,0.5); font-family: monospace;">${xp} / ${nextXp} XP</text>
            <rect x="-400" y="45" width="400" height="8" rx="4" fill="rgba(255,255,255,0.1)" />
            <defs>
                <linearGradient id="xpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:${rankMeta.color};stop-opacity:0.6" />
                    <stop offset="100%" style="stop-color:${rankMeta.color};stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect x="${-400}" y="45" width="${400 * (progress/100)}" height="8" rx="4" fill="url(#xpGrad)" filter="drop-shadow(0 0 8px ${rankMeta.color})"/>
        </g>
    </svg>`;

    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } });
    return resvg.render().asPng();
}

/**
 * MAIN FUNCTION: PROFILE CARD
 */
async function createProfileCard(user, jid) {
    const width = 1200;
    const height = 700;
    const xp = user.xp || 0;
    const level = Math.floor(xp / 1000) + 1;
    
    // DETEKSI OWNER
    const config = db.load('config');
    const isOwner = jid === config.owner_jid;

    const rankMeta = getRankMeta(level, isOwner); // Pass isOwner
    const isReal = user.account_type === 'REAL';

    try {
        const baseBuffer = await renderBaseLayer(width, height, isReal, isOwner);
        const overlayBuffer = renderVectorLayer(width, height, user, jid, rankMeta, isOwner);
        
        return await sharp(baseBuffer)
            .composite([{ input: overlayBuffer, blend: 'over' }])
            .sharpen()
            .png({ quality: 95, compressionLevel: 9 })
            .toBuffer();
    } catch (error) {
        console.error("Hybrid Rendering Error:", error);
        return Buffer.from(""); 
    }
}

// ... (createMarketChart biarkan sama)
async function createMarketChart() {
    const width = 1000;
    const height = 600;
    const canvas = new Canvas(width, height);
    const ctx = canvas.getContext("2d");

    const jsonPath = path.resolve(__dirname, '../../web/data/market.json');
    let history = [];
    let currentPrice = 1000;
    let trend = "STABLE";
    
    if (fs.existsSync(jsonPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            history = data.history || [];
            currentPrice = data.market.price;
            trend = data.market.trend;
        } catch(e) {}
    }

    if (history.length < 2) history = [{p: 1000}, {p: 1050}, {p: 1020}, {p: 1100}];

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0b0e11");
    bgGrad.addColorStop(1, "#181a20");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#2b3139";
    ctx.lineWidth = 1;
    for (let i = 100; i < height; i += 100) { ctx.beginPath(); ctx.moveTo(50, i); ctx.lineTo(width - 50, i); ctx.stroke(); }
    for (let i = 100; i < width; i += 150) { ctx.beginPath(); ctx.moveTo(i, 100); ctx.lineTo(i, height - 50); ctx.stroke(); }

    drawSvgPath(ctx, ICONS.logo, 50, 40, 1.5, "rgba(255,255,255,0.8)");
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#848e9c";
    ctx.fillText("ARA / IDR • Cuankita Exchange", 90, 65);

    const isUp = trend.includes('NAIK') || trend.includes('BULLISH') || trend.includes('PUMP');
    const priceColor = isUp ? "#0ecb81" : "#f6465d"; 
    
    ctx.font = "bold 60px monospace";
    ctx.fillStyle = priceColor;
    ctx.fillText(currentPrice.toLocaleString('id-ID'), 50, 140);
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(trend, 50, 180);

    const prices = history.map(h => h.p);
    const minP = Math.min(...prices) * 0.99;
    const maxP = Math.max(...prices) * 1.01;
    const range = maxP - minP;
    
    const chartHeight = 350;
    const chartTop = 200;
    const chartBottom = height - 50;
    const chartLeft = 50;
    const chartRight = width - 50;
    const stepX = (chartRight - chartLeft) / (prices.length - 1);

    ctx.beginPath();
    prices.forEach((p, i) => {
        const x = chartLeft + (i * stepX);
        const y = chartBottom - ((p - minP) / range * chartHeight);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });

    const linePath = new Path2D(ctx);
    ctx.lineTo(chartRight, chartBottom);
    ctx.lineTo(chartLeft, chartBottom);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
    fillGrad.addColorStop(0, isUp ? "rgba(14, 203, 129, 0.5)" : "rgba(246, 70, 93, 0.5)");
    fillGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = fillGrad;
    ctx.fill();

    ctx.strokeStyle = priceColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = priceColor;
    ctx.shadowBlur = 20;
    ctx.stroke(linePath);
    ctx.shadowBlur = 0;

    return await canvas.toBuffer('png');
}

function drawSvgPath(ctx, pathString, x, y, scale = 1, color = '#fff') {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const p = new Path2D(pathString);
    ctx.fillStyle = color;
    ctx.fill(p);
    ctx.restore();
}

module.exports = { createProfileCard, createMarketChart };