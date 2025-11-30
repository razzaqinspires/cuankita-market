const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    isJidGroup,
    jidNormalizedUser
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode-terminal'); 
const readline = require('readline'); 

// --- CORE MODULES ---
const engine = require('./engine/intentEngine');
const db = require('./database/core');
const { serialize } = require('./utils/serializer'); 
const session = require('./engine/sessionManager');

// --- SERVICES ---
const onboarding = require('./services/onboarding');
const finance = require('./services/finance');

// --- LOAD ALL RULES ---
require('./rules/finance.intent'); 
require('./rules/exchange.intent'); 
require('./rules/mining.intent');
require('./rules/general.intent'); 
require('./rules/trading.intent');
require('./rules/marketing.intent');
require('./rules/system.intent'); 
require('./rules/games.intent');
require('./rules/store.intent');
require('./rules/ai.intent'); 

const PORT = 3000;
let sock; 

// --- HELPER INPUT ---
const question = (text) => {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(text, (answer) => { rl.close(); resolve(answer); });
    });
};

async function handleAuth() {
    console.clear();
    console.log("===========================================");
    console.log("🔐 SISTEM OTENTIKASI CUANKITA V3.0");
    console.log("===========================================");
    const choice = await question("Pilih metode login:\n1. 📷 QR Code\n2. 🔢 Pairing Code (Nomor HP)\nPilihan [1/2]: ");
    if (choice.trim() === '2') {
        const phone = await question("📱 Masukkan Nomor HP (Format: 628xxx): ");
        return { type: 'pairing', phone: phone.trim() };
    } else {
        return { type: 'qr' };
    }
}

async function connectWA() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    const isRegistered = !!state.creds.me; 
    let authConfig = { type: 'qr' }; 

    if (!isRegistered && !state.creds.registered) {
        authConfig = await handleAuth();
    }

    console.log(`\n🚀 Memulai Socket WhatsApp v${version.join('.')}...`);

    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: { creds: state.creds, keys: state.keys },
        shouldIgnoreJid: jid => isJidGroup(jid) ? true : false,
        browser: ['BotCuan-Ara', 'Ubuntu', '3.0.0']
    });

    if (authConfig.type === 'pairing' && !isRegistered) {
        setTimeout(async () => {
            console.log("⏳ Meminta Pairing Code...");
            try {
                const code = await sock.requestPairingCode(authConfig.phone);
                console.log(`\n🔢 KODE: [ ${code} ]\n`);
            } catch (err) { console.error("Gagal pairing:", err.message); }
        }, 2000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && authConfig.type === 'qr' && !isRegistered) {
            console.log("\n🔑 Scan QR Code:");
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`\n⚠️ Koneksi terputus (Status: ${statusCode}). Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) setTimeout(connectWA, 3000); 
            else process.exit(1); 
        } else if (connection === 'open') {
            console.log('✅ CUANKITA SYSTEM ONLINE & OTONOM.');
            db.load('config');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // MESSAGE HANDLER
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        
        // ⚠️ FIX UTAMA ANTI SPAM / SELF-REPLY LOOP ⚠️
        if (!m.message) return; // Abaikan event kosong
        if (m.key.fromMe) return; // Abaikan pesan diri sendiri (PENTING!)
        if (m.key.remoteJid === 'status@broadcast') return;

        const msg = serialize(sock, m);
        if (!msg || !msg.from) return;

        const ctx = { 
            sock, 
            from: msg.from, 
            sender: msg.sender, 
            text: msg.text, 
            command: msg.command, 
            args: msg.args, 
            m: msg.m, 
            quoted: msg.quoted 
        };

        // GATEKEEPER 0: BANNED
        const config = db.load('config');
        if (config.banned_users && config.banned_users.includes(ctx.sender)) return;

        // GATEKEEPER 1: PRIVATE ONLY
        if (isJidGroup(msg.from)) {
            const allowedGroups = config.allowed_groups || [];
            if (!allowedGroups.includes(msg.from)) return; 
        }

        // GATEKEEPER 2: ONBOARDING
        const users = db.load('users');
        const userExists = !!users[msg.from];
        const currentSession = session.getSession(msg.from);

        if (!userExists && !currentSession) {
            await onboarding.startOnboarding(ctx); 
            return;
        }
        
        if (currentSession && currentSession.type.startsWith('ONBOARDING')) {
            await onboarding.handleOnboarding(ctx, currentSession); 
            return;
        }

        // GATEKEEPER 3: LOCKED (DEPOSIT)
        if (currentSession && currentSession.type === 'LOCKED_TRANSACTION') {
            if (msg.m.message?.imageMessage) {
                await finance.handleProofUpload(ctx, currentSession); 
                return;
            }
            return; 
        }

        // GATEKEEPER 4: REPLY & PSEUDO-BUTTONS
        if (currentSession && currentSession.type === 'DEPOSIT_SELECT_METHOD') {
            await finance.handleDepositStep(ctx, currentSession); return;
        }
        
        const textLower = msg.text.toLowerCase();
        if (textLower === 'switch real' || textLower === 'switch demo') {
            const isReplyValid = ctx.quoted && ctx.quoted.text && (
                ctx.quoted.text.includes('Kartu Identitas Investor') || 
                ctx.quoted.text.includes('Ingin beralih akun?')
            );
            if (isReplyValid) {
                ctx.args = [textLower.split(' ')[1].toUpperCase()]; 
                await finance.performSwitchAccount(ctx);
                return;
            } else { return; }
        }

        // GATEKEEPER 5: COMMAND ENGINE
        if (!msg.command) return; 
        await engine.interpret(msg.command, ctx);
    });
}

function startApp() {
    const app = express();
    app.use(express.json());
    app.post('/webhook', (req, res) => res.send('OK'));
    
    const server = app.listen(PORT, () => { console.log(`🌐 Webhook Server port ${PORT}`); });
    server.on('error', (e) => { if (e.code === 'EADDRINUSE') console.log(`⚠️ Port ${PORT} sibuk.`); });

    try { require('./services/webBridge').start(); } catch (e) {}

    connectWA();
}

module.exports = { start: startApp };